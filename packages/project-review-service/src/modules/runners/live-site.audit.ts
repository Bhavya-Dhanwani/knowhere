import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createRequire } from 'node:module';
import { chromium, devices, Browser, Route } from 'playwright-core';
import { FrontendEvalResult } from './types.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

/** True for loopback, private, link-local (cloud metadata), CGNAT and unique-local addresses. */
export const isPrivateIp = (ip: string): boolean => {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::1' || v === '::' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

export type HostVerdict = 'public' | 'private' | 'nxdomain';
const hostVerdicts = new Map<string, Promise<HostVerdict>>();
/**
 * Student-supplied URLs must never reach cluster-internal services.
 * 'nxdomain' = the domain does not exist (the student's problem, reported plainly). Any other
 * DNS failure is OUR resolver's problem: it rejects, so the run fails and can be re-run instead
 * of scoring the student 0.
 * ponytail: DNS is resolved separately from the browser, so a rebinding host (or a redirect)
 * could still reach an internal address; run the browser in a network-isolated pod if that matters.
 */
export const checkHost = (hostname: string): Promise<HostVerdict> => {
  if (!hostname) return Promise.resolve('nxdomain');
  if (!hostVerdicts.has(hostname)) {
    const verdict = (
      isIP(hostname) ? Promise.resolve([{ address: hostname }]) : lookup(hostname, { all: true })
    ).then(
      (addrs): HostVerdict =>
        addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address)) ? 'public' : 'private',
      async (err: NodeJS.ErrnoException): Promise<HostVerdict> => {
        // a dead resolver also says ENOTFOUND: only blame the student if we can resolve GitHub
        const resolverWorks = await lookup('github.com').then(
          () => true,
          () => false
        );
        if (err.code === 'ENOTFOUND' && resolverWorks) return 'nxdomain';
        hostVerdicts.delete(hostname); // transient: don't cache
        throw err;
      }
    );
    hostVerdicts.set(hostname, verdict);
  }
  return hostVerdicts.get(hostname)!;
};

export const isPublicHost = (hostname: string): Promise<boolean> =>
  checkHost(hostname).then(
    (v) => v === 'public',
    () => false
  );

// one shared browser, a fresh context per audit: 3 parallel evaluations ≠ 3 Chromiums
let browserPromise: Promise<Browser> | null = null;
const launch = (opts: { executablePath?: string; channel?: string }) =>
  chromium.launch({ ...opts, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const getBrowser = () => {
  // container: CHROMIUM_PATH; dev machines: installed Chrome, else Edge (ships with Windows)
  browserPromise ??= (
    env.CHROMIUM_PATH
      ? launch({ executablePath: env.CHROMIUM_PATH })
      : launch({ channel: 'chrome' }).catch(() => launch({ channel: 'msedge' }))
  )
    .then((b) => {
      b.on('disconnected', () => (browserPromise = null));
      return b;
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });
  return browserPromise;
};

/** Linear 100 → 50 between good and poor, then down to 0 at 2× poor (Lighthouse-style curve). */
export const metricScore = (value: number, good: number, poor: number): number => {
  if (value <= good) return 100;
  if (value <= poor) return Math.round(100 - (50 * (value - good)) / (poor - good));
  return Math.max(0, Math.round(50 - (50 * (value - poor)) / poor));
};

const IMPACT_COST: Record<string, number> = { critical: 10, serious: 7, moderate: 3, minor: 1 };

/**
 * Opens the live site in real Chromium, lets its JavaScript run, and measures what a user gets:
 * Core Web Vitals, axe-core accessibility, console/page errors, failed requests, blank-render,
 * mobile overflow and SEO basics. Returns null when no browser is available (caller falls back).
 */
export async function auditLiveSite(url: string): Promise<FrontendEvalResult | null> {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    logger.warn({ err: String(err) }, 'Chromium unavailable; falling back to HTTP probe');
    return null;
  }

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    // a strict CSP is good practice; it must not stop us injecting axe (and zero the student)
    bypassCSP: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 KnowhereJudge/3.0'
  });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  let blockedRequests = 0;
  let dialogs = 0;

  const guard = async (route: Route) => {
    const { protocol, hostname } = new URL(route.request().url());
    if (['data:', 'blob:'].includes(protocol)) return route.continue();
    if (!['http:', 'https:'].includes(protocol) || !(await isPublicHost(hostname))) {
      blockedRequests++;
      return route.abort('blockedbyclient');
    }
    return route.continue();
  };
  // a real phone: mobile UA, touch, device scale; sites that serve phones a different page (or
  // different CSS by UA) are judged on what a phone actually gets
  const mobile = await browser.newContext({ ...devices['Pixel 7'], bypassCSP: true });

  try {
    await context.route('**/*', guard);
    await mobile.route('**/*', guard);

    const page = await context.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)));
    page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)));
    // alert()/prompt() on load would block the page; dismiss it ourselves (Playwright's own
    // auto-dismiss throws an unhandled rejection if the page is already closing)
    page.on('dialog', (d) => {
      dialogs++;
      // answer like a visitor would (sites often loop `while (!name) name = prompt()`, so
      // dismissing would hang them forever); past 20 it is a genuine dialog loop -> dismiss
      (dialogs > 20
        ? d.dismiss()
        : d.accept(d.type() === 'prompt' ? 'Test User' : undefined)
      ).catch(() => {});
    });
    page.on('requestfailed', (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url()}`));
    page.on('response', (r) => {
      if (r.status() >= 400 && r.request().resourceType() !== 'document')
        failedRequests.push(`HTTP ${r.status()} ${r.url()}`);
    });
    // buffered observers so LCP/CLS captured from the very first paint
    await page.addInitScript(() => {
      const w = window as any;
      w.__lcp = 0;
      w.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.__lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    // free hosts (Render, Railway, Glitch...) sleep idle apps and take 30-60s to wake, often
    // answering 502/503 meanwhile: wait generously and retry once so a sleeping app isn't a 0
    let res = null;
    for (let attempt = 1; ; attempt++) {
      // only the final attempt's errors count
      consoleErrors.length = pageErrors.length = failedRequests.length = 0;
      try {
        res = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        if (attempt === 1 && res && [502, 503, 504].includes(res.status())) {
          await page.waitForTimeout(15000);
          continue;
        }
        break;
      } catch (err) {
        if (attempt > 1) throw err;
      }
    }
    // data: URLs (tests) have no response object; a real http(s) page always does
    if (res ? res.status() >= 400 : /^https?:/.test(url)) {
      return {
        tool: 'Playwright (Chromium)',
        assessmentMode: 'BROWSER',
        isReachable: false,
        httpStatus: res?.status() ?? 0,
        liveError: `Live site returned HTTP ${res?.status() ?? 'no response'}`,
        lighthouse: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
        axeViolationsCount: 0,
        consoleErrorsCount: consoleErrors.length,
        failedRequestsCount: failedRequests.length,
        findings: [`Main document failed with HTTP ${res?.status() ?? 'no response'}`]
      };
    }
    // SPAs keep fetching after "load"; give them a moment to settle, but never hang on websockets
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const m = await page.evaluate(() => {
      const w = window as any;
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const bytes = performance
        .getEntriesByType('resource')
        .reduce((s, r: any) => s + (r.transferSize || 0), nav?.transferSize || 0);
      const visibleText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      return {
        fcpMs: Math.round(fcp),
        lcpMs: Math.round(w.__lcp || fcp),
        cls: Number((w.__cls || 0).toFixed(3)),
        loadMs: Math.round(nav?.loadEventEnd || 0),
        transferKb: Math.round(bytes / 1024),
        visibleTextLength: visibleText.length,
        mediaCount: document.querySelectorAll('img,canvas,svg,video').length,
        title: document.title.trim(),
        hasMetaDescription: !!document.querySelector('meta[name="description"][content]'),
        hasViewport: !!document.querySelector('meta[name="viewport"]'),
        hasLang: !!document.documentElement.lang,
        h1Count: document.querySelectorAll('h1').length,
        linkCount: document.querySelectorAll('a[href]').length,
        pageHeight: document.documentElement.scrollHeight,
        // 0 = the page is rendered with the browser's default styles (no CSS written at all);
        // cross-origin sheets can't be read, so each counts as 1 rule
        authorCssRules:
          [...document.styleSheets].reduce((n, sheet) => {
            try {
              return n + sheet.cssRules.length;
            } catch {
              return n + 1;
            }
          }, 0) + document.querySelectorAll('[style]').length
      };
    });

    // if axe can't run on this page, report that instead of calling a working site unreachable
    let axeError = '';
    const axe: Array<{ id: string; impact: string; nodes: number }> = await page
      .addScriptTag({ path: axePath })
      .then(() =>
        page.evaluate(async () => {
          const r = await (window as any).axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] }
          });
          return r.violations.map((v: any) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length
          }));
        })
      )
      .catch((err) => {
        axeError = String(err).split('\n')[0].slice(0, 160);
        return [];
      });

    // what the student actually built, for the visual rubric criteria and for trainers;
    // full page capped at 3000px so a huge page stays a reasonable image
    const shot = (fullPage: boolean) =>
      page
        .screenshot({
          type: 'jpeg',
          quality: 55,
          ...(fullPage
            ? { clip: { x: 0, y: 0, width: 1366, height: Math.min(3000, m.pageHeight || 768) } }
            : {})
        })
        .then((b) => `data:image/jpeg;base64,${b.toString('base64')}`)
        .catch(() => undefined);
    const desktopScreenshot = await shot(true);

    // mobile: load it again as a phone and check the layout fits the screen
    const phone = await mobile.newPage();
    phone.on('dialog', (d) =>
      d.accept(d.type() === 'prompt' ? 'Test User' : undefined).catch(() => {})
    );
    let mobileOverflowPx = 0;
    let mobileScreenshot: string | undefined;
    if (await phone.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => null)) {
      await phone.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      mobileOverflowPx = await phone
        .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        .catch(() => 0);
      mobileScreenshot = await phone
        .screenshot({ type: 'jpeg', quality: 55 })
        .then((b) => `data:image/jpeg;base64,${b.toString('base64')}`)
        .catch(() => undefined);
    }

    const isHttps = page.url().startsWith('https://');
    const blank = m.visibleTextLength < 20 && m.mediaCount === 0;

    // a page that never paints content is not "fast": LCP/FCP of 0 would otherwise score 100
    const performanceScore =
      blank || m.fcpMs === 0
        ? 0
        : Math.round(
            0.4 * metricScore(m.lcpMs, 2500, 4000) +
              0.25 * metricScore(m.fcpMs, 1800, 3000) +
              0.25 * metricScore(m.cls * 1000, 100, 250) +
              0.1 * metricScore(m.transferKb, 1600, 4000)
          );
    // ponytail: unmeasured a11y gets a neutral 50 (neither rewarded nor zeroed); rare now that
    // CSP is bypassed. Exclude it from the average in the scoring engine if it ever shows up often.
    const accessibilityScore = axeError
      ? 50
      : Math.max(0, 100 - axe.reduce((s, v) => s + (IMPACT_COST[v.impact] ?? 3), 0));
    const bestPracticesScore = Math.max(
      0,
      100 -
        (isHttps ? 0 : 15) -
        Math.min(30, pageErrors.length * 10) -
        Math.min(30, consoleErrors.length * 5) -
        Math.min(20, failedRequests.length * 5) -
        (mobileOverflowPx > 5 ? 10 : 0) -
        (blank ? 40 : 0)
    );
    const seoScore = Math.max(
      0,
      100 -
        (m.title ? 0 : 25) -
        (m.hasMetaDescription ? 0 : 15) -
        (m.hasViewport ? 0 : 20) -
        (m.hasLang ? 0 : 10) -
        (m.h1Count === 1 ? 0 : 10)
    );

    // findings are built only from our own measurements (never page text), so they are safe to
    // hand to the LLM scorers; raw console messages stay in consoleErrors for humans
    const findings = [
      `LCP ${m.lcpMs}ms, FCP ${m.fcpMs}ms, CLS ${m.cls}, load ${m.loadMs}ms, ${m.transferKb}KB transferred`,
      blank && 'Page renders blank after JavaScript runs (no visible text or images)',
      m.authorCssRules === 0 && 'No CSS at all: the page renders in default browser styling',
      pageErrors.length && `${pageErrors.length} uncaught JavaScript exception(s) on load`,
      consoleErrors.length && `${consoleErrors.length} console error(s) on load`,
      failedRequests.length && `${failedRequests.length} failed network request(s)`,
      blockedRequests && `${blockedRequests} request(s) to private/internal addresses blocked`,
      dialogs && `${dialogs} alert/prompt dialog(s) on page load (answered like a visitor)`,
      !isHttps && 'Served over plain HTTP, not HTTPS',
      mobileOverflowPx > 5 &&
        `Horizontal scroll on a phone (Pixel 7: ${mobileOverflowPx}px overflow)`,
      !m.title && 'Missing <title>',
      !m.hasViewport && 'Missing viewport meta tag',
      !m.hasMetaDescription && 'Missing meta description',
      m.h1Count !== 1 && `${m.h1Count} <h1> elements (expected 1)`,
      axeError && 'Accessibility scan could not run on this page; accessibility score not measured',
      ...axe.map((v) => `axe ${v.impact}: ${v.id} (${v.nodes} element(s))`)
    ].filter(Boolean) as string[];

    return {
      tool: 'Playwright (Chromium) + axe-core',
      assessmentMode: 'BROWSER',
      isReachable: true,
      httpStatus: res?.status() ?? 200,
      liveError: blank ? 'Page renders blank after JavaScript runs' : undefined,
      lighthouse: {
        performance: performanceScore,
        accessibility: accessibilityScore,
        bestPractices: bestPracticesScore,
        seo: seoScore
      },
      axeViolationsCount: axe.reduce((s: number, v: any) => s + v.nodes, 0),
      consoleErrorsCount: consoleErrors.length + pageErrors.length,
      failedRequestsCount: failedRequests.length,
      metrics: { ...m, mobileOverflowPx, isHttps },
      screenshots: { desktop: desktopScreenshot, mobile: mobileScreenshot },
      findings,
      consoleErrors: [...pageErrors, ...consoleErrors].slice(0, 10)
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return {
      tool: 'Playwright (Chromium)',
      assessmentMode: 'BROWSER',
      isReachable: false,
      httpStatus: 0,
      liveError: `Live site failed to load in browser: ${msg}`,
      lighthouse: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
      axeViolationsCount: 0,
      consoleErrorsCount: consoleErrors.length,
      failedRequestsCount: failedRequests.length,
      findings: [`Browser could not load the page: ${msg}`]
    };
  } finally {
    await mobile.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

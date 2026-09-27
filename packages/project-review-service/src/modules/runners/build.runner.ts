import http from 'node:http';
import https from 'node:https';
import { githubHeaders, parseGithubRepo } from './discovery.runner.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

export interface BuildStep {
  name: string;
  ok: boolean | null; // null = not runnable here (see skipped)
  skipped?: string;
  exitCode?: number | null;
  error?: string;
  timeMs?: number;
  tests?: { passed: number; failed: number };
  note?: string;
  /** Raw compiler/test output: student-influenced text, handled as untrusted. */
  output?: string;
}

export interface IoTest {
  name?: string;
  input: string;
  expected: string;
}

export interface BuildEvalResult {
  status: 'RAN' | 'NOT_RUN';
  reason?: string;
  steps: BuildStep[];
}

const MAX_ARCHIVE = 25 * 1024 * 1024;
const JUDGE_WAIT_MS = 15 * 60_000; // queued behind other projects + fetch + build + tests

/**
 * POST JSON and wait up to JUDGE_WAIT_MS for the answer. Not fetch(): undici gives up after 5
 * minutes without response headers, and the judge only answers when the whole run is done.
 */
const postJson = (url: string, payload: unknown) =>
  new Promise<unknown>((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = (url.startsWith('https:') ? https : http).request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode || 500) >= 400)
            return reject(
              new Error(`Judge /project failed: HTTP ${res.statusCode} ${text.slice(0, 200)}`)
            );
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.setTimeout(JUDGE_WAIT_MS, () =>
      req.destroy(new Error('Judge did not answer within 15 minutes'))
    );
    req.on('error', reject);
    req.end(data);
  });

/**
 * Builds and tests the repo at the pinned commit in the judge-runner sandbox (offline, any stack
 * it can detect). This service downloads the tarball because the judge has no network at all.
 */
export class BuildRunner {
  public static async run(
    repoUrl: string,
    ref: string,
    extra: { ioTests?: IoTest[]; runCommand?: string } = {}
  ): Promise<BuildEvalResult> {
    if (!env.JUDGE_URL)
      return { status: 'NOT_RUN', reason: 'No judge configured (JUDGE_URL)', steps: [] };
    const gh = parseGithubRepo(repoUrl);
    if (!gh) return { status: 'NOT_RUN', reason: 'Not a GitHub repository', steps: [] };

    const res = await fetch(
      `https://api.github.com/repos/${gh.owner}/${gh.repo}/tarball/${encodeURIComponent(ref)}`,
      { headers: githubHeaders, signal: AbortSignal.timeout(60_000) }
    );
    if (res.status === 404)
      return { status: 'NOT_RUN', reason: 'Repository or commit not found', steps: [] };
    // rate limit / outage: our problem, fail the run so it is retried rather than scored
    if (!res.ok || !res.body) throw new Error(`GitHub tarball download failed: HTTP ${res.status}`);
    if (Number(res.headers.get('content-length')) > MAX_ARCHIVE)
      return { status: 'NOT_RUN', reason: 'Repository archive is larger than 25MB', steps: [] };

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_ARCHIVE)
        return { status: 'NOT_RUN', reason: 'Repository archive is larger than 25MB', steps: [] };
      chunks.push(Buffer.from(chunk));
    }

    const body = (await postJson(`${env.JUDGE_URL.replace(/\/+$/, '')}/project`, {
      archive: Buffer.concat(chunks).toString('base64'),
      ioTests: extra.ioTests?.length ? extra.ioTests : undefined,
      runCommand: extra.runCommand || undefined
    })) as { steps: BuildStep[] };
    logger.info(
      { repo: `${gh.owner}/${gh.repo}`, steps: body.steps.map((s) => `${s.name}:${s.ok}`) },
      'Build & test finished'
    );
    return { status: 'RAN', steps: body.steps };
  }
}

/** Facts only (no raw output): safe for any LLM prompt and for summaries. */
export const summarizeBuild = (b?: BuildEvalResult | null) =>
  !b || b.status !== 'RAN'
    ? { ran: false, reason: b?.reason || 'not run' }
    : b.steps.length === 0
      ? // say so plainly: "ran, nothing failed" reads like "builds cleanly" to a grader
        {
          ran: false,
          reason:
            'nothing to build or test was detected (no build system or compiled/tested language)'
        }
      : {
          ran: true,
          steps: b.steps.map((s) => ({
            step: s.name,
            result:
              s.ok === null
                ? `not run: ${s.skipped}`
                : s.ok
                  ? 'passed'
                  : `FAILED${s.error ? ` (${s.error})` : ''}`,
            tests: s.tests,
            note: s.note
          }))
        };

export default BuildRunner;

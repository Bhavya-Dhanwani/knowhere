import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = Number(process.env.PORT || 7002);
const token = process.env.EVALUATION_RUNNER_TOKEN || '';
const maxBodyBytes = 256 * 1024;
const outputLimit = 2 * 1024 * 1024;
const gitHubRepository = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i;
const commitSha = /^[a-fA-F0-9]{40}$/;

const now = () => new Date().toISOString();
const digest = (value) => createHash('sha256').update(value).digest('hex');
const authorized = (request) => {
  if (!token) return false;
  const supplied = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = Buffer.from(token);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

const execution = (tool, started, status, extra = {}) => ({
  status,
  attempted: status !== 'NOT_APPLICABLE' && status !== 'UNAVAILABLE',
  tool,
  durationMs: Date.now() - started,
  observedAt: now(),
  ...extra
});

const run = (tool, command, args, options = {}) => new Promise((resolve) => {
  const started = Date.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let outputExceeded = false;
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH || '',
      HOME: options.home || tmpdir(),
      CI: 'true',
      NO_COLOR: '1',
      GIT_TERMINAL_PROMPT: '0',
      GIT_LFS_SKIP_SMUDGE: '1'
    }
  });
  const append = (target, chunk) => {
    const next = target + chunk.toString('utf8');
    if (Buffer.byteLength(next) > outputLimit) {
      outputExceeded = true;
      child.kill('SIGKILL');
      return next.slice(0, outputLimit);
    }
    return next;
  };
  child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
  child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, options.timeoutMs || 10 * 60_000);
  child.once('error', (error) => {
    clearTimeout(timer);
    resolve({
      stdout,
      stderr,
      execution: execution(tool, started, 'FAILED', { error: error.message })
    });
  });
  child.once('close', (code) => {
    clearTimeout(timer);
    const status = timedOut ? 'TIMED_OUT' : code === 0 && !outputExceeded ? 'SUCCEEDED' : 'FAILED';
    resolve({
      stdout,
      stderr,
      execution: execution(tool, started, status, {
        exitCode: code ?? undefined,
        stdoutSha256: digest(stdout),
        stderrSha256: digest(stderr),
        ...(timedOut ? { error: 'Execution timed out' } : {}),
        ...(outputExceeded ? { error: 'Output limit exceeded' } : {})
      })
    });
  });
});

const clonePinned = async (repositoryUrl, sha) => {
  if (!gitHubRepository.test(String(repositoryUrl)) || !commitSha.test(String(sha))) {
    throw new Error('A canonical HTTPS GitHub URL and full 40-character commit SHA are required');
  }
  const workspace = await mkdtemp(path.join(tmpdir(), 'evaluation-runner-'));
  const repository = path.join(workspace, 'repository');
  const clone = await run('git-clone', 'git', ['clone', '--filter=blob:none', '--no-checkout', '--', repositoryUrl, repository], { home: workspace, timeoutMs: 120_000 });
  if (clone.execution.status !== 'SUCCEEDED') {
    await rm(workspace, { recursive: true, force: true });
    throw new Error(`Clone failed: ${clone.stderr.slice(-1000)}`);
  }
  const fetch = await run('git-fetch-commit', 'git', ['-C', repository, 'fetch', '--depth=1', 'origin', sha], { home: workspace, timeoutMs: 120_000 });
  if (fetch.execution.status !== 'SUCCEEDED') {
    await rm(workspace, { recursive: true, force: true });
    throw new Error(`Commit fetch failed: ${fetch.stderr.slice(-1000)}`);
  }
  const checkout = await run('git-checkout', 'git', ['-C', repository, '-c', 'core.hooksPath=/dev/null', 'checkout', '--detach', sha], { home: workspace, timeoutMs: 60_000 });
  if (checkout.execution.status !== 'SUCCEEDED') {
    await rm(workspace, { recursive: true, force: true });
    throw new Error(`Checkout failed: ${checkout.stderr.slice(-1000)}`);
  }
  return { workspace, repository };
};

const severity = (value) => {
  const normalized = String(value || 'LOW').toUpperCase();
  if (normalized === 'ERROR' || normalized === 'CRITICAL') return 'CRITICAL';
  if (normalized === 'WARNING' || normalized === 'HIGH') return 'HIGH';
  return normalized === 'MEDIUM' ? 'MEDIUM' : 'LOW';
};

const staticAnalysis = async (payload) => {
  const checkout = await clonePinned(payload.repositoryUrl, payload.commitSha);
  try {
    const [semgrepRun, gitleaksRun, trivyRun] = await Promise.all([
      run('Semgrep', 'semgrep', ['scan', '--config', 'auto', '--json', '--quiet', '--', checkout.repository], { home: checkout.workspace }),
      run('Gitleaks', 'gitleaks', ['detect', '--source', checkout.repository, '--report-format', 'json', '--report-path', '-', '--exit-code', '0', '--no-banner'], { home: checkout.workspace }),
      run('Trivy', 'trivy', ['fs', '--format', 'json', '--scanners', 'vuln,secret,misconfig', '--quiet', '--', checkout.repository], { home: checkout.workspace })
    ]);
    const semgrepJson = semgrepRun.execution.status === 'SUCCEEDED' ? JSON.parse(semgrepRun.stdout || '{}') : {};
    const findings = (semgrepJson.results || []).map((item) => ({
      ruleId: String(item.check_id || 'unknown-rule'),
      message: String(item.extra?.message || ''),
      path: String(item.path || ''),
      line: Number(item.start?.line || 1),
      severity: severity(item.extra?.severity)
    }));
    const leaksJson = gitleaksRun.execution.status === 'SUCCEEDED' && gitleaksRun.stdout.trim() ? JSON.parse(gitleaksRun.stdout) : [];
    const leaks = leaksJson.map((item) => ({ rule: String(item.RuleID || item.Description || 'unknown-secret'), file: String(item.File || ''), line: Number(item.StartLine || 1), ...(item.Commit ? { commit: String(item.Commit) } : {}) }));
    const trivyJson = trivyRun.execution.status === 'SUCCEEDED' ? JSON.parse(trivyRun.stdout || '{}') : {};
    const cves = (trivyJson.Results || []).flatMap((result) => result.Vulnerabilities || []).map((item) => ({ cveId: String(item.VulnerabilityID || 'unknown-vulnerability'), package: String(item.PkgName || ''), severity: severity(item.Severity), ...(item.FixedVersion ? { fixedIn: String(item.FixedVersion) } : {}) }));
    const count = (items, level) => items.filter((item) => item.severity === level).length;
    return {
      semgrep: { tool: 'Semgrep', execution: semgrepRun.execution, totalIssues: findings.length, criticalCount: count(findings, 'CRITICAL'), highCount: count(findings, 'HIGH'), mediumCount: count(findings, 'MEDIUM'), lowCount: count(findings, 'LOW'), findings },
      gitleaks: { tool: 'Gitleaks', execution: gitleaksRun.execution, secretsFoundCount: leaks.length, leaks },
      trivy: { tool: 'Trivy', execution: trivyRun.execution, vulnerabilityCount: cves.length, critical: count(cves, 'CRITICAL'), high: count(cves, 'HIGH'), medium: count(cves, 'MEDIUM'), low: count(cves, 'LOW'), cves }
    };
  } finally {
    await rm(checkout.workspace, { recursive: true, force: true });
  }
};

const testCounts = (output) => {
  const node = Object.fromEntries([...output.matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)].map((match) => [match[1], Number(match[2])]));
  if (node.tests !== undefined) return { total: node.tests, passed: node.pass || 0, failed: node.fail || 0, skipped: node.skipped || 0 };
  const jest = output.match(/Tests:\s+(?:(\d+) skipped,\s*)?(?:(\d+) failed,\s*)?(?:(\d+) passed,\s*)?(\d+) total/);
  if (jest) return { total: Number(jest[4]), passed: Number(jest[3] || 0), failed: Number(jest[2] || 0), skipped: Number(jest[1] || 0) };
  const vitest = output.match(/Tests\s+(?:(\d+) failed\s*\|\s*)?(?:(\d+) passed)(?:\s*\|\s*(\d+) skipped)?/);
  if (vitest) {
    const passed = Number(vitest[2] || 0); const failed = Number(vitest[1] || 0); const skipped = Number(vitest[3] || 0);
    return { total: passed + failed + skipped, passed, failed, skipped };
  }
  return undefined;
};

const buildAndTest = async (payload) => {
  const checkout = await clonePinned(payload.repositoryUrl, payload.commitSha);
  try {
    let manifest;
    try { manifest = JSON.parse(await readFile(path.join(checkout.repository, 'package.json'), 'utf8')); } catch { throw new Error('The built-in execution runner currently requires a Node package.json'); }
    const packageManager = await (async () => {
      try { await readFile(path.join(checkout.repository, 'pnpm-lock.yaml')); return ['corepack', ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts']]; } catch {}
      try { await readFile(path.join(checkout.repository, 'yarn.lock')); return ['corepack', ['yarn', 'install', '--immutable', '--ignore-scripts']]; } catch {}
      return ['npm', ['ci', '--ignore-scripts']];
    })();
    const install = await run('dependency-install', packageManager[0], packageManager[1], { cwd: checkout.repository, home: checkout.workspace });
    if (install.execution.status !== 'SUCCEEDED') return { build: { execution: install.execution, command: [packageManager[0], ...packageManager[1]] } };
    const manager = packageManager[0] === 'npm' ? 'npm' : packageManager[1][0];
    const buildCommand = manager === 'npm' ? ['npm', ['run', 'build']] : ['corepack', [manager, 'run', 'build']];
    const build = manifest.scripts?.build ? await run('project-build', buildCommand[0], buildCommand[1], { cwd: checkout.repository, home: checkout.workspace }) : undefined;
    const testCommand = manager === 'npm' ? ['npm', ['test', '--', '--runInBand']] : ['corepack', [manager, 'test', '--', '--runInBand']];
    const tests = manifest.scripts?.test ? await run('project-tests', testCommand[0], testCommand[1], { cwd: checkout.repository, home: checkout.workspace }) : undefined;
    const counts = tests ? testCounts(`${tests.stdout}\n${tests.stderr}`) : undefined;
    return {
      ...(build ? { build: { execution: build.execution, command: [buildCommand[0], ...buildCommand[1]] } } : {}),
      ...(tests ? { tests: {
        execution: counts ? tests.execution : { ...tests.execution, status: 'FAILED', error: 'Test output did not contain verifiable structured counts' },
        command: [testCommand[0], ...testCommand[1]],
        ...(counts || {})
      } } : {})
    };
  } finally {
    await rm(checkout.workspace, { recursive: true, force: true });
  }
};

const publicUrl = async (value) => {
  const parsed = new URL(String(value));
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Only public HTTP(S) targets are accepted');
  const addresses = await lookup(parsed.hostname, { all: true });
  const blocked = addresses.some(({ address }) => {
    if (isIP(address) === 4) return /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  });
  if (blocked) throw new Error('Private, loopback, and link-local targets are not accepted');
  return parsed.toString();
};

const browserEvaluation = async (payload) => {
  const target = await publicUrl(payload.liveSiteUrl);
  const runResult = await run('Lighthouse', 'lighthouse', [target, '--output=json', '--output-path=stdout', '--quiet', '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage'], { timeoutMs: 10 * 60_000 });
  if (runResult.execution.status !== 'SUCCEEDED') throw new Error(`Lighthouse failed: ${runResult.stderr.slice(-1000)}`);
  const report = JSON.parse(runResult.stdout);
  const score = (category) => Math.round(Number(report.categories?.[category]?.score || 0) * 100);
  return {
    lighthouse: { performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo') },
    consoleErrorsCount: Number(report.audits?.['errors-in-console']?.details?.items?.length || 0),
    failedRequestsCount: Number(report.audits?.['network-requests']?.details?.items?.filter((item) => item.statusCode >= 400).length || 0),
    journeysExecuted: 1
  };
};

const xmlAttributeTotal = (xml, attribute) => [...xml.matchAll(new RegExp(`<testsuite[^>]*\\b${attribute}="(\\d+)"`, 'g'))].reduce((sum, match) => sum + Number(match[1]), 0);

const apiEvaluation = async (payload) => {
  const specUrl = await publicUrl(payload.apiSpecUrl);
  const targetUrl = payload.targetUrl ? await publicUrl(payload.targetUrl) : undefined;
  const workspace = await mkdtemp(path.join(tmpdir(), 'schemathesis-'));
  const reportPath = path.join(workspace, 'junit.xml');
  try {
    const args = ['run', specUrl, '--max-examples', '25', '--generation-deterministic', '--continue-on-failure', '--request-timeout', '10', '--max-redirects', '0', '--report-junit-path', reportPath];
    if (targetUrl) args.push('--url', targetUrl);
    const result = await run('Schemathesis', 'schemathesis', args, { home: workspace, timeoutMs: 15 * 60_000 });
    let report;
    try { report = await readFile(reportPath, 'utf8'); } catch { throw new Error(`Schemathesis did not produce a JUnit report: ${result.stderr.slice(-1000)}`); }
    const total = xmlAttributeTotal(report, 'tests');
    const failed = xmlAttributeTotal(report, 'failures') + xmlAttributeTotal(report, 'errors');
    const skipped = xmlAttributeTotal(report, 'skipped');
    if (total < 1 || failed + skipped > total) throw new Error('Schemathesis returned inconsistent JUnit counts');
    const failures = [...report.matchAll(/<testcase[^>]*name="([^"]+)"[^>]*>[\s\S]*?<(?:failure|error)[^>]*message="([^"]*)"/g)].map((match) => ({ endpoint: match[1], method: 'GENERATED', statusCode: 0, failureType: match[2].slice(0, 500) }));
    return { schemathesis: { totalTests: total, passed: total - failed - skipped, failed, flaky: skipped, endpointsTested: total, failures } };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
};

const handlers = { '/static': staticAnalysis, '/execute': buildAndTest, '/browser': browserEvaluation, '/api': apiEvaluation };
let exclusiveTail = Promise.resolve();

const runExclusive = async (handler) => {
  const previous = exclusiveTail;
  let release;
  exclusiveTail = new Promise((resolve) => { release = resolve; });
  await previous;
  try { return await handler(); } finally { release(); }
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end('{"status":"ok"}');
  }
  const handler = request.method === 'POST' ? handlers[request.url] : undefined;
  if (!handler || !authorized(request)) { response.writeHead(404); return response.end(); }
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodyBytes) { response.writeHead(413); return response.end(); }
  }
  try {
    const payload = JSON.parse(body);
    const result = await runExclusive(() => handler(payload));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(422, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(port, '0.0.0.0');

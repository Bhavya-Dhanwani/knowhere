import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 7001);
const runnerToken = process.env.CODING_RUNNER_TOKEN || '';
const maximumBodyBytes = 1024 * 1024;

const authorized = (request) => {
  if (!runnerToken) return false;
  const supplied = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expectedBuffer = Buffer.from(runnerToken);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
};

const executeCase = async (file, input, timeMs, memoryMb, index) =>
  new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(process.execPath, [`--max-old-space-size=${memoryMb}`, file], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '' }
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeMs);
    const collect = (target, chunk) => {
      if (Buffer.byteLength(target) >= 64 * 1024) return target;
      return target + chunk.toString('utf8').slice(0, 64 * 1024 - Buffer.byteLength(target));
    };
    child.stdout.on('data', (chunk) => { stdout = collect(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = collect(stderr, chunk); });
    child.stdin.end(String(input));
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve({ testCaseIndex: index, status: 'RE', timeMs: Date.now() - started, memoryMb: 0, errorMessage: error.message });
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({
        testCaseIndex: index,
        status: timedOut ? 'TLE' : code === 0 ? 'AC' : 'RE',
        timeMs: Date.now() - started,
        memoryMb: 0,
        actualOutput: stdout.trim(),
        ...(code === 0 ? {} : { errorMessage: stderr.trim() || `Exited with code ${code}` })
      });
    });
  });

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end('{"status":"ok"}');
  }
  if (request.method !== 'POST' || request.url !== '/execute' || !authorized(request)) {
    response.writeHead(404);
    return response.end();
  }
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maximumBodyBytes) {
      response.writeHead(413);
      return response.end();
    }
  }
  let workdir;
  try {
    const payload = JSON.parse(body);
    if (!['javascript', 'js', 'node'].includes(String(payload.language).toLowerCase())) {
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end(JSON.stringify({ result: 'CE', passedTestCases: 0, totalTestCases: payload.testCases?.length || 1, details: (payload.testCases || [{}]).map((_, index) => ({ testCaseIndex: index + 1, status: 'CE', timeMs: 0, memoryMb: 0, errorMessage: 'Unsupported language' })) }));
    }
    const tests = Array.isArray(payload.testCases) ? payload.testCases : [];
    if (tests.length === 0 || typeof payload.code !== 'string') throw new Error('code and testCases are required');
    workdir = await mkdtemp(path.join(tmpdir(), 'judge-'));
    const file = path.join(workdir, 'solution.mjs');
    await writeFile(file, payload.code, { encoding: 'utf8', mode: 0o400 });
    const timeMs = Math.min(Math.max(Number(payload.limits?.timeMs || 2000), 100), 10000);
    const memoryMb = Math.min(Math.max(Number(payload.limits?.memoryMb || 128), 16), 512);
    const details = [];
    for (let index = 0; index < tests.length; index++) {
      const detail = await executeCase(file, tests[index].input, timeMs, memoryMb, index + 1);
      if (detail.status === 'AC' && detail.actualOutput !== String(tests[index].expectedOutput).trim()) detail.status = 'WA';
      if (tests[index].isHidden) delete detail.actualOutput;
      details.push(detail);
    }
    const passedTestCases = details.filter((detail) => detail.status === 'AC').length;
    const result = passedTestCases === details.length
      ? 'AC'
      : details.find((detail) => detail.status !== 'WA' && detail.status !== 'AC')?.status || 'WA';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ result, passedTestCases, totalTestCases: details.length, details }));
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  } finally {
    if (workdir) await rm(workdir, { recursive: true, force: true });
  }
});

server.listen(port, '0.0.0.0');

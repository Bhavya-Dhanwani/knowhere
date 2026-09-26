// Runs learner JavaScript in a throwaway Web Worker, one worker per test so an
// infinite loop is killed by the timeout without freezing the page. The worker has
// no DOM, cookies or auth token, and it is terminated after every run.

export interface RunCase {
  input: string;
  expected: string;
}

export interface RunResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
  timeMs: number;
  logs: string[];
}

const WORKER_SRC = `
self.onmessage = (e) => {
  const { code, input } = e.data;
  const logs = [];
  const fmt = (v) => typeof v === 'string' ? v : JSON.stringify(v);
  const console = { log: (...a) => logs.push(a.map(fmt).join(' ')), error: (...a) => logs.push(a.map(fmt).join(' ')) };
  const t0 = performance.now();
  try {
    const solve = new Function('console', code + '\\n;return typeof solve === "function" ? solve : undefined;')(console);
    if (typeof solve !== 'function') throw new Error('Define a function named solve(input).');
    const out = solve(input);
    self.postMessage({ ok: true, output: out === undefined ? '' : fmt(out), logs, time: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err), logs, time: performance.now() - t0 });
  }
};`;

const normalise = (s: string) => s.replace(/\r\n/g, '\n').trim();

function runOne(code: string, c: RunCase, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const done = (r: Omit<RunResult, 'input' | 'expected'>) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ input: c.input, expected: c.expected, ...r });
    };
    const timer = window.setTimeout(
      () =>
        done({
          actual: '',
          passed: false,
          error: `Timed out after ${timeoutMs}ms`,
          timeMs: timeoutMs,
          logs: []
        }),
      timeoutMs
    );
    worker.onmessage = (e) => {
      window.clearTimeout(timer);
      const m = e.data as {
        ok: boolean;
        output?: string;
        error?: string;
        logs: string[];
        time: number;
      };
      const actual = m.output ?? '';
      done({
        actual,
        passed: m.ok && normalise(actual) === normalise(c.expected),
        error: m.error,
        timeMs: Math.round(m.time),
        logs: m.logs
      });
    };
    worker.postMessage({ code, input: c.input });
  });
}

export async function runJavaScript(code: string, cases: RunCase[], timeoutMs = 2000) {
  const results: RunResult[] = [];
  for (const c of cases) results.push(await runOne(code, c, timeoutMs));
  return results;
}

export const JS_STARTER = `// Read the raw input string, return the expected output.
function solve(input) {
  const lines = input.trim().split('\\n');
  // your code here
  return '';
}
`;

import { spawn } from 'node:child_process';

// Server-side judge for JavaScript solutions (`function solve(input) { return output }`).
// Learner code runs in a separate node process started with the permission model
// (no fs / child processes / workers), an empty env and a hard wall-clock kill; inside it
// the code runs in a fresh vm context, so it never touches `process` or the result channel,
// and only strings cross back.
// The context exposes no host APIs (no require, process, fetch, timers), so learner code has no
// way to reach the network or filesystem; the process-level permission model is a second wall.
// Python, C++ and Java go to the judge-runner service, which sandboxes every run (see judgeCode).

export interface CaseResult {
  passed: boolean;
  output: string;
  error?: string;
}

export interface JudgeResult {
  passed: number;
  total: number;
  error?: string;
  // per-case outcome, in input order (empty when the program never ran)
  cases?: CaseResult[];
}

export const JUDGE_LANGUAGES = ['javascript', 'python', 'cpp', 'java'] as const;
export type JudgeLanguage = (typeof JUDGE_LANGUAGES)[number];

type RawResult = { ok: boolean; output?: string; error?: string };

// compares program output with the expected output (trailing whitespace / CRLF tolerant)
function score(cases: { expectedOutput: string }[], results: RawResult[]): JudgeResult {
  let passed = 0;
  let error: string | undefined;
  const out = cases.map((c, i) => {
    const r = results[i] || { ok: false, error: 'Not run' };
    const ok = r.ok && normalise(r.output || '') === normalise(c.expectedOutput);
    if (ok) passed++;
    else if (!error) error = r.ok ? `Wrong answer on test ${i + 1}` : `Test ${i + 1}: ${r.error}`;
    return {
      passed: ok,
      output: (r.output || '').slice(0, 2000),
      ...(r.error ? { error: r.error } : {})
    };
  });
  return { passed, total: cases.length, error, cases: out };
}

const RUNNER = `
const vm = require('node:vm');
let raw = '';
process.stdin.on('data', (d) => (raw += d)).on('end', () => {
  const { code, inputs, caseMs } = JSON.parse(raw);
  // no eval / new Function / wasm inside the sandbox: closes constructor-chain escapes
  const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  const out = [];
  try {
    vm.runInContext(
      'var console = { log() {}, error() {}, warn() {} };\\n' + code +
      '\\n;globalThis.__run = function (i) { if (typeof solve !== "function") throw new Error("Define a function named solve(input)."); var r = solve(i); return r === undefined ? "" : typeof r === "string" ? r : JSON.stringify(r); };',
      ctx,
      { timeout: caseMs, microtaskMode: 'afterEvaluate' }
    );
    for (const input of inputs) {
      try {
        ctx.__input = input;
        const r = vm.runInContext('__run(__input)', ctx, { timeout: caseMs, microtaskMode: 'afterEvaluate' });
        out.push(typeof r === 'string' ? { ok: true, output: r } : { ok: false, error: 'Output must be a string' });
      } catch (e) {
        let msg = 'Runtime error';
        try { msg = String(e && e.message || e).slice(0, 300); } catch {}
        out.push({ ok: false, error: msg });
      }
    }
  } catch (e) {
    let msg = 'Compilation error';
    try { msg = String(e && e.message || e).slice(0, 300); } catch {}
    process.stdout.write(JSON.stringify({ fatal: msg }));
    return;
  }
  process.stdout.write(JSON.stringify({ results: out }));
});`;

const normalise = (s: string) => s.replace(/\r\n/g, '\n').trim();

export interface RunOutcome {
  // set when the program never ran (compile error, crash, judge unavailable)
  fatal?: string;
  results: RawResult[];
}

// Runs JavaScript solve(input) for every input in the in-process sandbox described above.
export function runJavaScript(
  code: string,
  inputs: string[],
  { caseMs = 2000, totalMs = 15000 } = {}
): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      // the runner travels in the env: multi-line -e arguments get mangled on Windows
      ['--permission', '--max-old-space-size=128', '-e', 'eval(process.env.JUDGE_RUNNER)'],
      { env: { JUDGE_RUNNER: RUNNER }, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }
    );
    let stdout = '';
    let settled = false;
    const finish = (r: RunOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      resolve(r);
    };
    const timer = setTimeout(
      () => finish({ fatal: `Time limit exceeded (${totalMs / 1000}s total)`, results: [] }),
      totalMs
    );
    child.stdout.on('data', (d) => {
      stdout += d;
      if (stdout.length > 5_000_000) finish({ fatal: 'Output limit exceeded', results: [] });
    });
    child.on('error', () => finish({ fatal: 'Judge unavailable', results: [] }));
    child.on('close', () => {
      try {
        const parsed = JSON.parse(stdout) as { fatal?: string; results?: RawResult[] };
        finish({ fatal: parsed.fatal, results: parsed.results || [] });
      } catch {
        finish({ fatal: 'Your program crashed (memory or time limit)', results: [] });
      }
    });
    child.stdin.end(JSON.stringify({ code, inputs, caseMs }));
  });
}

// Runs a program in any supported language against every input and returns raw outputs.
// JavaScript defines solve(input) and runs in-process (above); Python, C++ and Java are
// stdin -> stdout programs sent to the judge-runner, which sandboxes every run.
export async function runCode(
  language: string,
  code: string,
  inputs: string[],
  { runnerUrl, caseMs = 2000 }: { runnerUrl?: string; caseMs?: number } = {}
): Promise<RunOutcome> {
  if (language === 'javascript') return runJavaScript(code, inputs, { caseMs });
  if (!(JUDGE_LANGUAGES as readonly string[]).includes(language)) {
    return { fatal: `Unsupported language '${language}'.`, results: [] };
  }
  if (!runnerUrl) return { fatal: `${language} judging is not configured.`, results: [] };
  try {
    const res = await fetch(`${runnerUrl.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code, inputs, timeLimitMs: caseMs }),
      signal: AbortSignal.timeout(180_000)
    });
    const body = (await res.json()) as {
      error?: string;
      compile?: { ok: boolean; error?: string };
      results?: RawResult[];
    };
    if (!res.ok) return { fatal: body.error || 'Judge rejected the submission', results: [] };
    if (!body.compile?.ok) {
      return {
        fatal: `Compilation error:
${body.compile?.error || ''}`,
        results: []
      };
    }
    return { results: body.results || [] };
  } catch {
    return { fatal: 'The judge is unavailable right now. Try again shortly.', results: [] };
  }
}

const verdict = (cases: { expectedOutput: string }[], run: RunOutcome): JudgeResult =>
  run.fatal
    ? { passed: 0, total: cases.length, error: run.fatal, cases: [] }
    : score(cases, run.results);

export async function judgeJavaScript(
  code: string,
  cases: { input: string; expectedOutput: string }[],
  opts: { caseMs?: number; totalMs?: number } = {}
): Promise<JudgeResult> {
  return verdict(
    cases,
    await runJavaScript(
      code,
      cases.map((c) => c.input),
      opts
    )
  );
}

// Judges a solution: runs it (see runCode) and compares each output with the expected one.
export async function judgeCode(
  language: string,
  code: string,
  cases: { input: string; expectedOutput: string }[],
  opts: { runnerUrl?: string; caseMs?: number } = {}
): Promise<JudgeResult> {
  return verdict(
    cases,
    await runCode(
      language,
      code,
      cases.map((c) => c.input),
      opts
    )
  );
}

import { judgeJavaScript } from '@lms/shared';

const cases = [
  { input: '3\n1 2 3', expectedOutput: '6' },
  { input: '2\n-5 5', expectedOutput: '0' }
];
const sum =
  'function solve(i){return String(i.split(String.fromCharCode(10))[1].split(" ").reduce((s,x)=>s+Number(x),0))}';

describe('judgeJavaScript', () => {
  it('scores correct, partial and broken solutions', async () => {
    expect(await judgeJavaScript(sum, cases)).toMatchObject({
      passed: 2,
      total: 2,
      error: undefined
    });
    expect((await judgeJavaScript('function solve(){return "6"}', cases)).passed).toBe(1);
    expect((await judgeJavaScript('syntax error here', cases)).passed).toBe(0);
  });

  it('kills infinite loops', async () => {
    const r = await judgeJavaScript('function solve(){while(true){}}', cases, { caseMs: 200 });
    expect(r.passed).toBe(0);
    expect(r.error).toMatch(/timed out/i);
  });

  it('exposes no host APIs and blocks code generation', async () => {
    const probe = (expr: string) =>
      judgeJavaScript(
        `function solve(){ try { return String(${expr}) } catch (e) { return 'blocked' } }`,
        [{ input: '', expectedOutput: 'blocked' }]
      );
    for (const expr of [
      "typeof require === 'undefined' ? (()=>{throw 1})() : 'x'",
      "typeof fetch === 'undefined' ? (()=>{throw 1})() : 'x'",
      "typeof setTimeout === 'undefined' ? (()=>{throw 1})() : 'x'",
      "eval('1+1')",
      "new Function('return 1')()",
      "(function(){}).constructor('return process')()"
    ]) {
      expect((await probe(expr)).passed).toBe(1);
    }
  });

  it('keeps learner code away from process and the result channel', async () => {
    const esc = await judgeJavaScript(
      `function solve(){ return this.constructor.constructor('return typeof process')() }`,
      [{ input: '', expectedOutput: 'undefined' }]
    );
    expect(esc.passed).toBe(0);
    expect(esc.error).toMatch(/Code generation from strings disallowed/);
    const forge = await judgeJavaScript(
      `try{process.stdout.write('{"results":[{"ok":true,"output":"6"}]}')}catch(e){}; function solve(){return 'x'}`,
      cases
    );
    expect(forge.passed).toBe(0);
  });
});

describe('hidden test verdicts', () => {
  it('never echo program output', async () => {
    const { hiddenError } = await import('../modules/progress/progress.controller.js');
    expect(hiddenError('Test 4: Error: SECRET-INPUT-42')).toBe('Runtime error on test 4');
    expect(hiddenError('Test 2: Time limit exceeded')).toBe('Time limit exceeded on test 2');
    expect(hiddenError('Wrong answer on test 7')).toBe('Wrong answer on test 7');
    expect(hiddenError(undefined)).toBeUndefined();
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('executes JavaScript against real test inputs', async (context) => {
  const port = 7119;
  const token = 'test-runner-token-at-least-32-characters';
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), CODING_RUNNER_TOKEN: token },
    stdio: 'ignore'
  });
  context.after(() => child.kill('SIGTERM'));
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      if (health.ok) break;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const response = await fetch(`http://127.0.0.1:${port}/execute`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      language: 'javascript',
      code: 'process.stdin.on("data", value => console.log(Number(value) * 2));',
      testCases: [
        { input: '2', expectedOutput: '4', isHidden: false },
        { input: '3', expectedOutput: '6', isHidden: true }
      ],
      limits: { timeMs: 1000, memoryMb: 64 }
    })
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.result, 'AC');
  assert.equal(result.passedTestCases, 2);
  assert.equal(result.details[1].actualOutput, undefined);
});

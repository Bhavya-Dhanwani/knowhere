import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('requires authentication and blocks private API targets', async (context) => {
  const port = 7120;
  const token = 'test-evaluation-token-at-least-32-characters';
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), EVALUATION_RUNNER_TOKEN: token },
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

  const unauthenticated = await fetch(`http://127.0.0.1:${port}/api`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiSpecUrl: 'http://127.0.0.1/openapi.json' })
  });
  assert.equal(unauthenticated.status, 404);

  const privateTarget = await fetch(`http://127.0.0.1:${port}/api`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ apiSpecUrl: 'http://127.0.0.1/openapi.json' })
  });
  assert.equal(privateTarget.status, 422);
  assert.match((await privateTarget.json()).error, /Private|loopback|link-local/);
});

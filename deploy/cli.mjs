#!/usr/bin/env node
// Knowhere deploy manager.
//   node deploy/cli.mjs ui [port]                     local web UI (default http://127.0.0.1:4545)
//   node deploy/cli.mjs deploy <aws|gcp|azure|local> key=value ...
//   node deploy/cli.mjs history
//   node deploy/cli.mjs update <environmentId> [key=value ...]   new code (and settings) on an environment
//   node deploy/cli.mjs rollback <deploymentId>
//   node deploy/cli.mjs destroy <environmentId>
import http from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './providers/index.mjs';
import { PLANS, PRICING_NOTE } from './plans.mjs';
import { bus, has } from './lib/run.mjs';
import { load, logFile } from './lib/state.mjs';
import { current, deploy, destroy, redeploy, rollback, setSecret } from './lib/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...args] = process.argv.slice(2);
const kv = (list) => Object.fromEntries(list.map((a) => a.split(/=(.*)/s).slice(0, 2)));

// follow a job's log in the terminal until it ends
const follow = (id) =>
  new Promise((resolve) => {
    process.stdout.write(readFileSync(logFile(id), 'utf8'));
    bus.on(id, (t) => (t === '\u0000end' ? resolve() : process.stdout.write(t)));
  });

if (cmd === 'deploy') {
  const provider = PROVIDERS[args[0]];
  if (!provider) throw new Error(`Platform must be one of: ${Object.keys(PROVIDERS).join(', ')}`);
  const cfg = Object.fromEntries(provider.fields.map((f) => [f.key, f.default || '']));
  await follow(deploy(args[0], { ...cfg, ...kv(args.slice(1)) }));
} else if (cmd === 'update') {
  await follow(redeploy(args[0], kv(args.slice(1))));
} else if (cmd === 'rollback') {
  await follow(rollback(args[0]));
} else if (cmd === 'destroy') {
  await follow(destroy(args[0]));
} else if (cmd === 'history') {
  const s = load();
  for (const d of s.deployments) {
    console.log(
      `${d.id}  ${d.kind.padEnd(8)} ${d.status.padEnd(9)} ${(d.envId || d.provider).padEnd(40)} ${(d.commit || '').slice(0, 10)}${d.error ? `  ${d.error}` : ''}`
    );
  }
} else if (cmd === 'ui') {
  serve(Number(args[0]) || 4545);
} else {
  console.log(
    readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n')
      .slice(1, 7)
      .join('\n')
  );
}

/* ------------------------------------------------------------------ local UI */
function serve(port) {
  // the UI can deploy and destroy infrastructure: loopback only, a per-session token on every
  // call, and a Host check so other websites (DNS rebinding) can't drive it through the browser
  const token = randomBytes(24).toString('hex');
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const tokenOk = (t) =>
    typeof t === 'string' &&
    t.length === token.length &&
    timingSafeEqual(Buffer.from(t), Buffer.from(token));

  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) =>
    new Promise((resolve) => {
      let b = '';
      req.on('data', (d) => (b += d.length < 1e6 ? d : ''));
      req.on('end', () => resolve(b ? JSON.parse(b) : {}));
    });
  const sse = (res) => {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive'
    });
    return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (!hosts.has(req.headers.host)) return send(res, 403, { error: 'forbidden host' });
      if (url.pathname === '/') {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy':
            "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
          'x-frame-options': 'DENY'
        });
        return res.end(readFileSync(path.join(here, 'ui.html'), 'utf8'));
      }
      if (url.pathname === '/favicon.ico') return res.writeHead(204).end();
      if (!tokenOk(req.headers['x-deploy-token'] || url.searchParams.get('token'))) {
        return send(res, 401, { error: 'bad token' });
      }
      try {
        if (url.pathname === '/api/state') {
          const providers = await Promise.all(
            Object.values(PROVIDERS).map(async (p) => ({
              id: p.id,
              label: p.label,
              // patterns as strings, so the form can check values before sending them
              fields: p.fields.map((f) => ({
                ...f,
                pattern: f.pattern?.source,
                flags: f.pattern?.flags
              })),
              secrets: !!p.putSecret,
              missing: (
                await Promise.all(p.requires.map(async (c) => ((await has(c)) ? null : c)))
              ).filter(Boolean)
            }))
          );
          return send(res, 200, {
            ...load(),
            running: current(),
            providers,
            plans: PLANS,
            pricingNote: PRICING_NOTE
          });
        }
        if (req.method === 'POST' && url.pathname === '/api/deploy') {
          const b = await readBody(req);
          return send(res, 200, { id: deploy(b.provider, b.cfg || {}) });
        }
        if (req.method === 'POST' && url.pathname === '/api/update') {
          const b = await readBody(req);
          return send(res, 200, { id: redeploy(b.envId, b.cfg || {}) });
        }
        if (req.method === 'POST' && url.pathname === '/api/secrets') {
          const b = await readBody(req);
          return send(res, 200, { id: setSecret(b.envId, b.name, b.values) });
        }
        if (url.pathname === '/api/secrets') {
          const env = load().environments[url.searchParams.get('env') || ''];
          const p = env && PROVIDERS[env.provider];
          if (!p?.listSecrets) return send(res, 200, { supported: false, secrets: [] });
          return send(res, 200, { supported: true, secrets: await p.listSecrets(env) });
        }
        if (req.method === 'POST' && url.pathname === '/api/rollback') {
          return send(res, 200, { id: rollback((await readBody(req)).id) });
        }
        if (req.method === 'POST' && url.pathname === '/api/destroy') {
          return send(res, 200, { id: destroy((await readBody(req)).envId) });
        }
        // a deployment's log: everything so far, then live lines until it ends
        if (url.pathname === '/api/logs') {
          const id = url.searchParams.get('id') || '';
          if (!/^[\w-]+$/.test(id) || !existsSync(logFile(id)))
            return send(res, 404, { error: 'no such log' });
          const emit = sse(res);
          emit('log', readFileSync(logFile(id), 'utf8'));
          if (current() !== id) return emit('end', {});
          const on = (t) => (t === '\u0000end' ? emit('end', {}) : emit('log', t));
          bus.on(id, on);
          req.on('close', () => bus.off(id, on));
          return;
        }
        // live application logs / pod status from the environment's cluster
        const env = load().environments[url.searchParams.get('env') || ''];
        if (url.pathname === '/api/pods' || url.pathname === '/api/app-logs') {
          if (!env?.kubeContext) return send(res, 404, { error: 'environment has no cluster' });
        }
        if (url.pathname === '/api/pods') {
          const kube = (what) =>
            new Promise((resolve) => {
              let o = '';
              const p = spawn(
                'kubectl',
                ['get', what, '--context', env.kubeContext, '-o', 'json'],
                {
                  shell: process.platform === 'win32'
                }
              );
              p.stdout.on('data', (d) => (o += d));
              p.on('close', () => resolve(JSON.parse(o || '{"items":[]}').items || []));
            });
          const [podItems, deployItems] = await Promise.all([kube('pods'), kube('deployments')]);
          const pods = podItems.map((p) => ({
            name: p.metadata.name,
            app: p.metadata.labels?.app || '',
            phase: p.status.phase,
            ready: (p.status.containerStatuses || []).every((c) => c.ready),
            restarts: (p.status.containerStatuses || []).reduce((t, c) => t + c.restartCount, 0),
            startedAt: p.status.startTime
          }));
          return send(res, 200, {
            pods,
            deployments: deployItems.map((d) => d.metadata.name).sort()
          });
        }
        if (url.pathname === '/api/app-logs') {
          const target = url.searchParams.get('target') || '';
          if (!/^[\w./-]+$/.test(target)) return send(res, 400, { error: 'bad target' });
          const emit = sse(res);
          const p = spawn(
            'kubectl',
            [
              'logs',
              '-f',
              '--tail=300',
              '--all-containers',
              '--prefix',
              '--context',
              env.kubeContext,
              target
            ],
            { shell: process.platform === 'win32' }
          );
          p.stdout.on('data', (d) => emit('log', String(d)));
          p.stderr.on('data', (d) => emit('log', String(d)));
          p.on('close', () => emit('end', {}));
          req.on('close', () => p.kill());
          return;
        }
        send(res, 404, { error: 'not found' });
      } catch (error) {
        send(res, 400, { error: error.message });
      }
    })
    .on('error', (error) => {
      if (error.code !== 'EADDRINUSE') throw error;
      console.error(
        `Port ${port} is already in use, most likely by a deploy manager that is still running.\n` +
          `Close that terminal (or stop that node process), or start this one on another port:\n` +
          `  node deploy/cli.mjs ui ${port + 1}`
      );
      process.exit(1);
    })
    .listen(port, '127.0.0.1', () => {
      console.log(`Knowhere deploy manager: http://127.0.0.1:${port}/#token=${token}`);
    });
}

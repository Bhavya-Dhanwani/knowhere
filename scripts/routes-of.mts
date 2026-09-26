// Prints the real routes of one service as JSON: `tsx scripts/routes-of.mts packages/course-service`.
// Loads the service's own express, records every mount path, builds the app and walks its router.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.resolve(process.argv[2]);
const express = createRequire(path.join(dir, 'package.json'))('express');

// Express 5 layers keep no mount path, so remember it when routers are mounted
// express.Router() returns a function whose prototype is a Router instance; patch Router.prototype
const RouterProto = Object.getPrototypeOf(Object.getPrototypeOf(express.Router()));
const originalUse = RouterProto.use;
RouterProto.use = function (this: { stack: unknown[]; __mounts?: Map<unknown, string> }, ...args: unknown[]) {
  const mount = typeof args[0] === 'string' ? args[0] : '/';
  const before = this.stack.length;
  const result = originalUse.apply(this, args);
  // key by the new layer: one router can be mounted under several paths
  for (const layer of this.stack.slice(before)) (this.__mounts ||= new Map()).set(layer, mount);
  return result;
};

process.env.NODE_ENV ||= 'development';
const { default: createApp } = await import(pathToFileURL(path.join(dir, 'src/app.ts')).href);
const app = createApp();
const root = app.router;

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: { name: string } }[] }; handle: { stack?: Layer[] } };
const routes: { method: string; path: string; handlers: string[]; auth: boolean }[] = [];
// a route is protected when an auth middleware sits in its own stack or earlier in a parent router
const isAuth = (name: string) => /auth/i.test(name);
const join = (a: string, b: string) => (a + '/' + b).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

function walk(router: { stack: Layer[]; __mounts?: Map<unknown, string> }, prefix: string, authed = false) {
  for (const layer of router.stack) {
    const name = (layer.handle as { name?: string }).name || '';
    if (!layer.route && !layer.handle?.stack && isAuth(name)) authed = true;
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) {
        if (m === '_all') continue;
        routes.push({
          method: m.toUpperCase(),
          path: join(prefix, layer.route.path),
          handlers: layer.route.stack.map((s) => s.handle.name),
          auth: authed || layer.route.stack.some((s) => isAuth(s.handle.name))
        });
      }
    } else if (layer.handle?.stack) {
      walk(layer.handle as never, join(prefix, router.__mounts?.get(layer) ?? ''), authed);
    }
  }
}
walk(root, '');
// markers: some services log to stdout while booting
process.stdout.write(`@@ROUTES@@${JSON.stringify(routes)}@@END@@`);
process.exit(0);

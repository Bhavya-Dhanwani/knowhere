// Regenerates the OpenAPI document served at /openapi.json from the services' real routers:
//   pnpm docs:api
// Every path, method, path parameter and auth requirement comes from the running Express apps
// (scripts/routes-of.mts), summaries come from the routers' `@desc` comments or handler names,
// and request/response details are carried over from the previous document where a route still
// exists. Routes that no longer exist disappear, so the reference cannot drift from the code.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const OUT = path.join(root, 'packages/auth-service/src/shared/openapi.ts');

const SERVICES: { dir: string; tag: string; description: string }[] = [
  { dir: 'auth-service', tag: 'Auth', description: 'Sign-up, login, sessions, password reset and platform roles.' },
  { dir: 'user-service', tag: 'Users', description: 'Profiles, course memberships (enrollment) and competencies.' },
  { dir: 'course-service', tag: 'Courses', description: 'Courses, bottom-up authoring (files, MCQs, coding questions, submodules, modules), encrypted video, progress and judging.' },
  { dir: 'chat-service', tag: 'Community', description: 'Per-course communities: channels, messages, threads, files, notifications and voice tokens.' },
  { dir: 'coding-service', tag: 'Coding', description: 'Standalone coding problems and asynchronous submissions.' },
  { dir: 'mcq-service', tag: 'MCQ', description: 'Standalone multiple-choice question bank.' },
  { dir: 'media-service', tag: 'Media', description: 'Standalone media uploads.' },
  { dir: 'project-review-service', tag: 'Project reviews', description: 'AI-assisted project review events and submissions.' }
];

type Route = { method: string; path: string; handlers: string[]; auth: boolean };
type Op = Record<string, unknown>;

const previous = (() => {
  if (!existsSync(OUT)) return {} as Record<string, Record<string, Op>>;
  const src = readFileSync(OUT, 'utf8');
  const json = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
  try {
    return (JSON.parse(json).paths || {}) as Record<string, Record<string, Op>>;
  } catch {
    // the hand-written document was a TS object literal; evaluate it once to migrate
    const literal = src.slice(src.indexOf('= {') + 2, src.lastIndexOf('}') + 1);
    return (new Function(`return (${literal});`)().paths || {}) as Record<string, Record<string, Op>>;
  }
})();

const toOpenApi = (p: string) => p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
const humanize = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

// `@route METHOD /path` ... `@desc text` ... `@access text` blocks in router files
function routeComments(dir: string) {
  const found = new Map<string, { desc?: string; access?: string }>();
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.router.ts')) {
        const src = readFileSync(f, 'utf8');
        for (const m of src.matchAll(/@route\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)([^]*?)(?=@route|router\.|$)/g)) {
          const desc = m[3].match(/@desc\s+([^\n*]+)/)?.[1]?.trim();
          const inline = m[3].match(/^\s*[—-]\s*([^\n]+)/)?.[1]?.trim();
          const access = m[3].match(/@access\s+([^\n*]+)/)?.[1]?.trim();
          found.set(`${m[1]} ${toOpenApi(m[2])}`, { desc: desc || inline, access });
        }
      }
    }
  };
  walk(path.join(root, 'packages', dir, 'src'));
  return found;
}

const paths: Record<string, Record<string, Op>> = {};
let total = 0;
for (const svc of SERVICES) {
  const pkg = path.join(root, 'packages', svc.dir);
  const tsx = path.join(pkg, 'node_modules/.bin', process.platform === 'win32' ? 'tsx.CMD' : 'tsx');
  const raw = String(
    execFileSync(tsx, [path.join(root, 'scripts/routes-of.mts'), pkg], {
      cwd: pkg,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
      maxBuffer: 16 * 1024 * 1024
    })
  );
  const routes = JSON.parse(raw.slice(raw.indexOf('@@ROUTES@@') + 10, raw.indexOf('@@END@@'))) as Route[];
  const comments = routeComments(svc.dir);

  for (const r of routes) {
    if (/\/(health|openapi\.json)$/.test(r.path) || !r.path.startsWith('/api/')) continue;
    const p = toOpenApi(r.path);
    const method = r.method.toLowerCase();
    const old = previous[p]?.[method] || {};
    const note = comments.get(`${r.method} ${p}`);
    const handler = [...r.handlers].reverse().find((h) => h && !/^(bound |anonymous)/.test(h) && !/^(auth|validate|middleware|require[A-Z]\w*)$|Middleware$|^serviceOrUserAuth/.test(h));
    const params = [...p.matchAll(/\{([^}]+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' }
    }));
    (paths[p] ||= {})[method] = {
      ...old,
      tags: [svc.tag],
      summary: note?.desc || (old.summary as string) || (handler ? humanize(handler) : `${r.method} ${p}`),
      ...(note?.access ? { description: `Access: ${note.access}` } : {}),
      operationId: `${svc.tag.replace(/\W/g, '')}_${handler || method + p.replace(/\W+/g, '_')}`,
      ...(params.length ? { parameters: [...params, ...((old.parameters as Op[]) || []).filter((x) => x.in !== 'path')] } : {}),
      ...(r.auth ? { security: [{ bearerAuth: [] }] } : { security: [] }),
      responses: (old.responses as Op) || {
        '200': { description: 'Success (`{ success, message, data }`)' },
        ...(r.auth ? { '401': { description: 'Missing or invalid access token' } } : {})
      }
    };
    total++;
  }
}

const doc = {
  openapi: '3.1.0',
  info: {
    title: 'Knowhere LMS Platform API',
    version: '2.0.0',
    description:
      'Generated from the services\' routers by `pnpm docs:api`. Access tokens are RS256 JWTs issued by the auth service; send them as `Authorization: Bearer <token>`.'
  },
  servers: [{ url: '/', description: 'Same origin (ingress routes /api/* to each service)' }],
  tags: SERVICES.map((s) => ({ name: s.tag, description: s.description })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT (RS256)' } }
  },
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)))
};

writeFileSync(
  OUT,
  `// GENERATED by scripts/gen-openapi.mts (pnpm docs:api). Do not edit by hand.\nexport const openApiDocument = ${JSON.stringify(doc, null, 2)};\n`
);
console.log(`openapi: ${total} operations across ${SERVICES.length} services -> ${path.relative(root, OUT)}`);

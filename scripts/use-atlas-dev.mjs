// Points every local service at `<service>_dev` databases on the Atlas cluster from
// k8s/secrets.yml (secret `database`). Writes only gitignored .env files and prints no secrets.
// Usage: node scripts/use-atlas-dev.mjs   -> updates packages/*/.env
// Seed the same databases (bash):
//   MONGO_BASE_URI="$(node scripts/use-atlas-dev.mjs --print-base-for-seed)" MONGO_DB_SUFFIX=_dev pnpm seed
import { Resolver } from 'node:dns/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const secrets = readFileSync('k8s/secrets.yml', 'utf8');
const doc = secrets.split(/^---$/m).find((d) => /name: database/.test(d));
const uri = doc?.match(/^\s+AUTH_DB:\s*['"]?([^'"\s]+)/m)?.[1];
if (!uri) throw new Error('AUTH_DB not found in k8s/secrets.yml');
const u = new URL(uri);

// mongodb+srv needs an SRV lookup at every connect, and Node on this machine asks a local DNS
// proxy that refuses SRV queries. Resolve the seed list once (public resolver) and write a plain
// mongodb:// URI with the same hosts and options instead.
let hosts = u.host;
let options = 'retryWrites=true&w=majority';
if (u.protocol === 'mongodb+srv:') {
  const resolver = new Resolver();
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const srv = await resolver.resolveSrv(`_mongodb._tcp.${u.hostname}`);
  const txt = (await resolver.resolveTxt(u.hostname).catch(() => [])).flat().join('&');
  hosts = srv.map((r) => `${r.name}:${r.port}`).join(',');
  options = [txt, 'tls=true', options].filter(Boolean).join('&');
}
const auth = `${u.username}:${u.password}@`;
export const base = `mongodb://${auth}${hosts}`;
const withDb = (db) => `${base}/${db}?${options}`;

const DBS = {
  'auth-service': 'authService_dev',
  'user-service': 'userService_dev',
  'course-service': 'courseService_dev',
  'coding-service': 'codingService_dev',
  'mcq-service': 'mcqService_dev',
  'media-service': 'mediaService_dev',
  'project-review-service': 'projectReviewService_dev'
};

function setVars(file, vars) {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(vars)) {
    const line = `${k}=${v}`;
    text = new RegExp(`^${k}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${k}=.*$`, 'm'), line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  writeFileSync(file, text);
}

if (process.argv[2] === '--print-base-for-seed') {
  // seed inserts `/<db>` before the query string
  process.stdout.write(`${base}?${options}`);
} else {
  for (const [svc, db] of Object.entries(DBS)) setVars(`packages/${svc}/.env`, { MONGO_URI: withDb(db) });
  setVars('packages/chat-service/.env', { MONGO_URI: `${base}/?${options}`, MONGO_DB_NAME: 'chatService_dev' });
  console.log(`8 services now use *_dev databases on the Atlas cluster (${Object.keys(DBS).length + 1} .env files updated).`);
}

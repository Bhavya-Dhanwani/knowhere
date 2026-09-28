// Copies your secret values from k8s/secrets.yml into AWS Secrets Manager (knowhere/<name>), once,
// after the first `cdk deploy`. External Secrets then syncs them into the cluster.
// Prints secret names and key counts only, never values.
//
//   node infra/scripts/push-secrets.mjs            (uses your default AWS profile/region)
//   AWS_REGION=ap-south-1 node infra/scripts/push-secrets.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const yaml = createRequire(import.meta.url)(path.join(here, '../node_modules/js-yaml'));
const repo = path.resolve(here, '../..');

// values the stack owns (buckets, Redis endpoint, generated LiveKit keys)
const STACK_MANAGED = new Set(['media-secrets', 'redis', 'livekit']);

const docs = yaml.loadAll(readFileSync(path.join(repo, 'k8s/secrets.yml'), 'utf8')).filter(Boolean);
const tmp = mkdtempSync(path.join(tmpdir(), 'knowhere-secrets-'));
try {
  for (const doc of docs) {
    const name = doc?.metadata?.name;
    if (doc?.kind !== 'Secret' || !name || STACK_MANAGED.has(name)) continue;
    const data = { ...(doc.stringData || {}) };
    for (const [k, v] of Object.entries(doc.data || {})) data[k] = Buffer.from(v, 'base64').toString();
    const file = path.join(tmp, `${name}.json`);
    writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
    // the value travels in a file, never on the command line (process lists, shell history)
    execFileSync(
      'aws',
      ['secretsmanager', 'put-secret-value', '--secret-id', `knowhere/${name}`, '--secret-string', `file://${file}`],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );
    console.log(`✓ knowhere/${name} (${Object.keys(data).length} keys)`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log('\nExternal Secrets refreshes hourly; to apply now: kubectl annotate externalsecret --all force-sync=$(date +%s) --overwrite');

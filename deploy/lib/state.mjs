import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { run } from './run.mjs';

// Local deployment history: deploy/.state (gitignored)
//   history.json          environments + every deployment (newest first)
//   logs/<id>.log         full output of each deployment
//   artifacts/<id>/       images.json, outputs.json, ... what that deployment produced
//   worktrees/<commit>/   checked-out source snapshots used for deploys and rollbacks
// Each deployment's source is pinned as a git ref (refs/deploys/<id>), uncommitted changes
// included, so a rollback redeploys exactly what ran, whatever the working tree looks like now.

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const STATE = path.join(REPO, 'deploy', '.state');
const HISTORY = path.join(STATE, 'history.json');
for (const d of ['logs', 'artifacts', 'worktrees']) mkdirSync(path.join(STATE, d), { recursive: true });

export function load() {
  return existsSync(HISTORY)
    ? JSON.parse(readFileSync(HISTORY, 'utf8'))
    : { environments: {}, deployments: [] };
}

export function save(state) {
  writeFileSync(HISTORY + '.tmp', JSON.stringify(state, null, 2));
  // write-then-rename: a crash mid-write never corrupts the history
  copyFileSync(HISTORY + '.tmp', HISTORY);
  rmSync(HISTORY + '.tmp');
}

export function update(fn) {
  const state = load();
  const result = fn(state);
  save(state);
  return result;
}

export const newId = () =>
  `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${randomBytes(2).toString('hex')}`;
export const logFile = (id) => path.join(STATE, 'logs', `${id}.log`);
export const artifacts = (id) => {
  const dir = path.join(STATE, 'artifacts', id);
  mkdirSync(dir, { recursive: true });
  return dir;
};

// Snapshot of the working tree (tracked + untracked, minus .gitignore'd files such as secrets),
// committed without touching the real index or HEAD, and kept alive by a ref.
export async function snapshot(id) {
  const index = path.join(STATE, `index-${id}`);
  const env = { GIT_INDEX_FILE: index };
  const git = (args, extra = {}) => run('git', args, { cwd: REPO, quiet: true, ...extra });
  try {
    const head = (await git(['rev-parse', 'HEAD'])).trim();
    await git(['read-tree', 'HEAD'], { env });
    await git(['add', '-A'], { env });
    const tree = (await git(['write-tree'], { env })).trim();
    const headTree = (await git(['rev-parse', 'HEAD^{tree}'])).trim();
    const commit = (
      await git(['commit-tree', tree, '-p', head, '-m', `deploy snapshot ${id}`], {
        env: { GIT_AUTHOR_NAME: 'deploy', GIT_AUTHOR_EMAIL: 'deploy@local', GIT_COMMITTER_NAME: 'deploy', GIT_COMMITTER_EMAIL: 'deploy@local' }
      })
    ).trim();
    await git(['update-ref', `refs/deploys/${id}`, commit]);
    return { commit, head, dirty: tree !== headTree };
  } finally {
    rmSync(index, { force: true });
  }
}

// A checked-out copy of a snapshot to build/deploy from. Secrets are gitignored, so the live
// repo's k8s/secrets.yml is copied in (it never enters git or the history).
export async function worktree(commit) {
  const dir = path.join(STATE, 'worktrees', commit.slice(0, 12));
  if (!existsSync(dir)) {
    await run('git', ['worktree', 'add', '--detach', dir, commit], { cwd: REPO, quiet: true });
  }
  const secrets = path.join(REPO, 'k8s', 'secrets.yml');
  if (existsSync(secrets)) copyFileSync(secrets, path.join(dir, 'k8s', 'secrets.yml'));
  return dir;
}

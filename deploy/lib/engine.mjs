import { appendFileSync, writeFileSync } from 'node:fs';
import { PROVIDERS } from '../providers/index.mjs';
import { bus, has, run } from './run.mjs';
import {
  artifacts,
  dropSecrets,
  load,
  logFile,
  newId,
  REPO,
  snapshot,
  update,
  worktree
} from './state.mjs';

// ponytail: one job at a time across all environments; parallel deploys to different clouds
// would need a lock per environment instead
let running = null;
export const current = () => running;

// a job runs inside the process that started it (its pid is recorded); if that process is gone
// (crash, reboot, killed terminal) the job is marked interrupted instead of "running" forever
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
update((s) => {
  for (const d of s.deployments) {
    if (d.status === 'running' && !(d.pid && alive(d.pid))) {
      Object.assign(d, {
        status: 'interrupted',
        error:
          'The deploy manager stopped while this was running. Check the log, then deploy or roll back again.',
        finishedAt: new Date().toISOString()
      });
    }
  }
});

export function start(job) {
  if (running) throw new Error(`Deployment ${running} is still running.`);
  const id = newId();
  running = id;
  writeFileSync(logFile(id), '');
  execute(id, job).finally(() => {
    running = null;
    bus.emit(id, '\u0000end');
  });
  return id;
}

async function execute(id, job) {
  const log = logFile(id);
  const note = (text) => {
    const line = `\n» ${text}\n`;
    appendFileSync(log, line);
    bus.emit(id, line);
  };
  const provider = PROVIDERS[job.provider];
  // the UI's progress view: every step this job goes through, marked in the log as "» step: <id>"
  const step = (s) => note(`step: ${s}`);
  const steps = (fresh) => [
    { id: 'check', label: 'Check tools and sign-in' },
    ...(job.kind === 'secrets' ? [] : [{ id: 'source', label: 'Snapshot the code' }]),
    ...(fresh && !['destroy', 'secrets'].includes(job.kind)
      ? [{ id: 'provision', label: provider?.provisionLabel || 'Set up the environment' }]
      : []),
    ...(provider?.steps?.(job) || [])
  ];
  const record = {
    id,
    kind: job.kind, // deploy | rollback | destroy | secrets
    provider: job.provider,
    cfg: job.cfg,
    steps: steps(false),
    ...(job.secretName ? { secretName: job.secretName } : {}),
    status: 'running',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ...(job.rollbackOf ? { rollbackOf: job.rollbackOf.id } : {})
  };
  update((s) => s.deployments.unshift(record));
  const patch = (fields) =>
    update((s) =>
      Object.assign(
        s.deployments.find((d) => d.id === id),
        fields
      )
    );

  let source;
  try {
    step('check');
    if (!provider) throw new Error(`Unknown platform "${job.provider}".`);
    const missing = [];
    for (const cli of provider.requires) if (!(await has(cli))) missing.push(cli);
    if (missing.length) throw new Error(`Install and sign in to: ${missing.join(', ')}`);

    const penv = provider.env?.(job.cfg) || {};
    const identity = await provider.identity(job.cfg, {
      run: (c, a, o = {}) => run(c, a, { ...o, env: { ...penv, ...o.env } })
    });
    const envId = provider.envId(identity, job.cfg);
    note(`${job.kind} on ${provider.label} as ${identity.display}`);
    patch({ envId, identity: { display: identity.display, principal: identity.principal } });

    if (job.rollbackOf && job.rollbackOf.envId !== envId) {
      throw new Error(
        `Deployment ${job.rollbackOf.id} belongs to ${job.rollbackOf.envId}, but these credentials point at ${envId}. Sign in to that environment first.`
      );
    }
    const envBefore = load().environments[envId];
    // a new environment, or different credentials than last time: set everything up again and
    // redeploy every resource, not just the changes
    const fresh = !envBefore || envBefore.identity?.principal !== identity.principal;
    patch({ steps: steps(fresh) });
    if (job.kind === 'secrets') {
      if (!envBefore) throw new Error(`Unknown environment ${envId}.`);
      await provider.putSecret(
        {
          cfg: job.cfg,
          env: envBefore,
          note,
          step,
          run: (c, a, o = {}) => run(c, a, { cwd: REPO, ...o, env: { ...penv, ...o.env }, log, id })
        },
        job.secretName,
        job.values
      );
      patch({ status: 'succeeded', finishedAt: new Date().toISOString() });
      note('secrets saved');
      return;
    }
    if (fresh && job.kind !== 'destroy') {
      note(
        envBefore
          ? `Credentials changed (was ${envBefore.identity?.display}): running a complete new deployment`
          : 'New environment: provisioning from scratch'
      );
    }

    // source: a fresh snapshot of the working tree, or the one recorded by the target deployment
    step('source');
    if (job.rollbackOf)
      source = {
        commit: job.rollbackOf.commit,
        head: job.rollbackOf.head,
        dirty: job.rollbackOf.dirty
      };
    else if (job.kind === 'destroy') source = { commit: envBefore?.commit };
    else source = await snapshot(id);
    if (!source.commit) throw new Error('No recorded source for this environment.');
    patch({ commit: source.commit, head: source.head, dirty: source.dirty });
    note(
      `source ${source.commit.slice(0, 12)}${source.dirty ? ' (includes uncommitted changes)' : ''}`
    );
    const cwd = await worktree(source.commit);

    const ctx = {
      id,
      provider: provider.id,
      cfg: job.cfg,
      identity,
      fresh,
      cwd,
      step,
      art: artifacts(id),
      rollbackOf: job.rollbackOf,
      note,
      run: (c, a, o = {}) => run(c, a, { cwd, ...o, env: { ...penv, ...o.env }, log, id })
    };

    if (job.kind === 'destroy') {
      await provider.destroy(ctx);
      update((s) => {
        s.environments[envId] = {
          ...s.environments[envId],
          status: 'destroyed',
          destroyedAt: new Date().toISOString()
        };
      });
    } else {
      if (fresh) {
        step('provision');
        await provider.provision(ctx);
      }
      const result = (await provider.deploy(ctx)) || {};
      patch({ images: result.images, outputs: result.outputs, kubeContext: result.kubeContext });
      update((s) => {
        s.environments[envId] = {
          envId,
          provider: provider.id,
          label: provider.label,
          identity: {
            display: identity.display,
            principal: identity.principal,
            account: identity.account
          },
          cfg: job.cfg,
          kubeContext: result.kubeContext,
          outputs: result.outputs,
          commit: source.commit,
          current: id,
          status: 'live',
          createdAt: envBefore?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });
    }
    patch({ status: 'succeeded', finishedAt: new Date().toISOString() });
    note(`${job.kind} succeeded`);
  } catch (error) {
    patch({ status: 'failed', error: error.message, finishedAt: new Date().toISOString() });
    note(`FAILED: ${error.message}`);
  } finally {
    // the plaintext secrets copy only lives for the duration of the job
    dropSecrets(source?.commit);
  }
}

/**
 * Rejects a config before anything runs: required fields present, and every filled field in the
 * shape it must have (a value in the wrong box, e.g. an IAM ARN as the domain, would otherwise
 * deploy and break things quietly: that domain becomes the S3 buckets' CORS origin).
 */
export function checkConfig(provider, cfg) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Unknown provider "${provider}".`);
  const problems = p.fields.flatMap((f) => {
    const v = String(cfg[f.key] ?? '').trim();
    if (!v) return f.required ? [`${f.label}: required`] : [];
    return f.pattern && !f.pattern.test(v)
      ? [`${f.label}: "${v}" is not ${f.hint || 'valid'}`]
      : [];
  });
  if (problems.length) throw new Error(`Fix these settings first:\n- ${problems.join('\n- ')}`);
}

export function deploy(provider, cfg) {
  checkConfig(provider, cfg);
  return start({ kind: 'deploy', provider, cfg });
}

// same environment, same settings (plus any changes, e.g. a domain): deploys the current code
export function redeploy(envId, changes = {}) {
  const env = load().environments[envId];
  if (!env) throw new Error(`Unknown environment ${envId}.`);
  const cfg = { ...env.cfg, ...changes };
  checkConfig(env.provider, cfg);
  return start({ kind: 'deploy', provider: env.provider, cfg });
}

// values only ever live in this job's memory: never in the history, the log or a file
export function setSecret(envId, secretName, values) {
  const env = load().environments[envId];
  if (!env || env.status === 'destroyed') throw new Error(`No live environment ${envId}.`);
  if (!PROVIDERS[env.provider].putSecret)
    throw new Error('On this platform, secrets come from k8s/secrets.yml: edit it, then Update.');
  if (!/^[\w-]+$/.test(secretName || '')) throw new Error('Bad secret name.');
  const clean = Object.fromEntries(
    Object.entries(values || {}).filter(
      ([k, v]) => /^[A-Za-z_][\w.-]*$/.test(k) && typeof v === 'string' && v !== ''
    )
  );
  if (!Object.keys(clean).length) throw new Error('Enter at least one value.');
  return start({
    kind: 'secrets',
    provider: env.provider,
    cfg: env.cfg,
    secretName,
    values: clean
  });
}

export function rollback(deploymentId) {
  const target = load().deployments.find((d) => d.id === deploymentId);
  if (!target || target.kind === 'destroy' || target.status !== 'succeeded' || !target.commit) {
    throw new Error('Only a successful deployment can be rolled back to.');
  }
  return start({
    kind: 'rollback',
    provider: target.provider,
    cfg: target.cfg,
    rollbackOf: target
  });
}

export function destroy(envId) {
  const env = load().environments[envId];
  if (!env) throw new Error(`Unknown environment ${envId}.`);
  return start({ kind: 'destroy', provider: env.provider, cfg: env.cfg });
}

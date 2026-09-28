import { appendFileSync, writeFileSync } from 'node:fs';
import { PROVIDERS } from '../providers/index.mjs';
import { bus, has, run } from './run.mjs';
import { artifacts, load, logFile, newId, snapshot, update, worktree } from './state.mjs';

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
        error: 'The deploy manager stopped while this was running. Check the log, then deploy or roll back again.',
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
  const record = {
    id,
    kind: job.kind, // deploy | rollback | destroy
    provider: job.provider,
    cfg: job.cfg,
    status: 'running',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ...(job.rollbackOf ? { rollbackOf: job.rollbackOf.id } : {})
  };
  update((s) => s.deployments.unshift(record));
  const patch = (fields) =>
    update((s) => Object.assign(s.deployments.find((d) => d.id === id), fields));

  try {
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
    if (fresh && job.kind !== 'destroy') {
      note(
        envBefore
          ? `Credentials changed (was ${envBefore.identity?.display}): running a complete new deployment`
          : 'New environment: provisioning from scratch'
      );
    }

    // source: a fresh snapshot of the working tree, or the one recorded by the target deployment
    let source;
    if (job.rollbackOf) source = { commit: job.rollbackOf.commit, head: job.rollbackOf.head, dirty: job.rollbackOf.dirty };
    else if (job.kind === 'destroy') source = { commit: envBefore?.commit };
    else source = await snapshot(id);
    if (!source.commit) throw new Error('No recorded source for this environment.');
    patch({ commit: source.commit, head: source.head, dirty: source.dirty });
    note(`source ${source.commit.slice(0, 12)}${source.dirty ? ' (includes uncommitted changes)' : ''}`);
    const cwd = await worktree(source.commit);

    const ctx = {
      id,
      provider: provider.id,
      cfg: job.cfg,
      identity,
      fresh,
      cwd,
      art: artifacts(id),
      rollbackOf: job.rollbackOf,
      note,
      run: (c, a, o = {}) => run(c, a, { cwd, ...o, env: { ...penv, ...o.env }, log, id })
    };

    if (job.kind === 'destroy') {
      await provider.destroy(ctx);
      update((s) => {
        s.environments[envId] = { ...s.environments[envId], status: 'destroyed', destroyedAt: new Date().toISOString() };
      });
    } else {
      if (fresh) await provider.provision(ctx);
      const result = (await provider.deploy(ctx)) || {};
      patch({ images: result.images, outputs: result.outputs, kubeContext: result.kubeContext });
      update((s) => {
        s.environments[envId] = {
          envId,
          provider: provider.id,
          label: provider.label,
          identity: { display: identity.display, principal: identity.principal, account: identity.account },
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
  }
}

export function deploy(provider, cfg) {
  return start({ kind: 'deploy', provider, cfg });
}

export function rollback(deploymentId) {
  const target = load().deployments.find((d) => d.id === deploymentId);
  if (!target || target.kind === 'destroy' || target.status !== 'succeeded' || !target.commit) {
    throw new Error('Only a successful deployment can be rolled back to.');
  }
  return start({ kind: 'rollback', provider: target.provider, cfg: target.cfg, rollbackOf: target });
}

export function destroy(envId) {
  const env = load().environments[envId];
  if (!env) throw new Error(`Unknown environment ${envId}.`);
  return start({ kind: 'destroy', provider: env.provider, cfg: env.cfg });
}

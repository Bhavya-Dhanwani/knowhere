import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RepositorySnapshot } from './types.js';
import { TrustedProcessRunner } from './trusted-process.runner.js';

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,199}$/;
const SAFE_SHA = /^[a-fA-F0-9]{7,40}$/;

export class RepositoryRunner {
  public static validateRepositoryUrl(repositoryUrl: string): void {
    const value = repositoryUrl.trim();
    const httpsGitHub = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i;
    const sshGitHub = /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i;
    if (!httpsGitHub.test(value) && !sshGitHub.test(value)) {
      throw new Error('Only canonical HTTPS or SSH GitHub repository URLs are supported.');
    }
  }

  public static async acquire(
    submissionId: string,
    repositoryUrl: string,
    branch = 'main',
    requestedCommit?: string
  ): Promise<RepositorySnapshot> {
    this.validateRepositoryUrl(repositoryUrl);
    if (!SAFE_REF.test(branch) || branch.startsWith('-') || branch.includes('..')) {
      throw new Error(`Unsafe or invalid Git branch: ${branch}`);
    }
    if (requestedCommit && !SAFE_SHA.test(requestedCommit)) {
      throw new Error('Requested commit must be a 7-40 character hexadecimal Git SHA.');
    }

    const root = process.env.EVALUATION_WORKSPACE_ROOT || os.tmpdir();
    await fs.mkdir(root, { recursive: true });
    const workspacePath = await fs.mkdtemp(path.join(root, `evaluation-${submissionId}-`));
    const disabledHooks = path.join(workspacePath, 'disabled-git-hooks');
    await fs.mkdir(disabledHooks, { recursive: true });
    const localPath = path.join(workspacePath, 'repository');

    const clone = await TrustedProcessRunner.run(
      'git-clone',
      'git',
      [
        '-c',
        `core.hooksPath=${disabledHooks}`,
        'clone',
        '--no-checkout',
        '--filter=blob:none',
        '--single-branch',
        '--branch',
        branch,
        '--',
        repositoryUrl,
        localPath
      ],
      {
        timeoutMs: Number(process.env.REPOSITORY_CLONE_TIMEOUT_MS || 120_000),
        env: {
          GIT_TERMINAL_PROMPT: '0',
          GIT_LFS_SKIP_SMUDGE: '1',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: os.devNull
        }
      }
    );

    if (clone.execution.status !== 'SUCCEEDED') {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(`Repository clone failed: ${clone.execution.error || 'unknown error'}`);
    }

    const target = requestedCommit || `refs/remotes/origin/${branch}`;
    const resolveCommit = await TrustedProcessRunner.run(
      'git-rev-parse',
      'git',
      ['-C', localPath, 'rev-parse', '--verify', `${target}^{commit}`],
      { timeoutMs: 15_000 }
    );
    if (resolveCommit.execution.status !== 'SUCCEEDED') {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(`Unable to resolve requested repository commit: ${target}`);
    }

    const commitSha = resolveCommit.stdout.trim().split(/\s+/)[0];
    const checkout = await TrustedProcessRunner.run(
      'git-checkout',
      'git',
      ['-C', localPath, '-c', `core.hooksPath=${disabledHooks}`, 'checkout', '--detach', commitSha],
      {
        timeoutMs: 60_000,
        env: {
          GIT_LFS_SKIP_SMUDGE: '1',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: os.devNull
        }
      }
    );
    if (checkout.execution.status !== 'SUCCEEDED') {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(`Unable to checkout commit ${commitSha}: ${checkout.execution.error}`);
    }

    return {
      repositoryUrl,
      requestedBranch: branch,
      commitSha,
      localPath,
      workspacePath,
      clonedAt: new Date().toISOString(),
      clone: clone.execution
    };
  }

  public static async cleanup(snapshot: RepositorySnapshot): Promise<void> {
    const resolved = path.resolve(snapshot.workspacePath);
    const configuredRoot = path.resolve(process.env.EVALUATION_WORKSPACE_ROOT || os.tmpdir());
    if (!resolved.startsWith(`${configuredRoot}${path.sep}`)) {
      throw new Error(`Refusing to remove evaluation path outside workspace root: ${resolved}`);
    }
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

export default RepositoryRunner;

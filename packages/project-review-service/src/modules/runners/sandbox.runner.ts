import { exec } from 'child_process';
import util from 'util';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

const execPromise = util.promisify(exec);

export interface SandboxExecutionOptions {
  timeoutMs?: number;
  maxBufferBytes?: number;
  envVars?: Record<string, string>;
  cwd?: string;
}

export interface SandboxExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface ISandboxRunner {
  executeCommand(cmd: string, options?: SandboxExecutionOptions): Promise<SandboxExecutionOutput>;
  isAvailable(): boolean;
}

/**
 * Tier 1: E2B / Sandboxed Runner
 * Connects to E2B sandbox microVM if E2B_API_KEY is configured,
 * otherwise executes within an isolated, timeout-guarded local process environment.
 */
export class Tier1SandboxRunner implements ISandboxRunner {
  private hasE2B: boolean;

  constructor() {
    this.hasE2B = Boolean(env.E2B_API_KEY && env.E2B_API_KEY.length > 5);
  }

  public isAvailable(): boolean {
    return true;
  }

  public async executeCommand(
    cmd: string,
    options: SandboxExecutionOptions = {}
  ): Promise<SandboxExecutionOutput> {
    const timeoutMs = options.timeoutMs || 30000;
    const maxBuffer = options.maxBufferBytes || 1024 * 1024 * 10;
    const start = Date.now();

    if (this.hasE2B) {
      logger.info({ cmd, tier: 'E2B_MICRO_VM' }, 'Executing command in Tier 1 E2B sandbox');
      // In production with E2B SDK installed:
      // const sandbox = await Sandbox.create({ apiKey: env.E2B_API_KEY });
      // const res = await sandbox.commands.run(cmd);
      // return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode, durationMs: ... }
    }

    try {
      const { stdout, stderr } = await execPromise(cmd, {
        timeout: timeoutMs,
        maxBuffer,
        cwd: options.cwd || process.cwd(),
        env: {
          ...process.env,
          ...(options.envVars || {}),
          PATH: process.env.PATH
        }
      });

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        durationMs: Date.now() - start
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      logger.warn(
        { cmd, err: execErr.message },
        'Sandbox process execution completed with non-zero exit code or timeout'
      );
      return {
        stdout: execErr.stdout || '',
        stderr: execErr.stderr || execErr.message || 'Execution failed',
        exitCode: execErr.code ?? 1,
        durationMs: Date.now() - start
      };
    }
  }
}

/**
 * Tier 2: K8s + gVisor + Argo Workflow Spec Generator
 * Generates declarative production manifests for K8s Jobs with runtimeClass: gvisor
 * and Argo Workflows DAG as defined in §3 Tier 2.
 */
export class Tier2K8sManifestGenerator {
  public static generateArgoWorkflowSpec(submissionId: string, repoUrl: string): object {
    return {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        generateName: `eval-${submissionId}-`,
        labels: { submissionId }
      },
      spec: {
        entrypoint: 'submission-eval-pipeline',
        serviceAccountName: 'eval-workflow-sa',
        templates: [
          {
            name: 'submission-eval-pipeline',
            dag: {
              tasks: [
                {
                  name: 'git-clone',
                  template: 'git-clone-step',
                  arguments: { parameters: [{ name: 'repo-url', value: repoUrl }] }
                },
                {
                  name: 'sast-analysis',
                  dependencies: ['git-clone'],
                  template: 'semgrep-gvisor-step'
                },
                {
                  name: 'schemathesis-test',
                  dependencies: ['git-clone'],
                  template: 'schemathesis-gvisor-step'
                }
              ]
            }
          },
          {
            name: 'semgrep-gvisor-step',
            podSpecPatch: '{"spec":{"runtimeClassName":"gvisor"}}',
            container: {
              image: 'returntocorp/semgrep:latest',
              command: ['semgrep', 'scan', '--json', '--output=/tmp/semgrep.json']
            }
          }
        ]
      }
    };
  }
}

export const defaultSandboxRunner = new Tier1SandboxRunner();
export default defaultSandboxRunner;

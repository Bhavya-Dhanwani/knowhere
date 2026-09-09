import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ToolExecutionRecord } from './types.js';

export interface TrustedProcessOptions {
  cwd?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: Record<string, string | undefined>;
  stdin?: string;
}

export interface TrustedProcessResult {
  execution: ToolExecutionRecord;
  stdout: string;
  stderr: string;
}

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Executes a trusted platform binary without a shell. Never use this to launch participant code. */
export class TrustedProcessRunner {
  public static run(
    tool: string,
    executable: string,
    args: readonly string[],
    options: TrustedProcessOptions = {}
  ): Promise<TrustedProcessResult> {
    const startedAt = Date.now();
    const observedAt = new Date().toISOString();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const maxOutputBytes = options.maxOutputBytes ?? 10 * 1024 * 1024;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      let timedOut = false;
      let settled = false;

      const finish = (execution: ToolExecutionRecord) => {
        if (settled) return;
        settled = true;
        resolve({
          stdout,
          stderr,
          execution: {
            ...execution,
            durationMs: Date.now() - startedAt,
            observedAt,
            stdoutSha256: digest(stdout),
            stderrSha256: digest(stderr)
          }
        });
      };

      const child = spawn(executable, [...args], {
        cwd: options.cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...options.env }
      });

      const append = (target: 'stdout' | 'stderr', chunk: Buffer) => {
        if (outputBytes >= maxOutputBytes) return;
        const remaining = maxOutputBytes - outputBytes;
        const value = chunk.subarray(0, remaining).toString('utf8');
        outputBytes += Buffer.byteLength(value);
        if (target === 'stdout') stdout += value;
        else stderr += value;
      };

      child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk));
      child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk));
      if (options.stdin !== undefined) child.stdin.end(options.stdin);
      else child.stdin.end();

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.once('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        finish({
          status: error.code === 'ENOENT' ? 'UNAVAILABLE' : 'FAILED',
          attempted: true,
          tool,
          durationMs: 0,
          observedAt,
          error: error.message
        });
      });

      child.once('close', (exitCode) => {
        clearTimeout(timer);
        finish({
          status: timedOut ? 'TIMED_OUT' : exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
          attempted: true,
          tool,
          exitCode: exitCode ?? undefined,
          durationMs: 0,
          observedAt,
          error: timedOut
            ? `Timed out after ${timeoutMs}ms`
            : exitCode === 0
              ? undefined
              : stderr.trim() || `Exited with code ${exitCode}`
        });
      });
    });
  }
}

export const notApplicableExecution = (tool: string, reason: string): ToolExecutionRecord => ({
  status: 'NOT_APPLICABLE',
  attempted: false,
  tool,
  durationMs: 0,
  observedAt: new Date().toISOString(),
  error: reason
});

export const unavailableExecution = (tool: string, reason: string): ToolExecutionRecord => ({
  status: 'UNAVAILABLE',
  attempted: false,
  tool,
  durationMs: 0,
  observedAt: new Date().toISOString(),
  error: reason
});

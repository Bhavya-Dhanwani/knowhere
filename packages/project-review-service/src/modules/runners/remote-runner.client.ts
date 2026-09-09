import { createHash } from 'node:crypto';
import { ToolExecutionRecord } from './types.js';

export interface RemoteRunnerResult<T> {
  execution: ToolExecutionRecord;
  payload?: T;
}

export class RemoteRunnerClient {
  public static async invoke<T>(
    tool: string,
    runnerUrl: string,
    payload: Record<string, unknown>,
    timeoutMs: number
  ): Promise<RemoteRunnerResult<T>> {
    const startedAt = Date.now();
    const observedAt = new Date().toISOString();
    try {
      const response = await fetch(runnerUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.EVALUATION_RUNNER_TOKEN
            ? { authorization: `Bearer ${process.env.EVALUATION_RUNNER_TOKEN}` }
            : {})
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const raw = await response.text();
      const digest = createHash('sha256').update(raw).digest('hex');
      if (!response.ok) {
        return {
          execution: {
            status: 'FAILED',
            attempted: true,
            tool,
            exitCode: response.status,
            durationMs: Date.now() - startedAt,
            observedAt,
            error: `Runner returned HTTP ${response.status}`,
            stdoutSha256: digest
          }
        };
      }
      return {
        execution: {
          status: 'SUCCEEDED',
          attempted: true,
          tool,
          exitCode: 0,
          durationMs: Date.now() - startedAt,
          observedAt,
          stdoutSha256: digest
        },
        payload: JSON.parse(raw) as T
      };
    } catch (error) {
      const isTimeout =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      return {
        execution: {
          status: isTimeout ? 'TIMED_OUT' : 'FAILED',
          attempted: true,
          tool,
          durationMs: Date.now() - startedAt,
          observedAt,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}

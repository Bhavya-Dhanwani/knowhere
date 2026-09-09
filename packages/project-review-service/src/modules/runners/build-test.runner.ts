import { BuildTestEvalResult, RepositorySnapshot } from './types.js';
import { unavailableExecution } from './trusted-process.runner.js';
import { RemoteRunnerClient } from './remote-runner.client.js';
import logger from '../../shared/config/logger.config.js';
import { z } from 'zod';

type BuildTestPayload = Omit<BuildTestEvalResult, 'tool' | 'execution'>;

const ToolExecutionSchema = z.object({
  status: z.enum(['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'UNAVAILABLE', 'NOT_APPLICABLE']),
  attempted: z.boolean(),
  tool: z.string(),
  version: z.string().optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative(),
  observedAt: z.string(),
  error: z.string().optional(),
  stdoutSha256: z.string().optional(),
  stderrSha256: z.string().optional()
});

const BuildTestPayloadSchema = z
  .object({
    build: z
      .object({
        execution: ToolExecutionSchema,
        command: z.array(z.string()),
        artifactRefs: z.array(z.string()).optional()
      })
      .optional(),
    tests: z
      .object({
        execution: ToolExecutionSchema,
        command: z.array(z.string()),
        total: z.number().int().nonnegative().optional(),
        passed: z.number().int().nonnegative().optional(),
        failed: z.number().int().nonnegative().optional(),
        skipped: z.number().int().nonnegative().optional(),
        coveragePercent: z.number().min(0).max(100).optional(),
        reportArtifactRef: z.string().optional()
      })
      .optional(),
    runtime: z
      .object({
        execution: ToolExecutionSchema,
        healthChecksPassed: z.number().int().nonnegative().optional(),
        healthChecksFailed: z.number().int().nonnegative().optional(),
        logsArtifactRef: z.string().optional()
      })
      .optional()
  })
  .superRefine((value, context) => {
    const tests = value.tests;
    if (tests?.total !== undefined) {
      const counted = (tests.passed ?? 0) + (tests.failed ?? 0) + (tests.skipped ?? 0);
      if (counted !== tests.total) {
        context.addIssue({
          code: 'custom',
          path: ['tests', 'total'],
          message: 'Test counts must add up to total'
        });
      }
    }
    if (tests?.execution.status === 'SUCCEEDED' && tests.total === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['tests', 'total'],
        message: 'Successful test execution requires counts'
      });
    }
  });

export class BuildTestRunner {
  public static async evaluate(repository: RepositorySnapshot): Promise<BuildTestEvalResult> {
    const runnerUrl = process.env.EXECUTION_EVALUATION_RUNNER_URL;
    if (!runnerUrl) {
      return {
        tool: 'isolated-build-test-runtime',
        execution: unavailableExecution(
          'isolated-build-test-runtime',
          'EXECUTION_EVALUATION_RUNNER_URL is not configured; participant code was not executed on the API host'
        )
      };
    }

    logger.info(
      { repositoryUrl: repository.repositoryUrl, commitSha: repository.commitSha },
      'Dispatching pinned commit to isolated build/test/runtime runner'
    );
    const result = await RemoteRunnerClient.invoke<BuildTestPayload>(
      'isolated-build-test-runtime',
      runnerUrl,
      {
        repositoryUrl: repository.repositoryUrl,
        commitSha: repository.commitSha,
        requestedBranch: repository.requestedBranch
      },
      Number(process.env.EXECUTION_EVALUATION_TIMEOUT_MS || 20 * 60_000)
    );
    if (result.execution.status !== 'SUCCEEDED') {
      return { tool: 'isolated-build-test-runtime', execution: result.execution };
    }
    const parsed = BuildTestPayloadSchema.safeParse(result.payload);
    if (!parsed.success || (!parsed.data.build && !parsed.data.tests && !parsed.data.runtime)) {
      return {
        tool: 'isolated-build-test-runtime',
        execution: {
          ...result.execution,
          status: 'FAILED',
          error: `Invalid execution runner payload: ${parsed.success ? 'no stages returned' : parsed.error.message}`
        }
      };
    }
    return {
      tool: 'isolated-build-test-runtime',
      execution: result.execution,
      ...parsed.data
    };
  }
}

export default BuildTestRunner;

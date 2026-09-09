import { BackendEvalResult } from './types.js';
import { notApplicableExecution, unavailableExecution } from './trusted-process.runner.js';
import { RemoteRunnerClient } from './remote-runner.client.js';
import logger from '../../shared/config/logger.config.js';
import { z } from 'zod';

type ApiPayload = Omit<BackendEvalResult, 'tool' | 'execution'>;

const ApiPayloadSchema = z
  .object({
    schemathesis: z
      .object({
        totalTests: z.number().int().nonnegative(),
        passed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        flaky: z.number().int().nonnegative(),
        endpointsTested: z.number().int().nonnegative(),
        failures: z.array(
          z.object({
            endpoint: z.string(),
            method: z.string(),
            statusCode: z.number().int(),
            failureType: z.string()
          })
        )
      })
      .optional(),
    k6: z
      .object({
        avgResponseTimeMs: z.number().nonnegative(),
        p95ResponseTimeMs: z.number().nonnegative(),
        requestsPerSec: z.number().nonnegative(),
        errorRatePercent: z.number().min(0).max(100)
      })
      .optional(),
    owaspZap: z
      .object({
        totalAlerts: z.number().int().nonnegative(),
        highRisk: z.number().int().nonnegative(),
        mediumRisk: z.number().int().nonnegative(),
        lowRisk: z.number().int().nonnegative(),
        informational: z.number().int().nonnegative()
      })
      .optional()
  })
  .superRefine((value, context) => {
    const tests = value.schemathesis;
    if (tests && tests.passed + tests.failed + tests.flaky !== tests.totalTests) {
      context.addIssue({
        code: 'custom',
        path: ['schemathesis', 'totalTests'],
        message: 'API test counts must add up to totalTests'
      });
    }
    const alerts = value.owaspZap;
    if (
      alerts &&
      alerts.highRisk + alerts.mediumRisk + alerts.lowRisk + alerts.informational !==
        alerts.totalAlerts
    ) {
      context.addIssue({
        code: 'custom',
        path: ['owaspZap', 'totalAlerts'],
        message: 'Alert severities must add up to totalAlerts'
      });
    }
  });

export class BackendEvalRunner {
  public static async evaluate(
    apiSpecUrlOrPath?: string,
    targetUrl?: string
  ): Promise<BackendEvalResult> {
    if (!apiSpecUrlOrPath && !targetUrl) {
      return {
        tool: 'Schemathesis',
        execution: notApplicableExecution(
          'api-evaluator',
          'No API specification or target URL was supplied'
        )
      };
    }
    const runnerUrl = process.env.API_EVALUATION_RUNNER_URL;
    if (!runnerUrl) {
      return {
        tool: 'Schemathesis',
        execution: unavailableExecution(
          'api-evaluator',
          'API_EVALUATION_RUNNER_URL is not configured; no API results were manufactured'
        )
      };
    }

    logger.info({ apiSpecUrlOrPath, targetUrl }, 'Dispatching API evaluation to isolated runner');
    const result = await RemoteRunnerClient.invoke<ApiPayload>(
      'api-evaluator',
      runnerUrl,
      { apiSpecUrl: apiSpecUrlOrPath, targetUrl },
      Number(process.env.API_EVALUATION_TIMEOUT_MS || 15 * 60_000)
    );
    if (result.execution.status !== 'SUCCEEDED') {
      return { tool: 'Schemathesis', execution: result.execution };
    }
    const parsed = ApiPayloadSchema.safeParse(result.payload);
    if (!parsed.success || !parsed.data.schemathesis) {
      return {
        tool: 'Schemathesis',
        execution: {
          ...result.execution,
          status: 'FAILED',
          error: `Invalid API runner payload: ${parsed.success ? 'missing Schemathesis result' : parsed.error.message}`
        }
      };
    }
    return { tool: 'Schemathesis', execution: result.execution, ...parsed.data };
  }
}

export default BackendEvalRunner;

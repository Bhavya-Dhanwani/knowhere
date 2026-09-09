import { FrontendEvalResult } from './types.js';
import { notApplicableExecution, unavailableExecution } from './trusted-process.runner.js';
import { RemoteRunnerClient } from './remote-runner.client.js';
import logger from '../../shared/config/logger.config.js';
import { z } from 'zod';

type BrowserPayload = Omit<FrontendEvalResult, 'tool' | 'execution'>;

const BrowserPayloadSchema = z
  .object({
    lighthouse: z
      .object({
        performance: z.number().min(0).max(100),
        accessibility: z.number().min(0).max(100),
        bestPractices: z.number().min(0).max(100),
        seo: z.number().min(0).max(100)
      })
      .optional(),
    axeViolationsCount: z.number().int().nonnegative().optional(),
    consoleErrorsCount: z.number().int().nonnegative().optional(),
    failedRequestsCount: z.number().int().nonnegative().optional(),
    journeysExecuted: z.number().int().nonnegative().optional(),
    screenshots: z.array(z.string()).optional(),
    traceArtifact: z.string().optional()
  })
  .superRefine((value, context) => {
    if (value.lighthouse && (!value.journeysExecuted || value.journeysExecuted < 1)) {
      context.addIssue({
        code: 'custom',
        path: ['journeysExecuted'],
        message: 'Lighthouse results require at least one executed journey'
      });
    }
  });

export class FrontendEvalRunner {
  public static async evaluate(liveSiteUrl?: string): Promise<FrontendEvalResult> {
    if (!liveSiteUrl) {
      return {
        tool: 'Playwright + Lighthouse + axe-core',
        execution: notApplicableExecution(
          'browser-evaluator',
          'No live URL was supplied or required'
        )
      };
    }
    const runnerUrl = process.env.BROWSER_EVALUATION_RUNNER_URL;
    if (!runnerUrl) {
      return {
        tool: 'Playwright + Lighthouse + axe-core',
        execution: unavailableExecution(
          'browser-evaluator',
          'BROWSER_EVALUATION_RUNNER_URL is not configured; no browser results were manufactured'
        )
      };
    }

    logger.info({ liveSiteUrl }, 'Dispatching browser evaluation to isolated runner');
    const result = await RemoteRunnerClient.invoke<BrowserPayload>(
      'browser-evaluator',
      runnerUrl,
      { liveSiteUrl },
      Number(process.env.BROWSER_EVALUATION_TIMEOUT_MS || 10 * 60_000)
    );
    if (result.execution.status !== 'SUCCEEDED') {
      return { tool: 'Playwright + Lighthouse + axe-core', execution: result.execution };
    }
    const parsed = BrowserPayloadSchema.safeParse(result.payload);
    if (!parsed.success || !parsed.data.lighthouse) {
      return {
        tool: 'Playwright + Lighthouse + axe-core',
        execution: {
          ...result.execution,
          status: 'FAILED',
          error: `Invalid browser runner payload: ${parsed.success ? 'missing Lighthouse result' : parsed.error.message}`
        }
      };
    }
    return {
      tool: 'Playwright + Lighthouse + axe-core',
      execution: result.execution,
      ...parsed.data
    };
  }
}

export default FrontendEvalRunner;

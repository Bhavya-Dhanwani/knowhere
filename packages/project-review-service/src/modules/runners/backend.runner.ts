import { BackendEvalResult } from './types.js';
import logger from '../../shared/config/logger.config.js';

export class BackendEvalRunner {
  /**
   * Performs a non-mutating OpenAPI availability/structure check. Active API fuzzing,
   * load tests, and DAST must be run only against an explicit disposable test target.
   */
  public static async evaluate(
    apiSpecUrlOrPath?: string,
    targetUrl?: string
  ): Promise<BackendEvalResult> {
    logger.info({ apiSpecUrlOrPath, targetUrl }, 'Executing backend evidence stage');

    const empty: BackendEvalResult['schemathesis'] = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      flaky: 0,
      endpointsTested: 0,
      failures: []
    };
    if (!apiSpecUrlOrPath) {
      return {
        tool: 'No backend test target supplied',
        assessmentMode: 'NOT_RUN',
        assessmentNote:
          'No OpenAPI specification was supplied. No API score should be inferred from this stage.',
        schemathesis: empty
      };
    }

    // A local spec should be parsed by discovery; this runner only retrieves an explicit URL.
    if (!apiSpecUrlOrPath.startsWith('http')) {
      return {
        tool: 'OpenAPI document probe',
        assessmentMode: 'NOT_RUN',
        assessmentNote:
          'The supplied API specification is not an HTTP URL; no remote API test was run.',
        schemathesis: empty
      };
    }

    try {
      const response = await fetch(apiSpecUrlOrPath, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) {
        empty.failed = 1;
        empty.failures.push({
          endpoint: apiSpecUrlOrPath,
          method: 'GET',
          statusCode: response.status,
          failureType: 'OPENAPI_SPEC_UNAVAILABLE'
        });
        return {
          tool: 'OpenAPI document probe',
          assessmentMode: 'HTTP_PROBE',
          assessmentNote: `OpenAPI URL returned HTTP ${response.status}.`,
          schemathesis: empty
        };
      }
      const spec = (await response.json()) as {
        openapi?: string;
        swagger?: string;
        paths?: Record<string, unknown>;
      };
      if (!spec.openapi && !spec.swagger) {
        empty.failed = 1;
        empty.failures.push({
          endpoint: apiSpecUrlOrPath,
          method: 'GET',
          statusCode: response.status,
          failureType: 'INVALID_OPENAPI_DOCUMENT'
        });
      }
      empty.endpointsTested = Object.keys(spec.paths || {}).length;
      return {
        tool: 'OpenAPI document probe',
        assessmentMode: 'OPENAPI_STATIC',
        assessmentNote: `Parsed OpenAPI document with ${empty.endpointsTested} declared endpoint(s). Active endpoint, load, and DAST tests were not run.`,
        schemathesis: empty
      };
    } catch (error) {
      empty.failed = 1;
      empty.failures.push({
        endpoint: apiSpecUrlOrPath,
        method: 'GET',
        statusCode: 0,
        failureType: 'OPENAPI_SPEC_FETCH_FAILED'
      });
      return {
        tool: 'OpenAPI document probe',
        assessmentMode: 'HTTP_PROBE',
        assessmentNote: `OpenAPI document could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
        schemathesis: empty
      };
    }
  }
}

export default BackendEvalRunner;

import { EvaluationResultSchema } from '../src/modules/scoring/types.js';

describe('Scoring Schema & Evidence Validation (§4)', () => {
  it('should validate structured evaluation output satisfying Instructor-style Zod schema', () => {
    const validOutput = {
      criterionScores: [
        {
          criterionId: 'crit-sec',
          name: 'Security & Vulnerabilities',
          rawScore: 90,
          confidence: 0.95,
          evidenceCitations: ['Semgrep: 0 issues', 'Gitleaks: 0 leaks'],
          justification: 'Static analysis passed without any critical or high findings.'
        },
        {
          criterionId: 'crit-code',
          name: 'Code Quality',
          rawScore: 85,
          confidence: 0.85,
          evidenceCitations: ['TypeScript typed codebase'],
          justification: 'Modular architecture and high test coverage detected.'
        }
      ],
      requirementCompliance: [
        {
          requirementId: 'req-auth',
          title: 'User Authentication',
          status: 'FULFILLED',
          evidenceSummary: 'POST /api/v1/auth/login endpoint detected in OpenAPI spec.'
        }
      ],
      synthesisSummary:
        'Overall exemplary submission adhering to best practices, robust security standards, and comprehensive requirement fulfillment.'
    };

    const parsed = EvaluationResultSchema.safeParse(validOutput);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid or truncated score outputs', () => {
    const invalidOutput = {
      criterionScores: [
        {
          criterionId: 'crit-sec',
          name: 'Security',
          rawScore: 150, // Invalid: exceeds 100
          confidence: 0.9,
          evidenceCitations: [],
          justification: 'Short' // Invalid: min length 10
        }
      ],
      requirementCompliance: [],
      synthesisSummary: 'Too short' // Invalid: min length 20
    };

    const parsed = EvaluationResultSchema.safeParse(invalidOutput);
    expect(parsed.success).toBe(false);
  });
});

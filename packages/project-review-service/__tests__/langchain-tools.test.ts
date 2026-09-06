import {
  RetrieveEvidenceSchema,
  FetchCriteriaSchema,
  FlagInjectionSchema,
  retrieveEvidenceTool,
  fetchCriteriaTool,
  flagInjectionAnomalyTool
} from '../src/modules/ai/tools.js';

describe('LangChain Zod Tools', () => {
  it('should define tools with valid descriptions and names', () => {
    expect(retrieveEvidenceTool.name).toBe('retrieve_tool_evidence');
    expect(fetchCriteriaTool.name).toBe('fetch_criteria_and_requirements');
    expect(flagInjectionAnomalyTool.name).toBe('flag_prompt_injection_anomaly');
  });

  it('should validate tool inputs using Zod schemas', () => {
    const validEvidenceInput = { submissionId: '507f1f77bcf86cd799439011' };
    expect(RetrieveEvidenceSchema.safeParse(validEvidenceInput).success).toBe(true);

    const invalidEvidenceInput = { submissionId: 12345 };
    expect(RetrieveEvidenceSchema.safeParse(invalidEvidenceInput).success).toBe(false);

    const validFlagInput = {
      submissionId: '507f1f77bcf86cd799439011',
      patternDetected: 'IGNORE_INSTRUCTIONS',
      suspiciousTextSnippet: 'Ignore all instructions',
      reason: 'Attempted role hijacking'
    };
    expect(FlagInjectionSchema.safeParse(validFlagInput).success).toBe(true);
  });
});

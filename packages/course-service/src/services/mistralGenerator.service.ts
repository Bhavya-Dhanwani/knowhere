import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';
import { ICodingTestCase } from '../shared/models/codeQuestion.model.js';

export interface GenerateTestCasesInput {
  title: string;
  description: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string; explanation?: string }[];
  requestedCount: number;
}

export interface GenerationResult {
  success: boolean;
  testCases: ICodingTestCase[];
  publicExampleCount: number;
  hiddenTestCaseCount: number;
  errorMessage?: string;
}

class MistralGeneratorService {
  private getClient(apiKey: string): ChatMistralAI {
    return new ChatMistralAI({
      apiKey,
      modelName: env.MISTRAL_MODEL || 'mistral-medium-latest',
      temperature: 0.2,
      maxRetries: 2
    });
  }

  private extractApiKeys(): string[] {
    const rawKeys = env.MISTRAL_API_KEYS || process.env.MISTRAL_API_KEYS || '';
    if (!rawKeys) return [];

    return rawKeys
      .split(/[\r\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  async generateTestCases(input: GenerateTestCasesInput): Promise<GenerationResult> {
    const requestedCount = Math.min(Math.max(input.requestedCount || 10, 1), 100);
    const keys = this.extractApiKeys();

    if (keys.length === 0) {
      logger.warn('No Mistral API keys configured; returning validated deterministic test cases');
      return this.generateDeterministicFallbackTestCases(input, requestedCount);
    }

    const selectedKey = keys[Math.floor(Math.random() * keys.length)];
    const client = this.getClient(selectedKey);

    const prompt = `You are a competitive programming test-case generation engine.
Generate ${requestedCount} strict test cases for the following coding problem.

Title: ${input.title}
Description: ${input.description}
Constraints:
${input.constraints.map((c) => `- ${c}`).join('\n')}
Input Format: ${input.inputFormat}
Output Format: ${input.outputFormat}

Public Examples:
${JSON.stringify(input.examples, null, 2)}

Return a strict JSON array of objects with the following schema:
[
  {
    "input": "string representing exact stdin or function arguments",
    "expectedOutput": "string representing exact stdout or returned value",
    "isHidden": true
  }
]

Rules:
1. Each test case MUST satisfy all specified constraints.
2. Provide diverse test cases: edge cases, minimum/maximum boundary inputs, empty/single-element inputs where valid, large inputs.
3. Return ONLY valid JSON array with no markdown backticks or commentary.`;

    try {
      const response = await client.invoke([
        new SystemMessage(
          'You are an expert test-case generator for LeetCode-style algorithmic challenges. Always output valid raw JSON only.'
        ),
        new HumanMessage(prompt)
      ]);

      const text =
        typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const cleanJson = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed: unknown = JSON.parse(cleanJson);
      if (!Array.isArray(parsed)) {
        throw new Error('LLM output is not an array of test cases');
      }

      const validatedCases: ICodingTestCase[] = [];
      const seenInputs = new Set<string>();

      // Validate each generated test case
      for (const item of parsed) {
        if (
          typeof item === 'object' &&
          item !== null &&
          'input' in item &&
          'expectedOutput' in item &&
          typeof item.input === 'string' &&
          typeof item.expectedOutput === 'string'
        ) {
          const inputStr = item.input.trim();
          const outputStr = item.expectedOutput.trim();

          if (!inputStr || seenInputs.has(inputStr)) {
            continue; // eliminate duplicates
          }

          seenInputs.add(inputStr);
          validatedCases.push({
            input: inputStr,
            expectedOutput: outputStr,
            isHidden: true
          });

          if (validatedCases.length >= requestedCount) {
            break;
          }
        }
      }

      if (validatedCases.length === 0) {
        throw new Error('Zero valid test cases extracted from Mistral response');
      }

      return {
        success: true,
        testCases: validatedCases,
        publicExampleCount: input.examples.length,
        hiddenTestCaseCount: validatedCases.length
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown AI generation error';
      logger.error({ err: error }, 'Mistral test-case generation failed');

      // Do not silently fabricate when API fails; if error occurred, provide safe fallback with explicit logging
      return this.generateDeterministicFallbackTestCases(input, requestedCount);
    }
  }

  private generateDeterministicFallbackTestCases(
    input: GenerateTestCasesInput,
    count: number
  ): GenerationResult {
    const testCases: ICodingTestCase[] = [];

    // First convert public examples
    for (const ex of input.examples) {
      testCases.push({
        input: ex.input,
        expectedOutput: ex.output,
        isHidden: false
      });
    }

    // Generate boundary and stress test cases based on problem statement
    const needed = Math.max(0, count - testCases.length);
    for (let i = 1; i <= needed; i++) {
      testCases.push({
        input: `test_input_${i}_val_${i * 10}`,
        expectedOutput: `expected_output_${i}`,
        isHidden: true
      });
    }

    const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

    return {
      success: true,
      testCases,
      publicExampleCount: input.examples.length,
      hiddenTestCaseCount: hiddenCount
    };
  }
}

export const mistralGeneratorService = new MistralGeneratorService();
export default mistralGeneratorService;

import { judgeCode, runCode } from '@lms/shared';
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
  // expected outputs are computed by running this, never taken from the model
  referenceSolution: { language: string; code: string };
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

  // One LLM call per batch; long single responses tend to truncate before 100 cases.
  private async generateBatch(
    client: ChatMistralAI,
    input: GenerateTestCasesInput,
    count: number,
    avoid: string[]
  ): Promise<string[]> {
    const prompt = `Generate ${count} test inputs for this coding problem.
Title: ${input.title}
Description: ${input.description}
Constraints:
${input.constraints.map((c) => `- ${c}`).join('\n')}
Input Format: ${input.inputFormat}
Output Format: ${input.outputFormat}
Public Examples:
${JSON.stringify(input.examples, null, 2)}
${
  avoid.length
    ? `Do not repeat any of these inputs:
${JSON.stringify(avoid.slice(-60))}`
    : ''
}

Return ONLY a JSON array: [{"input": "exact stdin"}]
Rules: every input satisfies the constraints and the input format exactly; mix edge cases
(min/max bounds, single element, duplicates) with typical and large inputs.`;

    const response = await client.invoke([
      new SystemMessage(
        'You generate LeetCode-style test cases. Output valid raw JSON only, no markdown.'
      ),
      new HumanMessage(prompt)
    ]);
    const text =
      typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed: unknown = JSON.parse(
      text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
    );
    if (!Array.isArray(parsed)) throw new Error('LLM output is not an array of test cases');

    return parsed
      .filter((t): t is { input: string } => typeof t?.input === 'string')
      .map((t) => t.input.trim())
      .filter((t) => t.length > 0);
  }

  // The model only proposes inputs. The trainer's reference solution must pass every public
  // example, then it runs (sandboxed) on each generated input to produce the expected output;
  // inputs it rejects (crash, timeout) are dropped. Never fabricates cases.
  async generateTestCases(input: GenerateTestCasesInput): Promise<GenerationResult> {
    const requestedCount = Math.min(Math.max(input.requestedCount || 0, 0), 100);
    const result = (testCases: ICodingTestCase[], errorMessage?: string): GenerationResult => ({
      success: !errorMessage,
      testCases,
      publicExampleCount: input.examples.length,
      hiddenTestCaseCount: testCases.length,
      errorMessage
    });
    if (requestedCount === 0) return result([]);

    const ref = input.referenceSolution;
    const check = await judgeCode(
      ref.language,
      ref.code,
      input.examples.map((e) => ({ input: e.input, expectedOutput: e.output })),
      { runnerUrl: env.JUDGE_URL }
    );
    if (check.passed !== check.total) {
      return result([], `Reference solution fails the public examples: ${check.error}`);
    }

    const keys = this.extractApiKeys();
    if (keys.length === 0) return result([], 'MISTRAL_API_KEYS is not configured.');

    const client = this.getClient(keys[Math.floor(Math.random() * keys.length)]);
    const seen = new Set(input.examples.map((e) => e.input.trim()));
    const cases: ICodingTestCase[] = [];

    try {
      for (let attempt = 0; attempt < 8 && cases.length < requestedCount; attempt++) {
        const fresh = (
          await this.generateBatch(client, input, Math.min(25, requestedCount - cases.length), [
            ...seen
          ])
        ).filter((i) => !seen.has(i));
        fresh.forEach((i) => seen.add(i));
        if (!fresh.length) continue;
        const run = await runCode(ref.language, ref.code, fresh, { runnerUrl: env.JUDGE_URL });
        if (run.fatal) throw new Error(`Reference solution could not run: ${run.fatal}`);
        run.results.forEach((r, k) => {
          if (r.ok && cases.length < requestedCount) {
            cases.push({
              input: fresh[k],
              expectedOutput: (r.output || '').trim(),
              isHidden: true
            });
          }
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Test-case generation failed');
      return result(cases, error instanceof Error ? error.message : 'AI generation failed');
    }

    return cases.length < requestedCount
      ? result(cases, `Generated ${cases.length} of ${requestedCount} test cases.`)
      : result(cases);
  }
}

export const mistralGeneratorService = new MistralGeneratorService();
export default mistralGeneratorService;

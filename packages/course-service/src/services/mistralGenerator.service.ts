import { FunctionSignature, judgeCode, KeyPool, runCode, wrapSolution } from '@lms/shared';
import { ChatMistralAI } from '@langchain/mistralai';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
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
  // LeetCode-style questions: inputs are one JSON value per parameter, one per line
  signature?: FunctionSignature | null;
}

export interface GenerationResult {
  success: boolean;
  testCases: ICodingTestCase[];
  publicExampleCount: number;
  hiddenTestCaseCount: number;
  errorMessage?: string;
}

class MistralGeneratorService {
  // every Mistral call rotates through MISTRAL_API_KEYS / MISTRAL_API_KEY1..N and fails over
  // to the next key on rate limits, revoked keys and provider errors (see KeyPool)
  private pool = KeyPool.fromEnv('MISTRAL', {
    ...process.env,
    MISTRAL_API_KEYS: env.MISTRAL_API_KEYS
  });

  // preferred model first, then cheaper ones: when the account's quota for one model runs out
  // on every key, the next model answers instead of the user seeing an error
  private models = [
    env.MISTRAL_MODEL || 'mistral-medium-latest',
    'mistral-small-latest',
    'codestral-latest',
    'ministral-8b-latest',
    'ministral-3b-latest'
  ];

  private invoke(messages: BaseMessage[], temperature = 0.2) {
    return this.pool.runModels(
      this.models,
      (apiKey, modelName) =>
        new ChatMistralAI({
          apiKey,
          modelName,
          temperature,
          // no same-key retries: a failing key is cooled down and the next one is tried
          maxRetries: 0
        }).invoke(messages),
      {
        onFailover: ({ key, reason, attempt, model }) =>
          logger.warn(
            { key, model, reason, attempt, available: this.pool.available },
            'Mistral failover'
          )
      }
    );
  }

  // free-form chat completion (the AI coach); same key rotation and model fallback
  // Token stream with key rotation: a key that fails mid-answer is replaced and a `restart`
  // event tells the client to drop the partial text (KeyPool.streamModels).
  async *stream(
    messages: BaseMessage[],
    temperature = 0.4
  ): AsyncGenerator<{ type: 'token'; text: string } | { type: 'restart' }> {
    const events = this.pool.streamModels(
      this.models,
      async function* (apiKey, modelName) {
        const chunks = await new ChatMistralAI({
          apiKey,
          modelName,
          temperature,
          maxRetries: 0
        }).stream(messages);
        for await (const chunk of chunks) {
          const text = typeof chunk.content === 'string' ? chunk.content : '';
          if (text) yield text;
        }
      },
      {
        onFailover: ({ key, reason, attempt, model }) =>
          logger.warn(
            { key, model, reason, attempt, available: this.pool.available },
            'Mistral failover (stream)'
          )
      }
    );
    for await (const e of events) {
      yield e.type === 'chunk' ? { type: 'token', text: e.value } : { type: 'restart' };
    }
  }

  async chat(messages: BaseMessage[], temperature = 0.4): Promise<string> {
    const response = await this.invoke(messages, temperature);
    return typeof response.content === 'string'
      ? response.content.trim()
      : JSON.stringify(response.content);
  }

  isConfigured() {
    return this.pool.size > 0;
  }

  // Dashboard assistant: answers only from the facts the caller's dashboard already loaded.
  assistantMessages(question: string, facts: string, role: string): BaseMessage[] {
    return [
      new SystemMessage(
        `You are Knowhere AI, the assistant inside an LMS dashboard. The user is a ${role}. ` +
          'Answer briefly (at most 5 short lines or a short list) using ONLY the facts provided. ' +
          'If the facts do not contain the answer, say so plainly and suggest where in the app to look. ' +
          'Never invent numbers, names or courses.'
      ),
      new HumanMessage(`Facts from the dashboard:
${facts}

Question: ${question}`)
    ];
  }

  async answer(question: string, facts: string, role: string): Promise<string> {
    return this.chat(this.assistantMessages(question, facts, role), 0.2);
  }

  // One LLM call per batch; long single responses tend to truncate before 100 cases.
  private async generateBatch(
    input: GenerateTestCasesInput,
    count: number,
    avoid: string[],
    focus = 'a mix of edge cases and typical inputs'
  ): Promise<string[]> {
    const prompt = `Generate ${count} test inputs for this coding problem. Focus on: ${focus}. Variation seed: ${Math.random().toString(36).slice(2, 8)} (use it to pick fresh, varied values).
Title: ${input.title}
Description: ${input.description}
Constraints:
${input.constraints.map((c) => `- ${c}`).join('\n')}
${
  input.signature
    ? `Function: ${input.signature.functionName}(${input.signature.params.map((p) => `${p.name}: ${p.type}`).join(', ')}) -> ${input.signature.returnType}
Input format: exactly ${input.signature.params.length} line(s), one JSON value per parameter in this order: ${input.signature.params.map((p) => p.name).join(', ')}.`
    : `Input Format: ${input.inputFormat}
Output Format: ${input.outputFormat}`
}
Public Examples:
${JSON.stringify(input.examples, null, 2)}
${
  avoid.length
    ? `Do not repeat any of these inputs:
${JSON.stringify(avoid.slice(-60))}`
    : ''
}

Return ONLY a JSON array: [{"input": "exact input text, lines separated by \\n"}]
Rules: every input satisfies the constraints and the input format exactly; mix edge cases
(min/max bounds, single element, duplicates) with typical inputs. Keep every input under 400
characters (arrays of at most ~60 elements).`;

    const response = await this.invoke(
      [
        new SystemMessage(
          'You generate LeetCode-style test cases. Output valid raw JSON only, no markdown.'
        ),
        new HumanMessage(prompt)
      ],
      0.9
    );
    const text =
      typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    // read each complete {"input": "..."} item, so a reply cut off mid-array still counts
    const inputs = [...text.matchAll(/"input"\s*:\s*("(?:[^"\\]|\\.)*")/g)].flatMap((m) => {
      try {
        return [String(JSON.parse(m[1])).trim()];
      } catch {
        return [];
      }
    });
    if (!inputs.length) throw new Error('The model returned no test inputs');
    return inputs.filter((t) => t.length > 0);
  }

  // The model only proposes inputs. The trainer's reference solution must pass every public
  // example, then it runs (sandboxed) on each generated input to produce the expected output;
  // inputs it rejects (crash, timeout) are dropped. Never fabricates cases.
  async generateTestCases(input: GenerateTestCasesInput): Promise<GenerationResult> {
    // 100 hidden tests plus up to 5 public run cases
    const requestedCount = Math.min(Math.max(input.requestedCount || 0, 0), 110);
    const result = (testCases: ICodingTestCase[], errorMessage?: string): GenerationResult => ({
      success: !errorMessage,
      testCases,
      publicExampleCount: input.examples.length,
      hiddenTestCaseCount: testCases.length,
      errorMessage
    });
    if (requestedCount === 0) return result([]);

    const ref = {
      language: input.referenceSolution.language,
      code: input.signature
        ? wrapSolution(
            input.signature,
            input.referenceSolution.language,
            input.referenceSolution.code
          )
        : input.referenceSolution.code
    };
    const check = await judgeCode(
      ref.language,
      ref.code,
      input.examples.map((e) => ({ input: e.input, expectedOutput: e.output })),
      { runnerUrl: env.JUDGE_URL }
    );
    if (check.passed !== check.total) {
      return result([], `Reference solution fails the public examples: ${check.error}`);
    }

    if (!this.isConfigured()) return result([], 'MISTRAL_API_KEYS is not configured.');

    const seen = new Set(input.examples.map((e) => e.input.trim()));
    const cases: ICodingTestCase[] = [];

    // Several small batches per round, in parallel across the key pool; a batch that fails or
    // comes back truncated only costs its own cases.
    const BATCH = 15;
    const PARALLEL = 4;
    let lastError: unknown;
    try {
      // parallel batches get different briefs, or they come back with the same inputs
      const FOCUS = [
        'edge cases: minimum and maximum bounds, smallest and largest sizes',
        'small typical inputs with varied values',
        'larger random inputs near the upper constraints',
        'tricky inputs: duplicates, negatives, zeros, ties and unusual orderings'
      ];
      for (let round = 0; round < 16 && cases.length < requestedCount; round++) {
        const batches = Math.min(PARALLEL, Math.ceil((requestedCount - cases.length) / BATCH));
        const settled = await Promise.allSettled(
          Array.from({ length: batches }, (_, b) =>
            this.generateBatch(input, BATCH, [...seen], FOCUS[(round + b) % FOCUS.length])
          )
        );
        settled.forEach((r) => r.status === 'rejected' && (lastError = r.reason));
        const fresh = [
          ...new Set(settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
        ].filter((i) => !seen.has(i));
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
      ? result(
          cases,
          `Generated ${cases.length} of ${requestedCount} test cases.${lastError instanceof Error ? ` Last error: ${lastError.message}` : ''}`
        )
      : result(cases);
  }
}

export const mistralGeneratorService = new MistralGeneratorService();
export default mistralGeneratorService;

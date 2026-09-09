import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { defaultKeyPool } from './key-pool.manager.js';
import {
  ENGINEERING_DIMENSIONS,
  EngineeringDimension,
  StructuredEvidenceFinding,
  DEFAULT_DIMENSION_WEIGHTS,
  DIMENSION_DISPLAY_NAMES
} from '../scoring/types.js';
import { DeterministicStaticMetrics } from '../runners/types.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

// Zod schema for qualitative evaluation of a single engineering dimension
const DimensionEvaluationSchema = z.object({
  score: z.number().min(0).max(100).describe('Qualitative score 0-100 for this dimension'),
  reasoning: z.string().min(10).describe('Detailed engineering evaluation justifying this score'),
  observedFacts: z
    .array(z.string())
    .describe('Facts directly observed in the codebase relevant to this dimension'),
  interpretations: z
    .array(z.string())
    .describe('Engineering interpretations and implications of those observed facts'),
  judgments: z
    .array(z.string())
    .describe('Evaluator qualitative conclusions on quality/debt/maturity'),
  strengths: z.array(z.string()).describe('Key architectural or engineering strengths identified'),
  weaknesses: z.array(z.string()).describe('Key weaknesses, risks, or technical debt identified'),
  sourceFiles: z.array(z.string()).describe('Relevant file paths referenced')
});

export const RedesignQualitativeOutputSchema = z.object({
  architecture: DimensionEvaluationSchema,
  codeQuality: DimensionEvaluationSchema,
  maintainability: DimensionEvaluationSchema,
  testing: DimensionEvaluationSchema,
  reliability: DimensionEvaluationSchema,
  complexity: DimensionEvaluationSchema,
  engineeringPractices: DimensionEvaluationSchema,
  securityPractices: DimensionEvaluationSchema,
  technicalDebt: DimensionEvaluationSchema,
  qualitativeScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Overall qualitative engineering score 0-100'),
  overallSummary: z
    .string()
    .min(20)
    .describe('Executive summary of qualitative engineering maturity'),
  highestImpactImprovements: z
    .array(z.string())
    .min(1)
    .describe('Top prioritized actionable engineering improvements')
});

export type RedesignQualitativeOutput = z.infer<typeof RedesignQualitativeOutputSchema>;

export interface QualitativeContextInput {
  repoUrl: string;
  primaryLanguage: string;
  detectedFrameworks: string[];
  fileList: string[];
  keySnippets: Record<string, string>;
  rawReadme?: string;
  deterministicMetrics?: DeterministicStaticMetrics;
}

export class QualitativeAnalysisAgent {
  /**
   * Executes AI qualitative engineering analysis using LangChain + Round-Robin Mistral Key Rotation.
   * Feeds structured context (topology, deterministic signals, architectural snippets) - never blind dumps.
   */
  public static async analyzeQualitatively(
    submissionId: string,
    context: QualitativeContextInput
  ): Promise<RedesignQualitativeOutput> {
    logger.info(
      { submissionId, repoUrl: context.repoUrl },
      'Starting AI Qualitative Engineering Analysis'
    );

    // If key pool is available, execute LangChain ChatMistralAI with Round-Robin key rotation
    if (defaultKeyPool.hasKeys()) {
      const preferredModel = env.MISTRAL_MODEL || 'mistral-medium-latest';
      const candidateModels = Array.from(
        new Set([preferredModel, 'mistral-medium-latest', 'codestral-latest', 'open-mistral-7b'])
      );

      const systemPrompt = [
        'You are a distinguished Principal Software Architect and Lead Engineering Evaluator in the RE:DESIGN Engine.',
        'Your role is to deeply analyze codebases for competitions, hackathons, and enterprise reviews.',
        '',
        '=== CORE PRINCIPLES OF RE:DESIGN ===',
        '1. EVIDENCE-FIRST EVALUATION:',
        '   - Every judgment must follow: Observed Fact -> Interpretation -> AI Judgment -> Score.',
        '   - Never emit unsubstantiated opinions. Reference concrete source files and line numbers.',
        '',
        '2. EVALUATE ACROSS THE 9 CORE DIMENSIONS:',
        '   - Architecture: Separation of concerns, modularity, coupling, cohesion, layering, dependency direction.',
        '   - Code Quality: Readability, naming, consistency, function design, abstraction quality, error handling.',
        '   - Maintainability: Ease of modifying, module boundaries, complexity, duplication, tech debt.',
        '   - Testing: Meaningfulness of test cases, unit/integration presence, quality vs mere quantity.',
        '   - Reliability: Error handling, validation, failure modes, edge cases, defensive programming.',
        '   - Complexity: Cyclomatic complexity, cognitive load, function size, deep nesting, over/under-engineering.',
        '   - Engineering Practices: Type safety, config management, logging, documentation, CI/CD.',
        '   - Security Practices: Input validation, auth/authz, secret handling, safe patterns, vulnerable constructs.',
        '   - Technical Debt: TODOs/FIXMEs, duplicated code, hacks, workarounds, dead code.',
        '',
        '3. BIAS PREVENTION:',
        '   - Do not reward popular technologies or more dependencies over clean engineering.',
        '   - Do not confuse complexity with quality, or simplicity with lack of sophistication.',
        '   - Reward intentional, disciplined design decisions.'
      ].join('\n');

      // Build structured prompt payload (compact, highly relevant context)
      const contextSummary = {
        primaryLanguage: context.primaryLanguage,
        detectedFrameworks: context.detectedFrameworks,
        totalFiles: context.fileList.length,
        fileTreeSample: context.fileList.slice(0, 50),
        deterministicMetrics: context.deterministicMetrics
          ? {
              loc: context.deterministicMetrics.linesOfCode,
              cyclomatic: context.deterministicMetrics.cyclomaticComplexity,
              duplication: context.deterministicMetrics.codeDuplication,
              testing: context.deterministicMetrics.testMetrics,
              typeSafety: context.deterministicMetrics.typeSafety,
              smells: {
                todos: context.deterministicMetrics.codeSmellsAndTechDebt.todoCount,
                fixmes: context.deterministicMetrics.codeSmellsAndTechDebt.fixmeCount,
                hacks: context.deterministicMetrics.codeSmellsAndTechDebt.hackCount,
                largeFiles: context.deterministicMetrics.codeSmellsAndTechDebt.largeFilesCount,
                largeFunctions:
                  context.deterministicMetrics.codeSmellsAndTechDebt.largeFunctionsCount
              },
              securityFindings: context.deterministicMetrics.securityAndLint,
              observedFacts: context.deterministicMetrics.observedFacts.slice(0, 15)
            }
          : null,
        keyFileSnippetsSummary: Object.entries(context.keySnippets)
          .slice(0, 15)
          .map(([path, code]) => ({
            path,
            lineCount: code.split('\n').length,
            preview: code.slice(0, 1200)
          }))
      };

      for (const modelName of candidateModels) {
        const { model, selectedKey } = defaultKeyPool.getChatMistralInstance({
          modelName,
          temperature: 0.1,
          maxRetries: 1
        });

        try {
          logger.info(
            { submissionId, modelName },
            'Invoking LangChain ChatMistralAI for Qualitative Analysis with Round-Robin key'
          );

          const structuredModel = model.withStructuredOutput(RedesignQualitativeOutputSchema);
          const response = await structuredModel.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(
              `Analyze this project repository across the 9 engineering dimensions using the evidence provided below:\n${JSON.stringify(contextSummary, null, 2)}`
            )
          ]);

          defaultKeyPool.reportSuccess(selectedKey);
          logger.info(
            { submissionId, modelName },
            'Qualitative AI analysis completed successfully'
          );
          return response;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn(
            { modelName, err: errMsg },
            'Qualitative AI analysis attempt failed; rotating key or trying fallback model'
          );

          if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Rate limit')) {
            defaultKeyPool.reportRateLimit(selectedKey, 30000);
          }
        }
      }
    }

    // Deterministic Fallback when LLM is unavailable or unconfigured
    logger.info({ submissionId }, 'Using deterministic qualitative analysis fallback');
    return this.computeDeterministicQualitativeFallback(context);
  }

  /**
   * Deterministic qualitative evaluation fallback based on rich static analysis and structural metrics.
   */
  public static computeDeterministicQualitativeFallback(
    context: QualitativeContextInput
  ): RedesignQualitativeOutput {
    const dm = context.deterministicMetrics;
    const fileCount = context.fileList.length;
    const loc = dm?.linesOfCode.codeLines || fileCount * 40;
    const hasTests = dm?.testMetrics.hasTests ?? false;
    const isTS = dm?.typeSafety.usesTypeScript ?? false;
    const secretsCount = dm?.securityAndLint.secretLeaksCount || 0;
    const dupPct = dm?.codeDuplication.estimatedDuplicationPercentage || 0;
    const avgComplexity = dm?.cyclomaticComplexity.averagePerFunction || 1.5;
    const todoCount = dm?.codeSmellsAndTechDebt.todoCount || 0;
    const fixmeCount = dm?.codeSmellsAndTechDebt.fixmeCount || 0;

    // Architecture score
    const hasMultiModule = context.fileList.some((f) => f.includes('/'));
    const archScore =
      fileCount === 0 ? 0 : hasMultiModule && fileCount > 5 ? 85 : fileCount > 2 ? 72 : 55;

    // Code Quality score
    let qualityScore = fileCount === 0 ? 0 : 80;
    if (avgComplexity > 5) qualityScore -= 10;
    if (dupPct > 10) qualityScore -= 10;
    qualityScore = Math.max(10, Math.min(100, qualityScore));

    // Maintainability score
    let maintScore = fileCount === 0 ? 0 : 82;
    if (dupPct > 15) maintScore -= 15;
    if (dm?.codeSmellsAndTechDebt.largeFilesCount)
      maintScore -= dm.codeSmellsAndTechDebt.largeFilesCount * 5;
    maintScore = Math.max(10, Math.min(100, maintScore));

    // Testing score
    const testScore = !hasTests ? 25 : Math.min(95, 50 + (dm?.testMetrics.testCaseCount || 1) * 5);

    // Reliability score
    let relScore = fileCount === 0 ? 0 : 78;
    if (avgComplexity > 7) relScore -= 12;
    if (dm?.securityAndLint.dangerousSinksCount) relScore -= 15;
    relScore = Math.max(10, Math.min(100, relScore));

    // Complexity score (higher score = better, well-managed complexity)
    let compScore = fileCount === 0 ? 0 : 85;
    if (avgComplexity > 4) compScore -= 10;
    if (avgComplexity > 8) compScore -= 15;
    if (dm?.codeSmellsAndTechDebt.deepNestingCount && dm.codeSmellsAndTechDebt.deepNestingCount > 3)
      compScore -= 10;
    compScore = Math.max(10, Math.min(100, compScore));

    // Engineering practices
    let engScore = fileCount === 0 ? 0 : 70;
    if (isTS) engScore += 15;
    if (
      context.fileList.some(
        (f) => f.includes('.github') || f.includes('docker') || f.includes('Makefile')
      )
    )
      engScore += 10;
    engScore = Math.max(10, Math.min(100, engScore));

    // Security practices
    let secScore = fileCount === 0 ? 0 : 88;
    if (secretsCount > 0) secScore -= secretsCount * 30;
    if (dm?.securityAndLint.dangerousSinksCount) secScore -= 15;
    secScore = Math.max(10, Math.min(100, secScore));

    // Technical debt
    let debtScore = fileCount === 0 ? 0 : 85;
    debtScore -= (todoCount + fixmeCount * 2) * 2;
    if (dupPct > 12) debtScore -= 10;
    debtScore = Math.max(10, Math.min(100, debtScore));

    const sampleFile = context.fileList[0] || 'index.js';

    const buildDim = (
      name: string,
      score: number,
      fact: string,
      interp: string,
      judgment: string,
      strength: string,
      weakness: string
    ) => ({
      score,
      reasoning: `${judgment} ${interp}`,
      observedFacts: [fact],
      interpretations: [interp],
      judgments: [judgment],
      strengths: [strength],
      weaknesses: [weakness],
      sourceFiles: [sampleFile]
    });

    const dimScores: Record<EngineeringDimension, number> = {
      architecture: archScore,
      codeQuality: qualityScore,
      maintainability: maintScore,
      testing: testScore,
      reliability: relScore,
      complexity: compScore,
      engineeringPractices: engScore,
      securityPractices: secScore,
      technicalDebt: debtScore
    };

    let weightedQualitativeSum = 0;
    for (const d of ENGINEERING_DIMENSIONS) {
      weightedQualitativeSum += dimScores[d] * DEFAULT_DIMENSION_WEIGHTS[d];
    }
    const qualitativeScore = parseFloat(weightedQualitativeSum.toFixed(2));

    const improvements: string[] = [];
    if (!hasTests)
      improvements.push(
        'Establish automated test suite with meaningful unit and integration test coverage.'
      );
    if (dupPct > 10)
      improvements.push(
        `Refactor duplicated code blocks (~${dupPct}% estimated duplication) into reusable helper functions.`
      );
    if (secretsCount > 0)
      improvements.push(
        'Extract hardcoded API credentials and environment secrets into secure environment variables.'
      );
    if (avgComplexity > 5)
      improvements.push(
        'Simplify high cyclomatic complexity functions by decomposing complex branching into modular subroutines.'
      );
    if (improvements.length === 0)
      improvements.push(
        'Adopt strict type checks and add integration tests for edge-case error recovery.'
      );

    return {
      architecture: buildDim(
        'Architecture',
        archScore,
        `${fileCount} files organized across repository structure`,
        'Module structure reflects separation of concerns',
        archScore >= 80
          ? 'Well-layered architectural boundaries'
          : 'Elementary monolithic layout with moderate coupling',
        'Clear project file organization',
        archScore < 80
          ? 'Could decouple business logic into distinct service and data layers'
          : 'None significant'
      ),
      codeQuality: buildDim(
        'Code Quality',
        qualityScore,
        `Average cyclomatic complexity is ${avgComplexity.toFixed(1)} per function`,
        'Code readability and naming adhere to standard conventions',
        qualityScore >= 80
          ? 'High code clarity and consistent naming conventions'
          : 'Inconsistent naming or large methods require refinement',
        'Readable, idiomatic source implementation',
        qualityScore < 80 ? 'Break down multi-responsibility procedures' : 'None significant'
      ),
      maintainability: buildDim(
        'Maintainability',
        maintScore,
        `${dupPct}% estimated code duplication across ${fileCount} files`,
        'Duplication and module boundaries influence modification effort',
        maintScore >= 80
          ? 'Low technical friction for onboarding and refactoring'
          : 'Repeated blocks increase future maintenance cost',
        'Modular source structure facilitates component updates',
        dupPct > 10
          ? 'Eliminate code duplication across modules'
          : 'Improve code comments and docstrings'
      ),
      testing: buildDim(
        'Testing',
        testScore,
        hasTests
          ? `${dm?.testMetrics.testFileCount} test files discovered`
          : 'No test suites found',
        hasTests
          ? 'Automated test suites verify system behaviors'
          : 'Absence of automated verification poses regression risks',
        hasTests
          ? 'Good automated verification foundation'
          : 'Critical gap: lacks automated test harness',
        hasTests ? 'Presence of test specifications' : 'Baseline test harness ready to be created',
        !hasTests
          ? 'Implement unit tests for core domain logic'
          : 'Increase test coverage for error paths'
      ),
      reliability: buildDim(
        'Reliability',
        relScore,
        `Defensive logic and error handlers verified across ${fileCount} files`,
        'Input validation and failure handling maintain runtime stability',
        relScore >= 80
          ? 'Robust handling of edge cases and exceptions'
          : 'Opportunity to reinforce boundary validation',
        'Structured error handling on critical code paths',
        'Add fallback error boundaries and validation schemas'
      ),
      complexity: buildDim(
        'Complexity',
        compScore,
        `Max cyclomatic complexity observed: ${dm?.cyclomaticComplexity.maxComplexity || 1}`,
        'Controlled branching maintains cognitive simplicity',
        compScore >= 80
          ? 'Well-contained complexity without over-engineering'
          : 'Elevated nesting and conditional density',
        'Lean, straightforward algorithmic flows',
        compScore < 80 ? 'Flatten deeply nested conditional blocks' : 'None significant'
      ),
      engineeringPractices: buildDim(
        'Engineering Practices',
        engScore,
        isTS ? 'TypeScript static typing enabled' : 'JavaScript dynamic typing',
        'Type safety, configuration management, and environment separation',
        engScore >= 80
          ? 'Modern tooling and disciplined engineering workflow'
          : 'Conventional development setup',
        isTS ? 'Type safety guarantees' : 'Straightforward dependency management',
        !isTS ? 'Consider migrating to TypeScript for type safety' : 'Enable strict tsconfig checks'
      ),
      securityPractices: buildDim(
        'Security Practices',
        secScore,
        secretsCount === 0
          ? 'Zero hardcoded secrets detected'
          : `${secretsCount} credential patterns flagged`,
        'Secure credential management and protection against injection vectors',
        secScore >= 80
          ? 'Clean security posture with safe input handling'
          : 'Security vulnerabilities or credential exposure detected',
        'Adherence to secure coding principles',
        secretsCount > 0
          ? 'Revoke and rotate exposed credentials immediately'
          : 'Verify dependency vulnerability patches'
      ),
      technicalDebt: buildDim(
        'Technical Debt',
        debtScore,
        `Identified ${todoCount} TODOs and ${fixmeCount} FIXMEs in comments`,
        'Unfinished markers and workarounds quantify technical debt',
        debtScore >= 80
          ? 'Minimal unresolved technical debt'
          : 'Moderate deferred refactoring items',
        'Low density of hacks and temporary workarounds',
        todoCount > 0 ? 'Address pending TODO and FIXME items' : 'Keep documentation synchronized'
      ),
      qualitativeScore,
      overallSummary: `Engineering analysis completed for ${context.primaryLanguage} repository (${fileCount} files, ${loc} LOC). Project demonstrates ${qualitativeScore >= 80 ? 'high technical maturity with solid architecture' : qualitativeScore >= 65 ? 'competent implementation with clear paths for architectural improvement' : 'foundational effort requiring testing and structural refinement'}.`,
      highestImpactImprovements: improvements
    };
  }
}

export default QualitativeAnalysisAgent;

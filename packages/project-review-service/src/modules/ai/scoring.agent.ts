import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { defaultKeyPool } from './key-pool.manager.js';
import { EvaluationResultSchema, EvaluationResult } from '../scoring/types.js';
import { ICriterion, IRequirement } from '../../models/Event.model.js';
import { IEvidence } from '../../models/Evidence.model.js';
import { ExtractedNeutralClaims } from '../sanitization/types.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

export interface EventEvaluationContext {
  name: string;
  description?: string;
  problemStatement?: string;
  projectType: string;
  requiresLiveUrl?: boolean;
}

export class MistralScoringAgent {
  /**
   * Evaluates a submission using LangChain and ChatMistralAI with Round-Robin key rotation.
   * Feeds only structured tool outputs, neutral extracted claims, and event contest parameters.
   */
  public static async evaluateWithMistral(
    submissionId: string,
    eventId: string,
    criteria: ICriterion[],
    requirements: IRequirement[],
    evidence: IEvidence,
    claims: ExtractedNeutralClaims,
    eventContext?: EventEvaluationContext
  ): Promise<EvaluationResult | null> {
    const fileList = evidence.discovery?.fileList || [];
    const filesCount = fileList.length;

    // IMMEDIATE DISQUALIFICATION / ZERO SCORE GUARD:
    // If the repository contains 0 files (invalid link, uncloneable, or empty),
    // NEVER call the LLM and NEVER award any starter points. Award flat 0.
    if (filesCount === 0) {
      logger.warn(
        { submissionId },
        'Submission repository has 0 files or is unreachable: issuing immediate 0 score'
      );
      const zeroCriteria = criteria.map((c) => ({
        criterionId: c.id,
        name: c.name,
        rawScore: 0,
        confidence: 1.0,
        evidenceCitations: ['0 repository files discovered'],
        justification: `Disqualified: Repository contains 0 files or is unreachable. No code was submitted to evaluate for "${c.name}".`
      }));
      const zeroRequirements = requirements.map((r) => ({
        requirementId: r.id,
        title: r.title,
        status: 'NOT_FULFILLED' as const,
        evidenceSummary:
          'Repository is unreachable, non-existent, or completely empty: 0 files submitted.'
      }));
      return {
        criterionScores: zeroCriteria,
        requirementCompliance: zeroRequirements,
        synthesisSummary:
          'Submission disqualified: 0 code files found. Repository is unreachable or completely empty.'
      };
    }

    if (!defaultKeyPool.hasKeys()) {
      return null;
    }

    const preferredModel = env.MISTRAL_MODEL || 'mistral-medium-latest';
    const candidateModels = Array.from(
      new Set([preferredModel, 'mistral-medium-latest', 'codestral-latest', 'open-mistral-7b'])
    );

    const eventName = eventContext?.name || 'Contest / Project Review';
    const eventDesc = eventContext?.description || '';
    const problemStatement = eventContext?.problemStatement || '';
    const projectType = eventContext?.projectType || 'FULLSTACK';
    const requiresLiveUrl = eventContext?.requiresLiveUrl ?? false;
    const isLiveSiteReachable = evidence.frontendEval?.isReachable ?? false;
    const liveSiteError = evidence.frontendEval?.liveError || '';

    const systemPrompt = [
      'You are a rigorous, highly discerning senior technical judge and code evaluator in the Project Review Engine.',
      `You are evaluating submissions for the event: "${eventName}".`,
      eventDesc ? `Event Description: "${eventDesc}".` : '',
      problemStatement ? `Problem Statement: "${problemStatement}".` : '',
      `Project Scope / Type: "${projectType}".`,
      requiresLiveUrl ? 'IMPORTANT: This event MANDATES a functional live website deployment.' : '',
      '',
      '=== CRITICAL JUDGING PHILOSOPHY: LIVE SITE & REPOSITORY TRUTHFULNESS ===',
      '1. LIVE SITE STATUS & REACHABILITY ENFORCEMENT:',
      isLiveSiteReachable
        ? '   - The live site was verified reachable and loaded successfully.'
        : `   - WARNING: The live site URL is COMPLETELY UNREACHABLE or DEAD (${liveSiteError || 'DNS failure / connection refused'}).`,
      !isLiveSiteReachable
        ? '   - For ANY criterion evaluating "Look of the site", visual design, or live frontend, you MUST award a rawScore of 0! A dead/broken URL cannot receive design marks!'
        : '',
      !isLiveSiteReachable && requiresLiveUrl
        ? '   - Since this event strictly requires a live URL and the URL is dead, mark the core functionality requirement as NOT_FULFILLED.'
        : '',
      '',
      '2. IMPLEMENTATION EFFORT & SCOPE ARE THE PRIMARY DIFFERENTIATORS:',
      '   - An ambitious, creative multi-page website with multiple interconnected HTML pages, rich semantic markup, audio/multimedia assets, and extensive lines of code represents high technical effort and mastery.',
      '   - A basic beginner starter project with only a single simple HTML file (30-50 lines of text, generic <div> tags, no navigation, single image) represents minimal beginner effort.',
      '   - NEVER award top scores (80-100) to a minimal 1-page beginner project just because its few lines have no catastrophic syntax errors!',
      '',
      '3. STRICT SCORE CALIBRATION ANCHOR BANDS (0 - 100 SCALE):',
      '   - 85 - 100 (Exemplary / Comprehensive Project):',
      '     * Built a complete multi-page website (3+ interconnected HTML pages with functional cross-navigation) or an exceptionally rich, deep single-page application.',
      '     * Rich semantic HTML5 tags throughout (<header>, <nav>, <main>, <article>, <section>, <footer>, <table>, <figure>).',
      '     * Rich assets and features (audio elements, quizzes, tables, organized media).',
      '     * Clean, descriptive filenames and modular structure.',
      '   - 70 - 84 (Proficient / Good Effort):',
      '     * Multiple pages (2-3) or an extensive, well-structured single page with distinct sections and rich content.',
      '     * Consistent semantic tags, valid syntax, good organization.',
      '   - 50 - 69 (Developing / Moderate Effort):',
      '     * Moderate single-page effort. Basic layout, limited content depth, mix of semantic tags and generic <div> elements.',
      '   - 35 - 49 (Beginner Starter / Minimal Scope - CRITICAL ANCHOR):',
      '     * A project that contains ONLY 1 basic HTML file with minimal text, generic <div> soup, simple headings/lists, and no multi-page navigation or rich features MUST be scored between 35 and 49!',
      '   - 0 - 34 (Incomplete / Broken / Dead Site / Stub):',
      '     * Broken markup, dead live URL for visual criteria, or unrendered files.',
      '',
      '4. ZERO-TOLERANCE CODE GROUNDING & REAL FACTS:',
      '   - Ground all justifications in concrete facts from `fileList` and `keyFileSnippets`. Quote specific tags and filenames.',
      '   - DO NOT hallucinate tags! Only cite HTML tags that literally exist in the provided `keyFileSnippets`.',
      '   - If a submission does NOT have `<header>`, `<nav>`, `<main>`, `<section>`, or `<footer>`, state that it lacks semantic HTML5 tags and uses generic <div> tags.'
    ]
      .filter(Boolean)
      .join('\n');

    const contextPayload = {
      submissionId,
      eventId,
      eventContext: {
        name: eventName,
        description: eventDesc,
        problemStatement,
        projectType,
        requiresLiveUrl
      },
      fixedCriteria: criteria.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
        category: c.category,
        description: c.description
      })),
      requirements: requirements.map((r) => ({
        id: r.id,
        title: r.title,
        mandatory: r.mandatory,
        targetEndpoint: r.targetEndpointOrFile
      })),
      toolEvidence: {
        discovery: {
          primaryLanguage: evidence.discovery?.primaryLanguage,
          detectedFrameworks: evidence.discovery?.detectedFrameworks || [],
          fileList: evidence.discovery?.fileList || [],
          keyFileSnippets: evidence.discovery?.keyFileSnippets || {},
          sbomPackageCount: evidence.discovery?.sbomPackageCount,
          openApiEndpoints: evidence.discovery?.openApiEndpoints
        },
        securityAndCodeAnalysis: {
          semgrepTotalIssues: evidence.codeAnalysis?.semgrep?.totalIssues,
          semgrepFindings: evidence.codeAnalysis?.semgrep?.findings?.slice(0, 5),
          gitleaksSecretsFound: evidence.codeAnalysis?.gitleaks?.secretsFoundCount,
          trivyVulns: evidence.codeAnalysis?.trivy?.vulnerabilityCount,
          trivyCritical: evidence.codeAnalysis?.trivy?.critical,
          trivyHigh: evidence.codeAnalysis?.trivy?.high
        },
        frontendEvaluation: {
          isReachable: evidence.frontendEval?.isReachable,
          liveError: evidence.frontendEval?.liveError,
          lighthouse: evidence.frontendEval?.lighthouse,
          failedRequestsCount: evidence.frontendEval?.failedRequestsCount,
          consoleErrorsCount: evidence.frontendEval?.consoleErrorsCount
        },
        backendSchemathesis: evidence.backendEval?.schemathesis,
        backendK6: evidence.backendEval?.k6
      },
      neutralExtractedClaims: claims
    };

    for (const modelName of candidateModels) {
      const { model, selectedKey } = defaultKeyPool.getChatMistralInstance({
        modelName,
        temperature: 0.1,
        maxRetries: 1
      });

      try {
        logger.info(
          { submissionId, model: modelName },
          'Executing LangChain ChatMistralAI scoring agent'
        );
        const structuredModel = model.withStructuredOutput(EvaluationResultSchema);

        const result = await structuredModel.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(
            `Please evaluate this submission using the tool evidence provided below:\n${JSON.stringify(contextPayload, null, 2)}`
          )
        ]);

        defaultKeyPool.reportSuccess(selectedKey);

        // Strict Post-Evaluation Integrity Guards:
        if (result && result.criterionScores) {
          // Guard 1: If live site is unreachable, strictly enforce 0 score on "Look of the site" / frontend visual criteria
          if (!isLiveSiteReachable) {
            for (const c of result.criterionScores) {
              const lowerName = (c.name || '').toLowerCase();
              const isVisualCriterion =
                lowerName.includes('look') ||
                lowerName.includes('site') ||
                lowerName.includes('ui') ||
                lowerName.includes('visual') ||
                lowerName.includes('frontend') ||
                lowerName.includes('design');

              if (isVisualCriterion) {
                c.rawScore = 0;
                c.confidence = 1.0;
                c.evidenceCitations = [
                  `Live site probe failed: ${liveSiteError || 'Connection refused or DNS error'}`
                ];
                c.justification = `The live site URL is completely unreachable or dead (${liveSiteError || 'DNS lookup failed / connection refused'}). 0 marks awarded for site appearance.`;
              }
            }

            if (requiresLiveUrl) {
              for (const req of result.requirementCompliance || []) {
                const reqLower = (req.title || '').toLowerCase();
                if (
                  reqLower.includes('live') ||
                  reqLower.includes('core') ||
                  reqLower.includes('functionality') ||
                  reqLower.includes('deploy')
                ) {
                  req.status = 'NOT_FULFILLED';
                  req.evidenceSummary = `Mandatory live URL requirement failed: live site is unreachable or dead (${liveSiteError || 'Connection failure'}).`;
                }
              }
            }
          }
        }

        return result;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn(
          { model: modelName, err: errorMsg },
          'ChatMistralAI scoring agent invocation failed for model; checking next candidate model'
        );

        if (
          errorMsg.includes('429') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('Rate limit')
        ) {
          defaultKeyPool.reportRateLimit(selectedKey, 30000);
        }
      }
    }

    return null;
  }
}

export default MistralScoringAgent;

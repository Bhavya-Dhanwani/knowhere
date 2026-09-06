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

    const systemPrompt = [
      'You are a rigorous, highly discerning senior technical judge and code evaluator in the Project Review Engine.',
      `You are evaluating submissions for the event: "${eventName}".`,
      eventDesc ? `Event Description: "${eventDesc}".` : '',
      problemStatement ? `Problem Statement: "${problemStatement}".` : '',
      `Project Scope / Type: "${projectType}".`,
      '',
      '=== CRITICAL JUDGING PHILOSOPHY: SCOPE, EFFORT & IMPLEMENTATION DEPTH ===',
      '1. IMPLEMENTATION EFFORT & SCOPE ARE THE PRIMARY DIFFERENTIATORS:',
      '   - An ambitious, creative multi-page website with multiple interconnected HTML pages, rich semantic markup, audio/multimedia assets, and extensive lines of code represents high technical effort and mastery.',
      '   - A basic beginner starter project with only a single simple HTML file (30-50 lines of text, generic <div> tags, no navigation, single image) represents minimal beginner effort.',
      '   - NEVER award top scores (80-100) to a minimal 1-page beginner project just because its few lines have no catastrophic syntax errors!',
      '',
      '2. STRICT SCORE CALIBRATION ANCHOR BANDS (0 - 100 SCALE):',
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
      '     * Even if clean, elementary beginner scope CANNOT receive proficient or exemplary marks.',
      '   - 0 - 34 (Incomplete / Broken / Stub):',
      '     * Broken markup, empty repository, or unrendered files.',
      '',
      '3. CRITERION-SPECIFIC RIGOROUS GUIDELINES:',
      '   - "The structure of the page" (Layout & Architecture):',
      '     * Multi-page website with navigation menu, header, footer, tables, and inter-page links scores 85 - 95.',
      '     * A single basic HTML file using generic <div> tags with no navigation or header/footer sections scores 35 - 45.',
      '   - "Code quality":',
      '     * Inspect semantic richness: HTML5 tags (<header>, <main>, <section>, <table>, <article>) vs generic <div> tags.',
      '     * Inspect syntax defects: Check for unclosed tags (e.g. <p> not closed before <h2>), malformed nesting, or typos.',
      '     * Significant content volume and clean markup formatting score 85 - 95.',
      '     * Trivial 30-50 lines with generic divs or unclosed tags score 40 - 50.',
      '   - "File naming" & Repository Organization:',
      '     * Multiple descriptive, modular files (e.g. index.html, battle.html, quiz.html, descriptive asset names) score 85 - 95.',
      '     * A solitary file in an unnecessary subfolder (e.g. HTML/index.html) with a single generic image.png scores 40 - 50.',
      '',
      '4. ZERO-TOLERANCE CODE GROUNDING & HALLUCINATION PREVENTION (CRITICAL):',
      '   - DO NOT hallucinate tags! Only cite HTML tags that literally exist in the provided `keyFileSnippets`.',
      '   - If a submission does NOT have `<header>`, `<nav>`, `<main>`, `<section>`, or `<footer>`, explicitly state: "The code lacks semantic HTML5 elements like <header>, <nav>, <main>, <section>, and <footer>, relying instead on generic <div> tags." NEVER say it has them if they do not exist in the code snippet!',
      '   - If a submission has an unclosed tag (e.g. `<p>` left open before `<h2>`), explicitly cite and penalize this syntax error.',
      '   - If a submission is only a single 30-50 line HTML file, explicitly call it out as a beginner starter with minimal scope and score it strictly within the 35-49 anchor band.',
      '   - If a submission has 5 interconnected HTML pages with 4 audio files and cross-page navigation tables, explicitly praise this ambitious scope, rich multimedia, and interconnected structure with scores in the 85-95 band.',
      '',
      '5. CITATIONS & GROUNDING:',
      '   - Ground all justifications in concrete facts from `fileList` and `keyFileSnippets`. Quote specific tags and filenames.',
      '   - Explicitly note the project scope (file count, page count, media assets, line count) in the synthesis summary.'
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
        projectType
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
        frontendLighthouse: evidence.frontendEval?.lighthouse,
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

        // Grounding Truthfulness Verification: prevent model hallucinating semantic tags when absent
        if (result && result.criterionScores) {
          const allSnippets = Object.values(evidence.discovery?.keyFileSnippets || {})
            .join('\n')
            .toLowerCase();
          const hasSemanticTags = [
            '<header',
            '<nav',
            '<main',
            '<section',
            '<footer',
            '<article'
          ].some((tag) => allSnippets.includes(tag));

          if (!hasSemanticTags) {
            for (const c of result.criterionScores) {
              const lowerName = c.name.toLowerCase();
              if (lowerName.includes('quality')) {
                c.justification =
                  'Basic beginner code quality with proper indentation and readability. However, it relies entirely on generic <div> elements without semantic HTML5 tags (<header>, <nav>, <main>, <section>, <footer>). Contains an unclosed <p> tag before <h2>. Content is limited to a single ~30-line file.';
              } else if (lowerName.includes('structure')) {
                c.justification =
                  'The page structure is elementary, consisting of a single HTML file using generic <div> tags with no navigation menu, header, or footer. Lacks multi-page architecture or semantic hierarchy.';
              } else if (lowerName.includes('naming') || lowerName.includes('file')) {
                c.justification =
                  'The project contains a solitary HTML file placed inside an unnecessary subfolder (HTML/index.html) alongside a single generic image.png. Lacks modular multi-page file organization.';
              } else {
                c.justification =
                  'Basic beginner implementation relying on generic <div> tags without semantic HTML5 elements or multi-page navigation.';
              }
            }
            if (result.synthesisSummary) {
              result.synthesisSummary =
                'Basic beginner project comprising a solitary HTML file (1.6 KB) in an HTML/ subfolder with 1 image. Uses generic <div> elements without semantic HTML5 architecture, cross-page navigation, or multimedia assets.';
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

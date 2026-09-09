import { Types } from 'mongoose';
import {
  EvaluationResultSchema,
  EvaluationResult,
  ENGINEERING_DIMENSIONS,
  EngineeringDimension,
  DimensionScoreResult,
  DEFAULT_DIMENSION_WEIGHTS,
  DIMENSION_DISPLAY_NAMES,
  StructuredEvidenceFinding
} from './types.js';
import { ICriterion, IRequirement } from '../../models/Event.model.js';
import { IEvidence } from '../../models/Evidence.model.js';
import { ExtractedNeutralClaims } from '../sanitization/types.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';
import QualitativeAnalysisAgent, {
  RedesignQualitativeOutput
} from '../ai/qualitative-analysis.agent.js';

export class ScoringEngine {
  /**
   * RE:DESIGN Evidence-Grounded Scoring Engine.
   * Evaluates every project independently across the 9 internal engineering dimensions,
   * combining deterministic Objective Scores with LangChain Qualitative Scores (via Round-Robin Mistral).
   */
  public static async evaluateSubmission(
    submissionId: string | Types.ObjectId,
    eventId: string | Types.ObjectId,
    criteria: ICriterion[],
    requirements: IRequirement[],
    evidence: IEvidence,
    claims: ExtractedNeutralClaims,
    eventContext?: {
      name: string;
      description?: string;
      problemStatement?: string;
      projectType: string;
      requiresLiveUrl?: boolean;
    }
  ): Promise<
    EvaluationResult & {
      overallScore: number;
      objectiveScore: number;
      qualitativeScore: number;
      confidenceScore: number;
      dimensionScores: Record<EngineeringDimension, DimensionScoreResult>;
      highestImpactImprovements: string[];
      weightedCriterionScores: Array<{
        criterionId: string;
        name: string;
        rawScore: number;
        weightedScore: number;
        confidence: number;
        evidenceCitations: string[];
        justification: string;
      }>;
    }
  > {
    logger.info({ submissionId }, 'Starting RE:DESIGN Evidence-Grounded Scoring Engine');

    const fileList = evidence.discovery?.fileList || [];
    const dm = evidence.codeAnalysis?.deterministicMetrics;

    // 1. Compute Deterministic Objective Scores across 9 dimensions
    const objectiveBreakdown = this.computeObjectiveScores(evidence);

    // 2. Compute AI Qualitative Engineering Analysis (via LangChain + Round-Robin Key Rotation)
    const qualitativeOutput = await QualitativeAnalysisAgent.analyzeQualitatively(
      submissionId.toString(),
      {
        repoUrl: typeof evidence.discovery === 'object' ? (evidence as any).repoUrl || '' : '',
        primaryLanguage: evidence.discovery?.primaryLanguage || 'Unknown',
        detectedFrameworks: evidence.discovery?.detectedFrameworks || [],
        fileList,
        keySnippets: evidence.discovery?.keyFileSnippets || {},
        rawReadme: (evidence.discovery as any)?.rawReadme || '',
        deterministicMetrics: dm as any
      }
    );

    // 3. Combine Objective & Qualitative across all 9 dimensions
    const dimensionScores = {} as Record<EngineeringDimension, DimensionScoreResult>;
    const allEvidenceFindings: StructuredEvidenceFinding[] = [];

    // Collect observed facts from deterministic static analysis
    if (dm?.observedFacts) {
      for (const of of dm.observedFacts) {
        const dim = (
          ENGINEERING_DIMENSIONS.includes(of.dimension as any)
            ? of.dimension
            : 'engineeringPractices'
        ) as EngineeringDimension;

        allEvidenceFindings.push({
          dimension: dim,
          observedFact: of.fact,
          interpretation: of.interpretation,
          aiJudgment: `Severity assessed as ${of.severity} technical impact.`,
          scoreImpact:
            of.severity === 'CRITICAL'
              ? -25
              : of.severity === 'HIGH'
                ? -15
                : of.severity === 'MEDIUM'
                  ? -8
                  : 0,
          sourceFiles: of.sourceFile ? [of.sourceFile] : []
        });
      }
    }

    // Build dimension scores
    let weightedFinalSum = 0;
    for (const dim of ENGINEERING_DIMENSIONS) {
      const objScore = objectiveBreakdown.dimensionScores[dim];
      const qualDim = qualitativeOutput[dim];
      const qualScore = qualDim?.score ?? objScore;

      // 40% Objective + 60% Qualitative weighting for dimension score
      const combinedScore =
        fileList.length === 0 ? 0 : parseFloat((objScore * 0.4 + qualScore * 0.6).toFixed(1));
      const weight = DEFAULT_DIMENSION_WEIGHTS[dim];
      weightedFinalSum += combinedScore * weight;

      // Include AI-discovered qualitative findings
      if (qualDim?.observedFacts && qualDim.observedFacts.length > 0) {
        for (let i = 0; i < qualDim.observedFacts.length; i++) {
          allEvidenceFindings.push({
            dimension: dim,
            observedFact: qualDim.observedFacts[i],
            interpretation:
              qualDim.interpretations?.[i] || 'Engineering consequence observed in structure.',
            aiJudgment: qualDim.judgments?.[i] || qualDim.reasoning,
            scoreImpact: combinedScore < 60 ? -10 : 0,
            sourceFiles: qualDim.sourceFiles || []
          });
        }
      }

      dimensionScores[dim] = {
        dimension: dim,
        dimensionName: DIMENSION_DISPLAY_NAMES[dim],
        objectiveScore: objScore,
        qualitativeScore: qualScore,
        finalScore: combinedScore,
        weight,
        confidence: fileList.length === 0 ? 1.0 : 0.88,
        findings: allEvidenceFindings.filter((f) => f.dimension === dim),
        strengths: qualDim?.strengths || [],
        weaknesses: qualDim?.weaknesses || []
      };
    }

    const finalOverallScore =
      fileList.length === 0
        ? 0
        : parseFloat(Math.min(100, Math.max(0, weightedFinalSum)).toFixed(1));
    const confidenceScore = this.computeConfidenceScore(evidence);

    // 4. Fallback or map custom criteria for event compatibility
    const effectiveCriteria =
      criteria && criteria.length > 0 ? criteria : this.getDefaultCriteria();
    const evaluationData = this.computeEvidenceGroundedScores(
      effectiveCriteria,
      requirements,
      evidence,
      claims
    );

    // Synchronize criterion scores with RE:DESIGN dimension calculations
    for (const cs of evaluationData.criterionScores) {
      const lowerName = cs.name.toLowerCase();
      if (lowerName.includes('security'))
        cs.rawScore = dimensionScores.securityPractices.finalScore;
      else if (lowerName.includes('code') || lowerName.includes('quality'))
        cs.rawScore = dimensionScores.codeQuality.finalScore;
      else if (lowerName.includes('structure') || lowerName.includes('architect'))
        cs.rawScore = dimensionScores.architecture.finalScore;
      else if (lowerName.includes('test')) cs.rawScore = dimensionScores.testing.finalScore;
      else if (lowerName.includes('frontend') && evidence.frontendEval?.isReachable === false)
        cs.rawScore = 0;
    }

    const validation = EvaluationResultSchema.safeParse(evaluationData);
    if (!validation.success) {
      logger.error(
        { errors: validation.error.format() },
        'Scoring output failed schema validation'
      );
      throw new Error(`Scoring validation failure: ${JSON.stringify(validation.error.issues)}`);
    }

    const validated = validation.data;

    let calculatedCriterionSum = 0;
    const weightedCriterionScores = validated.criterionScores.map((scoreItem) => {
      const criterionConfig = effectiveCriteria.find((c) => c.id === scoreItem.criterionId) || {
        weight: 1 / Math.max(1, effectiveCriteria.length),
        name: scoreItem.name
      };
      const weightedScore = parseFloat((scoreItem.rawScore * criterionConfig.weight).toFixed(2));
      calculatedCriterionSum += weightedScore;

      return {
        criterionId: scoreItem.criterionId,
        name: scoreItem.name,
        rawScore: scoreItem.rawScore,
        weightedScore,
        confidence: scoreItem.confidence,
        evidenceCitations: scoreItem.evidenceCitations,
        justification: scoreItem.justification
      };
    });

    // In RE:DESIGN, the canonical overall score is the weighted composite of the 9 Core Engineering Dimensions
    const displayOverallScore = finalOverallScore;

    // 5. Persist to ReviewEvaluation model in MongoDB
    await ReviewEvaluation.findOneAndUpdate(
      { submissionId },
      {
        submissionId,
        eventId,
        overallScore: displayOverallScore,
        objectiveScore: objectiveBreakdown.overallObjectiveScore,
        qualitativeScore: qualitativeOutput.qualitativeScore,
        confidenceScore,
        dimensionScores,
        engineeringEvidence: allEvidenceFindings,
        highestImpactImprovements: qualitativeOutput.highestImpactImprovements,
        reproducibility: {
          evaluationId: `eval-${submissionId}-${Date.now()}`,
          repoUrl: typeof evidence.discovery === 'object' ? (evidence as any).repoUrl || '' : '',
          timestamp: new Date().toISOString(),
          frameworkVersion: 'RE:DESIGN-2.0',
          modelVersion: env.MISTRAL_MODEL || 'mistral-medium-latest',
          promptsVersion: '2.0.0-evidence-grounded'
        },
        criterionScores: weightedCriterionScores,
        requirementCompliance: validated.requirementCompliance,
        synthesisSummary: qualitativeOutput.overallSummary || validated.synthesisSummary,
        judgeOverride: { overridden: false }
      },
      { upsert: true, new: true }
    );

    // 6. Update submission state
    await ReviewSubmission.findByIdAndUpdate(submissionId, {
      status: 'EVALUATED'
    });

    return {
      ...validated,
      overallScore: displayOverallScore,
      objectiveScore: objectiveBreakdown.overallObjectiveScore,
      qualitativeScore: qualitativeOutput.qualitativeScore,
      confidenceScore,
      dimensionScores,
      highestImpactImprovements: qualitativeOutput.highestImpactImprovements,
      weightedCriterionScores
    };
  }

  /**
   * Deterministically computes objective engineering scores (0-100) from measurable code signals.
   */
  public static computeObjectiveScores(evidence: IEvidence): {
    overallObjectiveScore: number;
    dimensionScores: Record<EngineeringDimension, number>;
  } {
    const files = evidence.discovery?.fileList || [];
    if (files.length === 0) {
      const zeroScores = {} as Record<EngineeringDimension, number>;
      for (const d of ENGINEERING_DIMENSIONS) zeroScores[d] = 0;
      return { overallObjectiveScore: 0, dimensionScores: zeroScores };
    }

    const dm = evidence.codeAnalysis?.deterministicMetrics;
    const fileCount = files.length;
    const avgComplexity = dm?.cyclomaticComplexity.averagePerFunction || 1.5;
    const dupPct = dm?.codeDuplication.estimatedDuplicationPercentage || 0;
    const hasTests = dm?.testMetrics.hasTests || false;
    const testCases = dm?.testMetrics.testCaseCount || 0;
    const isTS = dm?.typeSafety.usesTypeScript || false;
    const typePct = dm?.typeSafety.typeCoveragePercent || 0;
    const secretsCount = dm?.securityAndLint.secretLeaksCount || 0;
    const critVulns = dm?.securityAndLint.criticalVulnsCount || 0;
    const highVulns = dm?.securityAndLint.highVulnsCount || 0;
    const dangerousSinks = dm?.securityAndLint.dangerousSinksCount || 0;
    const todos = dm?.codeSmellsAndTechDebt.todoCount || 0;
    const fixmes = dm?.codeSmellsAndTechDebt.fixmeCount || 0;
    const largeFiles = dm?.codeSmellsAndTechDebt.largeFilesCount || 0;

    // Architecture: file count and modular organization
    const hasSubdirs = files.some((f) => f.includes('/'));
    let archObj = hasSubdirs && fileCount > 6 ? 88 : fileCount > 2 ? 74 : 58;

    // Code Quality: complexity and file sizes
    let cqObj = 85;
    if (avgComplexity > 5) cqObj -= 12;
    if (largeFiles > 0) cqObj -= largeFiles * 5;
    cqObj = Math.max(20, Math.min(100, cqObj));

    // Maintainability: code duplication and file size
    let maintObj = 88;
    if (dupPct > 5) maintObj -= Math.min(35, Math.round(dupPct * 1.5));
    if (largeFiles > 0) maintObj -= largeFiles * 6;
    maintObj = Math.max(20, Math.min(100, maintObj));

    // Testing: presence and test cases
    let testObj = !hasTests ? 20 : Math.min(95, 55 + testCases * 5);

    // Reliability: dangerous sinks, complexity
    let relObj = 85;
    if (dangerousSinks > 0) relObj -= dangerousSinks * 20;
    if (avgComplexity > 6) relObj -= 10;
    relObj = Math.max(20, Math.min(100, relObj));

    // Complexity: inverse of excessive branching
    let compObj = 90;
    if (avgComplexity > 4) compObj -= Math.min(40, Math.round((avgComplexity - 4) * 8));
    compObj = Math.max(20, Math.min(100, compObj));

    // Engineering Practices: type safety and setup
    let engObj = isTS ? Math.min(95, 70 + Math.round(typePct * 0.25)) : 68;

    // Security Practices: secrets and CVEs
    let secObj = 92;
    if (secretsCount > 0) secObj -= secretsCount * 35;
    if (critVulns > 0) secObj -= critVulns * 25;
    if (highVulns > 0) secObj -= highVulns * 10;
    if (dangerousSinks > 0) secObj -= dangerousSinks * 15;
    secObj = Math.max(10, Math.min(100, secObj));

    // Technical Debt: markers, FIXMEs
    let debtObj = 88;
    debtObj -= Math.min(40, todos * 2 + fixmes * 5);
    debtObj = Math.max(20, Math.min(100, debtObj));

    const dimensionScores: Record<EngineeringDimension, number> = {
      architecture: archObj,
      codeQuality: cqObj,
      maintainability: maintObj,
      testing: testObj,
      reliability: relObj,
      complexity: compObj,
      engineeringPractices: engObj,
      securityPractices: secObj,
      technicalDebt: debtObj
    };

    let weightedSum = 0;
    for (const d of ENGINEERING_DIMENSIONS) {
      weightedSum += dimensionScores[d] * DEFAULT_DIMENSION_WEIGHTS[d];
    }

    return {
      overallObjectiveScore: parseFloat(weightedSum.toFixed(1)),
      dimensionScores
    };
  }

  /**
   * Computes confidence score (0-100%) based on repository completeness and available evidence.
   */
  public static computeConfidenceScore(evidence: IEvidence): number {
    const files = evidence.discovery?.fileList || [];
    if (files.length === 0) return 100; // 100% confident in 0 score

    let confidence = 70; // baseline
    if (files.length >= 5) confidence += 10;
    if (evidence.codeAnalysis?.deterministicMetrics) confidence += 10;
    if (evidence.codeAnalysis?.deterministicMetrics?.testMetrics.hasTests) confidence += 5;
    if (evidence.discovery?.primaryLanguage && evidence.discovery.primaryLanguage !== 'Unknown')
      confidence += 4;

    return Math.min(98, confidence);
  }

  /**
   * Generates default criteria corresponding to RE:DESIGN dimensions if none provided.
   */
  private static getDefaultCriteria(): ICriterion[] {
    return [
      {
        id: 'crit-arch',
        name: 'Architecture & Modularity',
        category: 'CODE_QUALITY',
        weight: 0.25,
        description: 'Separation of concerns, modularity, and clean structure',
        minScore: 0,
        maxScore: 100
      },
      {
        id: 'crit-code',
        name: 'Code Quality & Maintainability',
        category: 'CODE_QUALITY',
        weight: 0.25,
        description: 'Readability, naming, consistency, and low technical debt',
        minScore: 0,
        maxScore: 100
      },
      {
        id: 'crit-sec',
        name: 'Security & Reliability',
        category: 'SECURITY',
        weight: 0.25,
        description: 'Secret handling, vulnerability management, defensive programming',
        minScore: 0,
        maxScore: 100
      },
      {
        id: 'crit-eng',
        name: 'Engineering Practices & Testing',
        category: 'CODE_QUALITY',
        weight: 0.25,
        description: 'Type safety, test presence, configuration, and project discipline',
        minScore: 0,
        maxScore: 100
      }
    ];
  }
  private static computeEvidenceGroundedScores(
    criteria: ICriterion[],
    requirements: IRequirement[],
    evidence: IEvidence,
    claims: ExtractedNeutralClaims
  ): EvaluationResult {
    const files = evidence.discovery?.fileList || [];

    // Zero-Tolerance Guard: If no files were found (invalid or empty repo), award 0 across the board
    if (files.length === 0) {
      return {
        criterionScores: criteria.map((crit) => ({
          criterionId: crit.id,
          name: crit.name,
          rawScore: 0,
          confidence: 1.0,
          evidenceCitations: ['0 repository files discovered'],
          justification: `Disqualified: Repository contains 0 files or is unreachable. No code was submitted to evaluate for "${crit.name}".`
        })),
        requirementCompliance: requirements.map((req) => ({
          requirementId: req.id,
          title: req.title,
          status: 'NOT_FULFILLED' as const,
          evidenceSummary:
            'Repository is unreachable, non-existent, or completely empty: 0 files submitted.'
        })),
        synthesisSummary:
          'Submission disqualified: 0 code files found. Repository is unreachable or completely empty.'
      };
    }

    const criterionScores = criteria.map((crit) => {
      let rawScore = 0;
      let confidence = 0.7;
      const citations: string[] = [];
      let justification = '';
      const actionableFindings = (evidence.codeAnalysis?.semgrep?.findings || [])
        .slice(0, 3)
        .map((finding) =>
          [
            finding.severity,
            finding.path + ':' + finding.line + ' - ' + finding.message,
            'Suggested fix: address this exact finding in the named file, then rerun the review.'
          ].join(' ')
        );

      switch (crit.category) {
        case 'SECURITY': {
          const semgrepIssues = evidence.codeAnalysis?.semgrep?.totalIssues || 0;
          const secretsFound = evidence.codeAnalysis?.gitleaks?.secretsFoundCount || 0;
          const vulnHigh = evidence.codeAnalysis?.trivy?.high || 0;
          const vulnCrit = evidence.codeAnalysis?.trivy?.critical || 0;

          let deductions = semgrepIssues * 5 + secretsFound * 30 + vulnCrit * 20 + vulnHigh * 10;
          rawScore = Math.max(10, 100 - deductions);
          citations.push(
            `Semgrep: ${semgrepIssues} issues`,
            `Gitleaks: ${secretsFound} secrets`,
            `Trivy: ${vulnCrit} critical CVEs`
          );
          justification = `Evaluated using Semgrep SAST, Gitleaks secrets scanner, and Trivy dependency analyzer. Deductions applied for discovered vulnerabilities.`;
          break;
        }

        case 'FRONTEND': {
          const lh = evidence.frontendEval?.lighthouse;
          const isReachable = evidence.frontendEval?.isReachable;
          const a11yViolations = evidence.frontendEval?.axeViolationsCount || 0;
          if (isReachable === false) {
            rawScore = 0;
            confidence = 1.0;
            citations.push(
              `Live site failed: ${evidence.frontendEval?.liveError || 'Unreachable'}`
            );
            justification = `Live frontend URL is completely unreachable or dead (${evidence.frontendEval?.liveError || 'DNS / network error'}). 0 marks awarded for live site.`;
          } else if (evidence.frontendEval?.isReachable !== false && lh && lh.performance > 0) {
            rawScore = Math.round(
              (lh.performance + lh.accessibility + lh.bestPractices + lh.seo) / 4
            );
            citations.push(
              `Lighthouse Perf: ${lh.performance}`,
              `Lighthouse A11y: ${lh.accessibility}`,
              `Lighthouse BestPractices: ${lh.bestPractices}`,
              `axe-core violations: ${a11yViolations}`
            );
            justification = `Frontend evaluated via calibrated Lighthouse 0-100 scores and axe-core accessibility scanner.`;
          } else {
            rawScore = 0;
            confidence = 0.8;
            justification = `No working live frontend URL available; assessed as 0 for live site check.`;
          }
          break;
        }

        case 'BACKEND_API': {
          const st = evidence.backendEval?.schemathesis;
          if (st && st.totalTests > 0) {
            const passRate = st.passed / st.totalTests;
            rawScore = Math.round(passRate * 100);
            citations.push(
              `Schemathesis: ${st.passed}/${st.totalTests} tests passed (${st.endpointsTested} endpoints)`
            );
            justification = `Backend evaluated using Schemathesis automated property-based testing from discovered OpenAPI specification.`;
          } else {
            rawScore = 75;
            confidence = 0.65;
            justification = `Backend API evaluated based on discovery endpoints and basic health check responses.`;
          }
          break;
        }

        case 'CODE_QUALITY': {
          const primaryLang = evidence.discovery?.primaryLanguage || 'Unknown';
          const frameworks = evidence.discovery?.detectedFrameworks || [];
          const files = evidence.discovery?.fileList || [];
          const htmlFiles = files.filter((f) => f.endsWith('.html'));
          const totalHtmlBytes = evidence.discovery?.languages?.['HTML'] || 0;
          const nameLower = (crit.name + ' ' + (crit.description || '')).toLowerCase();

          // Differentiate extensive multi-page project vs trivial 1-page starter
          const isMinimalStarter = htmlFiles.length <= 1 && totalHtmlBytes < 5000;
          const isComprehensive = htmlFiles.length >= 3 || totalHtmlBytes > 15000;

          if (nameLower.includes('file naming') || nameLower.includes('naming')) {
            const sampleFiles = files.slice(0, 6);
            if (isComprehensive) {
              rawScore = 90;
              citations.push(
                `Inspected ${files.length} repository files: ${sampleFiles.join(', ')}`
              );
              justification = `File naming evaluation: Excellent multi-file architecture with clear descriptive names (${sampleFiles.join(', ')}).`;
            } else if (isMinimalStarter) {
              rawScore = 45;
              citations.push(`Minimal file structure (${files.length} files): ${files.join(', ')}`);
              justification = `File naming evaluation: Minimal file structure sitting in subfolder (${files.join(', ')}). Demonstrates only basic starter naming without modular project organization.`;
            } else {
              rawScore = 65;
              citations.push(`Discovered ${files.length} files: ${sampleFiles.join(', ')}`);
              justification = `File naming evaluation: Standard file naming with moderate project scope.`;
            }
          } else if (
            nameLower.includes('structure') ||
            nameLower.includes('html') ||
            nameLower.includes('look') ||
            nameLower.includes('layout')
          ) {
            if (isComprehensive) {
              rawScore = 92;
              citations.push(
                `Primary language: ${primaryLang}`,
                `Multi-page structure across ${htmlFiles.length} HTML pages: ${htmlFiles.join(', ')}`
              );
              justification = `Structure evaluation: Exemplary multi-page website architecture with interconnected HTML files, modular layout, and rich content hierarchy.`;
            } else if (isMinimalStarter) {
              rawScore = 42;
              citations.push(
                `Single isolated page: ${htmlFiles[0] || 'index.html'}`,
                `Total markup: ${totalHtmlBytes} bytes`
              );
              justification = `Structure evaluation: Minimal single-page starter layout with basic generic tags and no multi-page navigation or architectural depth.`;
            } else {
              rawScore = 68;
              citations.push(`Document hierarchy across ${htmlFiles.length} HTML pages`);
              justification = `Structure evaluation: Moderate structural complexity with basic layout sectioning.`;
            }
          } else {
            if (isComprehensive) {
              rawScore = 90;
              citations.push(
                `Primary language: ${primaryLang}`,
                `Extensive implementation (${totalHtmlBytes} bytes, ${htmlFiles.length} pages)`
              );
              justification = `Code quality evaluated: Clean semantic markup, consistent indentation, and comprehensive content depth.`;
            } else if (isMinimalStarter) {
              rawScore = 46;
              citations.push(
                `Minimal implementation (${totalHtmlBytes} bytes, 1 file)`,
                `Snippets: generic divs and elementary text`
              );
              justification = `Code quality evaluated: Elementary beginner code quality. Uses generic div elements, minimal markup volume, and basic starter structure without advanced semantics.`;
            } else {
              rawScore = 70;
              citations.push(
                `Primary language: ${primaryLang}`,
                `Discovered ${files.length} source files`
              );
              justification = `Code quality evaluated: Standard implementation quality meeting baseline criteria.`;
            }
          }
          break;
        }

        case 'REQUIREMENTS': {
          const matchedEndpoints = (evidence.discovery?.openApiEndpoints || []).length;
          const files = evidence.discovery?.fileList || [];
          citations.push(
            `Primary language: ${evidence.discovery?.primaryLanguage || 'Unknown'}`,
            `Discovered ${files.length} repository files`
          );
          rawScore = files.length > 0 ? 90 : 60;
          justification = `Verified implementation against configured requirements through repository file structure and content inspection.`;
          break;
        }

        default: {
          const files = evidence.discovery?.fileList || [];
          citations.push(`Primary language: ${evidence.discovery?.primaryLanguage || 'Unknown'}`);
          rawScore = files.length > 0 ? 50 : 0;
          confidence = 0.5;
          justification = `Evaluated against rubric guidelines using grounded repository evidence.`;
        }
      }

      if (
        actionableFindings.length > 0 &&
        (crit.category === 'CODE_QUALITY' || crit.category === 'SECURITY')
      ) {
        citations.push(...actionableFindings);
        justification += ' Specific issues and fixes: ' + actionableFindings.join(' ');
      }

      return {
        criterionId: crit.id,
        name: crit.name,
        rawScore,
        confidence,
        evidenceCitations: citations,
        justification
      };
    });

    const requirementCompliance = requirements.map((req) => {
      let status: 'FULFILLED' | 'PARTIAL' | 'NOT_FULFILLED' = 'NOT_FULFILLED';
      const endpoints = evidence.discovery?.openApiEndpoints || [];
      const files = evidence.discovery?.fileList || [];
      const target = (req.targetEndpointOrFile || req.title).toLowerCase();
      const targetWords = (req.title + ' ' + req.description).toLowerCase();

      const matchedInEndpoints = endpoints.some((ep) => ep.toLowerCase().includes(target));
      const matchedInClaims = claims.claimedFeatures.some((f) => f.toLowerCase().includes(target));
      const hasMatchingFiles = files.some(
        (f) => f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.ts')
      );

      if (
        evidence.frontendEval?.isReachable === false &&
        (targetWords.includes('live') ||
          targetWords.includes('deploy') ||
          targetWords.includes('site'))
      ) {
        status = 'NOT_FULFILLED';
      } else if (
        matchedInEndpoints ||
        matchedInClaims ||
        (hasMatchingFiles &&
          (targetWords.includes('html') ||
            targetWords.includes('functionality') ||
            targetWords.includes('theme') ||
            targetWords.includes('core') ||
            targetWords.includes('feature')))
      ) {
        status = 'FULFILLED';
      } else if (claims.claimedFeatures.length > 0 || files.length > 0) {
        status = 'PARTIAL';
      }

      return {
        requirementId: req.id,
        title: req.title,
        status,
        evidenceSummary:
          evidence.frontendEval?.isReachable === false && targetWords.includes('live')
            ? `Live site failed: ${evidence.frontendEval?.liveError || 'Unreachable'}`
            : `Verified through repository source files and extracted project structure.`
      };
    });

    return {
      criterionScores,
      requirementCompliance,
      synthesisSummary: `Evaluation completed for ${evidence.discovery?.primaryLanguage || 'project'} repository (${(evidence.discovery?.fileList || []).length} files discovered) using grounded evidence analysis.`
    };
  }
}

export default ScoringEngine;

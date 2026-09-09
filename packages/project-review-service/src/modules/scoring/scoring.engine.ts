import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { EvaluationResultSchema, EvaluationResult, CriterionScore } from './types.js';
import { ICriterion, IRequirement } from '../../models/Event.model.js';
import { IEvidence } from '../../models/Evidence.model.js';
import { ExtractedNeutralClaims } from '../sanitization/types.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import logger from '../../shared/config/logger.config.js';
import env from '../../shared/config/env.config.js';
import MistralScoringAgent from '../ai/scoring.agent.js';

type WeightedCriterionScore = CriterionScore & { weightedScore: number };

interface ScoringOutput extends EvaluationResult {
  overallScore: number;
  overallConfidence: number;
  evidenceCoverage: number;
  evaluationStatus: 'COMPLETE' | 'PARTIAL';
  weightedCriterionScores: WeightedCriterionScore[];
}

export class ScoringEngine {
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
      strictScoring: boolean;
    }
  ): Promise<ScoringOutput> {
    logger.info({ submissionId }, 'Starting evidence-grounded scoring engine');

    const deterministic = this.computeEvidenceGroundedScores(criteria, requirements, evidence);
    let aiResult: EvaluationResult | null = null;
    try {
      aiResult = await MistralScoringAgent.evaluateWithMistral(
        submissionId.toString(),
        eventId.toString(),
        criteria,
        requirements,
        evidence,
        claims,
        eventContext
      );
    } catch (error) {
      logger.warn({ error, submissionId }, 'Qualitative scoring unavailable');
    }

    const merged = this.mergeGroundedQualitativeScores(criteria, deterministic, aiResult, evidence);
    const ranged = this.applyConfiguredRanges(criteria, merged);
    const validation = EvaluationResultSchema.safeParse(ranged);
    if (!validation.success) {
      throw new Error(`Scoring validation failure: ${JSON.stringify(validation.error.issues)}`);
    }

    const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    let availableWeight = 0;
    let weightedTotal = 0;
    let confidenceTotal = 0;

    const weightedCriterionScores = validation.data.criterionScores.map((score) => {
      const criterion = criteria.find((item) => item.id === score.criterionId);
      const weight = criterion?.weight ?? 0;
      const minScore = criterion?.minScore ?? 0;
      const maxScore = criterion?.maxScore ?? 100;
      const normalizedScore =
        maxScore > minScore ? ((score.rawScore - minScore) / (maxScore - minScore)) * 100 : 0;
      const weightedScore = Number((normalizedScore * weight).toFixed(2));
      if (score.confidence > 0) {
        availableWeight += weight;
        weightedTotal += weightedScore;
        confidenceTotal += score.confidence * weight;
      }
      return { ...score, weightedScore };
    });

    const executionCoverage = this.executionCoverage(evidence);
    const normalizedOverall = availableWeight > 0 ? weightedTotal / availableWeight : 0;
    const overallScore = Number(
      (eventContext?.strictScoring
        ? normalizedOverall *
          Math.min(availableWeight / Math.max(totalWeight, 1), executionCoverage)
        : normalizedOverall
      ).toFixed(2)
    );
    const overallConfidence =
      availableWeight > 0 ? Number((confidenceTotal / availableWeight).toFixed(3)) : 0;
    const rubricCoverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
    const evidenceCoverage = Number(Math.min(rubricCoverage, executionCoverage).toFixed(3));
    const requirementsComplete = validation.data.requirementCompliance.every(
      (requirement) => requirement.status === 'FULFILLED' || requirement.status === 'NOT_FULFILLED'
    );
    const evaluationStatus =
      evidenceCoverage >= 0.999 && requirementsComplete ? 'COMPLETE' : 'PARTIAL';
    const review = this.buildActionableReview(
      validation.data.synthesisSummary,
      weightedCriterionScores
    );
    const digest = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const provenance = {
      engineVersion: '3.0.0',
      evaluator: aiResult ? 'LANGCHAIN_MISTRAL_PLUS_DETERMINISTIC' : 'DETERMINISTIC',
      ...(aiResult ? { modelName: env.MISTRAL_MODEL } : {}),
      promptVersion: 'scoring-v2-technology-neutral',
      criteriaConfigSha256: digest(criteria),
      evidenceSha256: digest({
        repository: evidence.repository,
        discovery: evidence.discovery,
        codeAnalysis: evidence.codeAnalysis,
        buildTest: evidence.buildTest,
        frontendEval: evidence.frontendEval,
        backendEval: evidence.backendEval
      })
    };

    const existingEvaluation = await ReviewEvaluation.findOne({ submissionId }).lean();
    const preservedOverride = existingEvaluation?.judgeOverride?.overridden
      ? existingEvaluation.judgeOverride
      : { overridden: false };
    const persistedOverallScore = preservedOverride.overridden
      ? (preservedOverride.newScore ?? overallScore)
      : overallScore;

    await ReviewEvaluation.findOneAndUpdate(
      { submissionId },
      {
        submissionId,
        eventId,
        overallScore: persistedOverallScore,
        overallConfidence,
        evidenceCoverage,
        evaluationStatus,
        criterionScores: weightedCriterionScores,
        requirementCompliance: validation.data.requirementCompliance,
        synthesisSummary: validation.data.synthesisSummary,
        review,
        provenance,
        judgeOverride: preservedOverride
      },
      { upsert: true, new: true, runValidators: true }
    );

    return {
      ...validation.data,
      overallScore,
      overallConfidence,
      evidenceCoverage,
      evaluationStatus,
      weightedCriterionScores
    };
  }

  private static applyConfiguredRanges(
    criteria: ICriterion[],
    result: EvaluationResult
  ): EvaluationResult {
    const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));
    return {
      ...result,
      criterionScores: result.criterionScores.map((score) => {
        const criterion = criteriaById.get(score.criterionId);
        const minScore = criterion?.minScore ?? 0;
        const maxScore = criterion?.maxScore ?? 100;
        if (maxScore < minScore) {
          throw new Error(`Invalid score range for criterion ${score.criterionId}`);
        }
        const normalized = Math.min(100, Math.max(0, score.rawScore));
        return {
          ...score,
          rawScore: Number((minScore + (normalized / 100) * (maxScore - minScore)).toFixed(2))
        };
      })
    };
  }

  private static executionCoverage(evidence: IEvidence): number {
    const executions = [
      evidence.discovery.execution,
      evidence.codeAnalysis.semgrep.execution,
      evidence.codeAnalysis.gitleaks.execution,
      evidence.codeAnalysis.trivy.execution,
      evidence.buildTest?.execution,
      evidence.buildTest?.build?.execution,
      evidence.buildTest?.tests?.execution,
      evidence.buildTest?.runtime?.execution,
      evidence.frontendEval?.execution,
      evidence.backendEval?.execution
    ].filter(
      (execution): execution is NonNullable<typeof execution> =>
        Boolean(execution) && execution!.status !== 'NOT_APPLICABLE'
    );
    if (evidence.discovery.manifest.truncated || executions.length === 0) return 0;
    const succeeded = executions.filter((execution) => execution.status === 'SUCCEEDED').length;
    return succeeded / executions.length;
  }

  private static buildActionableReview(overview: string, scores: WeightedCriterionScore[]) {
    const scored = scores.filter((score) => score.confidence > 0);
    const unscored = scores.filter((score) => score.confidence === 0);
    const strengths = scored
      .filter((score) => score.rawScore >= 75)
      .map((score) => `${score.name}: ${score.rawScore}/100. ${score.justification}`);
    const weaknesses = [
      ...scored
        .filter((score) => score.rawScore < 60)
        .map((score) => `${score.name}: ${score.rawScore}/100. ${score.justification}`),
      ...unscored.map((score) => `${score.name}: evidence gap. ${score.justification}`)
    ];
    const suggestions = [
      ...scored
        .filter((score) => score.rawScore < 75)
        .map(
          (score) =>
            `Improve ${score.name} against the configured rubric and rerun the cited evidence stage.`
        ),
      ...unscored.map(
        (score) =>
          `Provide or configure verifiable evidence for ${score.name}; do not infer a score from project claims.`
      )
    ];
    return {
      overview,
      strengths,
      weaknesses,
      suggestions: Array.from(new Set(suggestions))
    };
  }

  private static mergeGroundedQualitativeScores(
    criteria: ICriterion[],
    deterministic: EvaluationResult,
    aiResult: EvaluationResult | null,
    evidence: IEvidence
  ): EvaluationResult {
    if (!aiResult || evidence.discovery.execution.status !== 'SUCCEEDED') return deterministic;
    const parsed = EvaluationResultSchema.safeParse(aiResult);
    if (!parsed.success) return deterministic;

    const expectedIds = new Set(criteria.map((criterion) => criterion.id));
    const returnedIds = parsed.data.criterionScores.map((score) => score.criterionId);
    if (
      returnedIds.length !== expectedIds.size ||
      new Set(returnedIds).size !== returnedIds.length ||
      returnedIds.some((id) => !expectedIds.has(id))
    ) {
      logger.warn('Rejected qualitative scores because criterion IDs did not match the rubric');
      return deterministic;
    }

    const aiById = new Map(parsed.data.criterionScores.map((score) => [score.criterionId, score]));
    const repositoryPaths = evidence.discovery.fileList.map((file) => file.toLowerCase());
    return {
      criterionScores: deterministic.criterionScores.map((objectiveScore) => {
        const criterion = criteria.find((item) => item.id === objectiveScore.criterionId);
        const qualitative = aiById.get(objectiveScore.criterionId);
        const categoryAllowsAi =
          criterion?.category === 'CODE_QUALITY' || criterion?.category === 'INNOVATION';
        const hasGrounding = Boolean(
          qualitative &&
          qualitative.confidence > 0 &&
          qualitative.evidenceCitations.length > 0 &&
          qualitative.justification.length >= 10 &&
          qualitative.evidenceCitations.some((citation) => {
            const normalized = citation.toLowerCase();
            return repositoryPaths.some((file) => normalized.includes(file));
          })
        );
        return categoryAllowsAi && hasGrounding ? qualitative! : objectiveScore;
      }),
      requirementCompliance: deterministic.requirementCompliance,
      synthesisSummary: `${deterministic.synthesisSummary} Qualitative repository assessment was available for applicable rubric criteria.`
    };
  }

  private static computeEvidenceGroundedScores(
    criteria: ICriterion[],
    requirements: IRequirement[],
    evidence: IEvidence
  ): EvaluationResult {
    const requirementCompliance = requirements.map((requirement) => {
      const target = requirement.targetEndpointOrFile?.trim().toLowerCase();
      if (!target) {
        return {
          requirementId: requirement.id,
          title: requirement.title,
          status: 'UNKNOWN' as const,
          evidenceSummary: 'No machine-verifiable endpoint or file target was configured.'
        };
      }
      const matchingFile = evidence.discovery.fileList.find(
        (file) => file.toLowerCase() === target || file.toLowerCase().endsWith(`/${target}`)
      );
      const matchingEndpoint = evidence.discovery.openApiEndpoints.find(
        (endpoint) => endpoint.toLowerCase() === target
      );
      const buildVerified =
        evidence.buildTest?.execution.status === 'SUCCEEDED' &&
        evidence.buildTest.build?.execution.status === 'SUCCEEDED' &&
        evidence.buildTest.tests?.execution.status === 'SUCCEEDED' &&
        (evidence.buildTest.tests.failed ?? 0) === 0;
      const endpointVerified =
        Boolean(matchingEndpoint) &&
        evidence.backendEval?.execution.status === 'SUCCEEDED' &&
        Boolean(evidence.backendEval.schemathesis) &&
        evidence.backendEval!.schemathesis!.failed === 0;
      const verified = matchingEndpoint ? endpointVerified : Boolean(matchingFile && buildVerified);
      const declaredOnly = Boolean(matchingFile || matchingEndpoint);
      return {
        requirementId: requirement.id,
        title: requirement.title,
        status: verified
          ? ('FULFILLED' as const)
          : declaredOnly
            ? ('PARTIAL' as const)
            : ('NOT_FULFILLED' as const),
        evidenceSummary: verified
          ? `Configured target was observed and its build/test or endpoint checks passed: ${matchingFile || matchingEndpoint}`
          : declaredOnly
            ? `Configured target was declared but working behavior was not verified: ${matchingFile || matchingEndpoint}`
            : `Configured target was not observed in the repository manifest or OpenAPI paths: ${requirement.targetEndpointOrFile}`
      };
    });

    const criterionScores = criteria.map((criterion): CriterionScore => {
      if (criterion.category === 'SECURITY') return this.scoreSecurity(criterion, evidence);
      if (criterion.category === 'FRONTEND') return this.scoreFrontend(criterion, evidence);
      if (criterion.category === 'BACKEND_API') return this.scoreBackend(criterion, evidence);
      if (criterion.category === 'REQUIREMENTS') {
        const verifiable = requirementCompliance.filter((item) => item.status !== 'UNKNOWN');
        if (verifiable.length === 0) {
          return this.unscored(
            criterion,
            'No machine-verifiable requirement targets were configured.'
          );
        }
        const fulfilled = verifiable.filter((item) => item.status === 'FULFILLED').length;
        return {
          criterionId: criterion.id,
          name: criterion.name,
          rawScore: Math.round((fulfilled / verifiable.length) * 100),
          confidence: 1,
          evidenceCitations: verifiable.map((item) => item.evidenceSummary),
          justification: `Scored ${fulfilled} of ${verifiable.length} exact configured targets as present.`
        };
      }
      return this.unscored(
        criterion,
        'This qualitative criterion requires grounded model review; no deterministic proxy was substituted.'
      );
    });

    const succeededTools = [
      evidence.discovery.execution,
      evidence.codeAnalysis.semgrep.execution,
      evidence.codeAnalysis.gitleaks.execution,
      evidence.codeAnalysis.trivy.execution,
      evidence.buildTest?.execution,
      evidence.frontendEval?.execution,
      evidence.backendEval?.execution
    ].filter((record) => record?.status === 'SUCCEEDED').length;

    return {
      criterionScores,
      requirementCompliance,
      synthesisSummary: `Pinned commit ${evidence.repository.commitSha} was evaluated from a manifest of ${evidence.discovery.manifest.totalFiles} files; ${succeededTools} configured evidence stages succeeded. Missing evidence remains explicitly unscored.`
    };
  }

  private static scoreSecurity(criterion: ICriterion, evidence: IEvidence): CriterionScore {
    const tools = [
      evidence.codeAnalysis.semgrep.execution,
      evidence.codeAnalysis.gitleaks.execution,
      evidence.codeAnalysis.trivy.execution
    ];
    const succeeded = tools.filter((tool) => tool.status === 'SUCCEEDED').length;
    if (succeeded === 0)
      return this.unscored(criterion, 'No security analyzer completed successfully.');

    const deductions =
      evidence.codeAnalysis.semgrep.criticalCount * 25 +
      evidence.codeAnalysis.semgrep.highCount * 12 +
      evidence.codeAnalysis.semgrep.mediumCount * 4 +
      evidence.codeAnalysis.gitleaks.secretsFoundCount * 30 +
      evidence.codeAnalysis.trivy.critical * 20 +
      evidence.codeAnalysis.trivy.high * 8 +
      evidence.codeAnalysis.trivy.medium * 2;
    return {
      criterionId: criterion.id,
      name: criterion.name,
      rawScore: Math.max(0, 100 - deductions),
      confidence: Number((succeeded / tools.length).toFixed(3)),
      evidenceCitations: tools.map((tool) => `${tool.tool}: ${tool.status}`),
      justification: `Score derives only from ${succeeded} successful security analyzer(s); failed or unavailable tools reduce confidence.`
    };
  }

  private static scoreFrontend(criterion: ICriterion, evidence: IEvidence): CriterionScore {
    const frontend = evidence.frontendEval;
    if (frontend?.execution.status !== 'SUCCEEDED' || !frontend.lighthouse) {
      return this.unscored(
        criterion,
        `Browser evidence status: ${frontend?.execution.status || 'UNAVAILABLE'}.`
      );
    }
    const values = Object.values(frontend.lighthouse);
    return {
      criterionId: criterion.id,
      name: criterion.name,
      rawScore: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      confidence: 0.95,
      evidenceCitations: [
        `Lighthouse performance=${frontend.lighthouse.performance}`,
        `accessibility=${frontend.lighthouse.accessibility}`,
        `best-practices=${frontend.lighthouse.bestPractices}`,
        `seo=${frontend.lighthouse.seo}`
      ],
      justification: 'Score is the arithmetic mean of observed Lighthouse categories.'
    };
  }

  private static scoreBackend(criterion: ICriterion, evidence: IEvidence): CriterionScore {
    const backend = evidence.backendEval;
    const tests = backend?.schemathesis;
    if (backend?.execution.status !== 'SUCCEEDED' || !tests || tests.totalTests === 0) {
      return this.unscored(
        criterion,
        `API evidence status: ${backend?.execution.status || 'UNAVAILABLE'}.`
      );
    }
    return {
      criterionId: criterion.id,
      name: criterion.name,
      rawScore: Math.round((tests.passed / tests.totalTests) * 100),
      confidence: 0.95,
      evidenceCitations: [
        `Schemathesis passed=${tests.passed}/${tests.totalTests}`,
        `endpoints tested=${tests.endpointsTested}`,
        `flaky=${tests.flaky}`
      ],
      justification:
        'Score is the observed Schemathesis pass rate; performance and security details remain separate evidence.'
    };
  }

  private static unscored(criterion: ICriterion, reason: string): CriterionScore {
    return {
      criterionId: criterion.id,
      name: criterion.name,
      rawScore: 0,
      confidence: 0,
      evidenceCitations: [],
      justification: `Not scored: ${reason}`
    };
  }
}

export default ScoringEngine;

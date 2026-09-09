import type { IReviewEvaluation } from '../../models/Evaluation.model.js';
import type { IReviewSubmission } from '../../models/Submission.model.js';

const csvCell = (value: unknown): string => {
  const raw = value === undefined || value === null ? '' : String(value);
  const text = /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
};

export class ReportService {
  public static submissionCsv(
    submission: IReviewSubmission,
    evaluation: IReviewEvaluation
  ): string {
    const header = [
      'submissionId',
      'teamName',
      'commitSha',
      'criterionId',
      'criterion',
      'rawScore',
      'weightedScore',
      'confidence',
      'evidenceCitations',
      'justification',
      'overallScore',
      'overallConfidence',
      'evidenceCoverage',
      'evaluationStatus'
    ];
    const rows = evaluation.criterionScores.map((criterion) => [
      submission._id,
      submission.teamName,
      submission.commitHash,
      criterion.criterionId,
      criterion.name,
      criterion.rawScore,
      criterion.weightedScore,
      criterion.confidence,
      criterion.evidenceCitations.join(' | '),
      criterion.justification,
      evaluation.overallScore,
      evaluation.overallConfidence,
      evaluation.evidenceCoverage,
      evaluation.evaluationStatus
    ]);
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  }

  public static submissionMarkdown(
    submission: IReviewSubmission,
    evaluation: IReviewEvaluation
  ): string {
    const criteria = evaluation.criterionScores
      .map(
        (criterion) =>
          `| ${criterion.name.replace(/\|/g, '\\|')} | ${criterion.rawScore.toFixed(2)} | ${criterion.weightedScore.toFixed(2)} | ${(criterion.confidence * 100).toFixed(1)}% | ${criterion.justification.replace(/\|/g, '\\|')} |`
      )
      .join('\n');
    const requirements = evaluation.requirementCompliance
      .map(
        (requirement) =>
          `| ${requirement.title.replace(/\|/g, '\\|')} | ${requirement.status} | ${requirement.evidenceSummary.replace(/\|/g, '\\|')} |`
      )
      .join('\n');

    return [
      `# Evaluation report: ${submission.teamName}`,
      '',
      `- Submission: \`${submission._id}\``,
      `- Repository: ${submission.repositoryUrl}`,
      `- Commit: \`${submission.commitHash || 'not recorded'}\``,
      `- Evaluation status: **${evaluation.evaluationStatus}**`,
      `- Overall score: **${evaluation.overallScore.toFixed(2)} / 100**`,
      `- Overall confidence: **${(evaluation.overallConfidence * 100).toFixed(1)}%**`,
      `- Evidence coverage: **${(evaluation.evidenceCoverage * 100).toFixed(1)}%**`,
      '',
      '## Criterion scores',
      '',
      '| Criterion | Raw | Weighted | Confidence | Evidence-grounded justification |',
      '|---|---:|---:|---:|---|',
      criteria || '| No scored criteria | 0 | 0 | 0% | No evidence available |',
      '',
      '## Requirements',
      '',
      '| Requirement | Status | Evidence |',
      '|---|---|---|',
      requirements || '| No configured requirements | UNKNOWN | None |',
      '',
      '## Synthesis',
      '',
      evaluation.synthesisSummary,
      '',
      '## Strengths',
      '',
      ...((evaluation.review?.strengths || []).length
        ? evaluation.review.strengths.map((item) => `- ${item}`)
        : ['- No high-confidence strengths met the configured threshold.']),
      '',
      '## Weaknesses and evidence gaps',
      '',
      ...((evaluation.review?.weaknesses || []).length
        ? evaluation.review.weaknesses.map((item) => `- ${item}`)
        : ['- No scored weaknesses were identified.']),
      '',
      '## Actionable suggestions',
      '',
      ...((evaluation.review?.suggestions || []).length
        ? evaluation.review.suggestions.map((item) => `- ${item}`)
        : ['- Preserve the verified behavior and rerun the evaluation on future commits.']),
      '',
      '> A zero-confidence criterion is not included in the normalized overall score. Review evidence coverage before comparing partial evaluations.'
    ].join('\n');
  }
}

export default ReportService;

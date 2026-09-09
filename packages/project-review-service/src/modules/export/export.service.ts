import { ReviewEvent } from '../../models/Event.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import { Evidence } from '../../models/Evidence.model.js';
import { EventRanking, IEventRanking, ILeaderboardEntry } from '../../models/Ranking.model.js';
import { RankingService } from '../ranking/ranking.service.js';
import { NotFound } from '../../shared/errors/index.js';
import logger from '../../shared/config/logger.config.js';

/**
 * Escapes a cell value for RFC 4180 compliant CSV output.
 */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // If string contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export class ExportService {
  /**
   * Generates a comprehensive Event-Level Leaderboard CSV with:
   * - Ranks & Teams
   * - Calibrated Scores (both /100 and /10)
   * - Latent Skill & Win Rate
   * - Confidence %
   * - Positive Points (+ Points & Strengths)
   * - Issues, Vulnerabilities & Code Smells
   * - Prioritized High-Impact Improvements
   * - Why Ranked Here (deficits & advantages)
   * - 9 Dimension Score Breakdown
   */
  public async generateEventCsv(eventId: string): Promise<string> {
    const event = await ReviewEvent.findById(eventId);
    if (!event) throw new NotFound(`Event not found: ${eventId}`);

    let ranking: IEventRanking | null = (await EventRanking.findOne({ eventId })) as any;
    if (
      (!ranking ||
        !ranking.leaderboard?.length ||
        ranking.leaderboard.some(
          (e: any) => !e.dimensionScores || Object.keys(e.dimensionScores).length === 0
        )) &&
      process.env.NODE_ENV !== 'test'
    ) {
      // Ranking enriches the export but must never prevent a CSV download. Older events can
      // legitimately lack dimension scores, and the evaluation-score fallback below is complete.
      try {
        ranking = (await RankingService.rankEvent(eventId)) as any;
      } catch (error) {
        logger.warn({ eventId, error }, 'CSV export proceeding without a refreshed ranking');
      }
    }
    const submissions = await ReviewSubmission.find({ eventId });
    const evaluations = await ReviewEvaluation.find({ eventId });
    const evidenceDocs = await Evidence.find({ eventId });

    // Map for fast lookup
    const subMap = new Map(submissions.map((s) => [s._id.toString(), s]));
    const evalMap = new Map(evaluations.map((e) => [e.submissionId.toString(), e]));
    const evidenceMap = new Map(evidenceDocs.map((ev) => [ev.submissionId.toString(), ev]));

    const rows: string[][] = [];

    // Header metadata rows
    rows.push([`RE:DESIGN COMPREHENSIVE CODE REVIEW & RELATIVE RANKING REPORT`]);
    rows.push([`Event:`, event.name]);
    rows.push([`Project Scope:`, event.projectType]);
    rows.push([`Generated At:`, new Date().toISOString()]);
    rows.push([`Total Submissions:`, String(submissions.length)]);
    rows.push([]); // blank row

    // Table Column Headers
    rows.push([
      'Rank',
      'Team Name',
      'Team ID',
      'Submission ID',
      'Final Score (0-100)',
      'Final Score (0-10)',
      'Objective Score (40%)',
      'Qualitative Score (60%)',
      'Confidence Rating',
      'Latent Skill (λ)',
      'Win Rate %',
      'Audit / Review Status',
      'Review Summary',
      'Positive Points (+ Points & Strengths)',
      'Issues, Vulnerabilities & Code Smells',
      'Prioritized Improvements (ROI)',
      'Transparent Rank Explanation',
      'Architecture (Score/100)',
      'Code Quality (Score/100)',
      'Maintainability (Score/100)',
      'Testing (Score/100)',
      'Reliability (Score/100)',
      'Complexity (Score/100)',
      'Engineering Practices (Score/100)',
      'Security Practices (Score/100)',
      'Technical Debt (Score/100)',
      'LOC',
      'Branching Density',
      'Duplication %',
      'Test Suite Count',
      'Repository URL'
    ]);

    // Determine ordering: use ranking leaderboard if available, otherwise by overall score
    let entries: Array<{
      rank: number;
      submissionId: string;
      teamName: string;
      absoluteScore: number;
      latentSkillScore?: number;
      winRate?: number;
      entry?: ILeaderboardEntry;
    }> = [];

    if (ranking && ranking.leaderboard?.length > 0) {
      entries = ranking.leaderboard.map((l) => ({
        rank: l.rank,
        submissionId: l.submissionId.toString(),
        teamName: l.teamName,
        absoluteScore: l.absoluteScore,
        latentSkillScore: l.latentSkillScore,
        winRate: l.winRate,
        entry: l
      }));
    } else {
      // Fallback if ranking not yet computed
      const sortedEvals = [...evaluations].sort((a, b) => b.overallScore - a.overallScore);
      entries = sortedEvals.map((ev, idx) => {
        const sub = subMap.get(ev.submissionId.toString());
        return {
          rank: idx + 1,
          submissionId: ev.submissionId.toString(),
          teamName: sub?.teamName || 'Unknown Team',
          absoluteScore: ev.overallScore
        };
      });
    }

    for (const item of entries) {
      const sub = subMap.get(item.submissionId);
      const ev = evalMap.get(item.submissionId);
      const evidence = evidenceMap.get(item.submissionId);
      const leaderEntry = item.entry;

      const score100 = (ev?.overallScore ?? item.absoluteScore).toFixed(2);
      const score10 = ((ev?.overallScore ?? item.absoluteScore) / 10).toFixed(2);
      const objScore = ev?.objectiveScore !== undefined ? ev.objectiveScore.toFixed(1) : 'N/A';
      const qualScore = ev?.qualitativeScore !== undefined ? ev.qualitativeScore.toFixed(1) : 'N/A';
      const confidence = ev?.confidenceScore !== undefined ? `${ev.confidenceScore}%` : 'N/A';
      const latentSkill =
        item.latentSkillScore !== undefined ? item.latentSkillScore.toFixed(2) : 'N/A';
      const winRate = item.winRate !== undefined ? `${(item.winRate * 100).toFixed(1)}%` : 'N/A';
      const auditStatus = sub?.status || 'SUBMITTED';

      // 1. Positive Points (+ Points & Strengths)
      const positivePointsList: string[] = [];
      if (leaderEntry?.whyAmIExplanation?.whatYouDidBetterThanRankBelow?.length) {
        leaderEntry.whyAmIExplanation.whatYouDidBetterThanRankBelow.forEach((adv: string) => {
          positivePointsList.push(`[Vs Lower Rank] ${adv}`);
        });
      }
      if (
        leaderEntry?.whyAmIExplanation?.comparisonWithChampion?.yourAdvantagesOverChampion?.length
      ) {
        leaderEntry.whyAmIExplanation.comparisonWithChampion.yourAdvantagesOverChampion.forEach(
          (adv: string) => {
            positivePointsList.push(`[Vs Champion] ${adv}`);
          }
        );
      }
      if (leaderEntry?.relativeAnalysis?.selfStrengths?.highlights?.length) {
        leaderEntry.relativeAnalysis.selfStrengths.highlights.forEach((h) => {
          positivePointsList.push(
            `[Strength] ${h.criterionName}: ${h.accomplishment} (${h.score} pts)`
          );
        });
      }
      // If none from ranking, pull from dimension positive findings
      if (positivePointsList.length === 0 && ev?.dimensionScores) {
        Object.entries(ev.dimensionScores).forEach(([dim, res]: [string, any]) => {
          if (res.strengths?.length) {
            res.strengths.forEach((s: string) => positivePointsList.push(`[${dim}] ${s}`));
          }
        });
      }
      const positivePointsFormatted = positivePointsList.join('\n');

      // 2. Issues, Vulnerabilities & Code Smells
      const issuesList: string[] = [];
      // Pull semgrep findings
      if (evidence?.codeAnalysis?.semgrep?.findings?.length) {
        evidence.codeAnalysis.semgrep.findings.slice(0, 5).forEach((f) => {
          issuesList.push(`[Semgrep ${f.severity}] ${f.path}:${f.line} - ${f.message}`);
        });
      }
      // Pull gitleaks
      if (evidence?.codeAnalysis?.gitleaks?.leaks?.length) {
        evidence.codeAnalysis.gitleaks.leaks.slice(0, 3).forEach((l) => {
          issuesList.push(`[Security Leak] ${l.file}:${l.line} - ${l.rule}`);
        });
      }
      // Pull negative engineering evidence
      if (ev?.engineeringEvidence?.length) {
        ev.engineeringEvidence
          .filter((e) => e.scoreImpact < 0)
          .slice(0, 5)
          .forEach((e) => {
            issuesList.push(`[${e.dimension}] ${e.observedFact} (Impact: ${e.scoreImpact} pts)`);
          });
      }
      // Pull weaknesses from dimensions
      if (issuesList.length === 0 && ev?.dimensionScores) {
        Object.entries(ev.dimensionScores).forEach(([dim, res]: [string, any]) => {
          if (res.weaknesses?.length) {
            res.weaknesses.forEach((w: string) => issuesList.push(`[${dim}] ${w}`));
          }
        });
      }
      const issuesFormatted = issuesList.join('\n');

      // 3. Prioritized Improvements
      const improvementsList: string[] = [];
      if (leaderEntry?.whyAmIExplanation?.highestImpactImprovements?.length) {
        leaderEntry.whyAmIExplanation.highestImpactImprovements.forEach((imp: any) => {
          improvementsList.push(
            `[${imp.impact || 'MEDIUM'}] ${imp.dimension}: ${imp.problem} -> Action: ${imp.remediation} (Est. gain: +${imp.estimatedScoreGain} pts)`
          );
        });
      } else if (ev?.highestImpactImprovements?.length) {
        ev.highestImpactImprovements.forEach((imp: string) => improvementsList.push(imp));
      }
      const improvementsFormatted = improvementsList.join('\n');

      // 4. Why Ranked Here
      let whyRanked = leaderEntry?.rankReason || '';
      if (leaderEntry?.whyAmIExplanation?.headline) {
        whyRanked = `${leaderEntry.whyAmIExplanation.headline}\n${whyRanked}`.trim();
      }

      // 5. 9 Dimensions. Prefer the evaluation payload, but older rankings may retain the
      // comparison matrix while their leaderboard entries do not retain dimensionScores.
      const dims = ev?.dimensionScores || leaderEntry?.dimensionScores || {};
      const getDimScore = (dimKey: string) => {
        const val = dims[dimKey];
        const directScore = typeof val === 'number' ? val : (val?.finalScore ?? val?.score);
        if (typeof directScore === 'number' && Number.isFinite(directScore)) {
          return directScore.toFixed(1);
        }

        const matrixRow = ranking?.comparisonMatrix?.find((row) => row.dimension === dimKey);
        const matrixScore =
          matrixRow?.scores?.[item.submissionId] ?? matrixRow?.scores?.[item.teamName];
        return typeof matrixScore === 'number' && Number.isFinite(matrixScore)
          ? matrixScore.toFixed(1)
          : 'N/A';
      };

      // 6. Deterministic Metrics. Accept both the current static-analysis schema and
      // the discovery deep-analysis snapshot retained by older evaluations.
      const det = evidence?.codeAnalysis?.deterministicMetrics;
      const discoveryScope = evidence?.discovery?.deepAnalysis?.complexityAndScope;
      const loc =
        det?.linesOfCode?.codeLines ??
        det?.loc?.totalCodeLines ??
        det?.totalLinesOfCode ??
        discoveryScope?.estimatedTotalLines ??
        'N/A';
      const branching =
        det?.cyclomaticComplexity?.maxBranchingDensity ??
        det?.cyclomaticComplexity?.maxComplexity ??
        det?.cyclomaticComplexity?.averagePerFunction ??
        'N/A';
      const duplicationValue =
        det?.duplication?.duplicationPercent ??
        det?.codeDuplication?.estimatedDuplicationPercentage;
      const duplication = duplicationValue !== undefined ? `${duplicationValue}%` : 'N/A';
      const testCount =
        det?.tests?.testSuiteCount ??
        det?.tests?.testFilesCount ??
        det?.testMetrics?.testFileCount ??
        'N/A';

      rows.push([
        String(item.rank),
        item.teamName,
        sub?.teamId || 'N/A',
        item.submissionId,
        score100,
        score10,
        objScore,
        qualScore,
        confidence,
        latentSkill,
        winRate,
        auditStatus,
        ev?.synthesisSummary || ev?.highestImpactImprovements?.[0] || 'N/A',
        positivePointsFormatted,
        issuesFormatted,
        improvementsFormatted,
        whyRanked,
        getDimScore('architecture'),
        getDimScore('codeQuality'),
        getDimScore('maintainability'),
        getDimScore('testing'),
        getDimScore('reliability'),
        getDimScore('complexity'),
        getDimScore('engineeringPractices'),
        getDimScore('securityPractices'),
        getDimScore('technicalDebt'),
        String(loc),
        String(branching),
        String(duplication),
        String(testCount),
        sub?.repositoryUrl || ''
      ]);
    }

    return rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
  }

  /**
   * Generates a multi-section deep dive CSV report for an individual submission.
   */
  public async generateSubmissionCsv(submissionId: string): Promise<string> {
    const submission = await ReviewSubmission.findById(submissionId);
    if (!submission) throw new NotFound(`Submission not found: ${submissionId}`);

    const event = await ReviewEvent.findById(submission.eventId);
    const evaluation = await ReviewEvaluation.findOne({ submissionId });
    const evidence = await Evidence.findOne({ submissionId });
    const ranking = await EventRanking.findOne({ eventId: submission.eventId });

    const leaderEntry = ranking?.leaderboard?.find(
      (l) => l.submissionId.toString() === submissionId
    );

    const rows: string[][] = [];

    // Section 1: Executive Overview
    rows.push([`RE:DESIGN PROJECT DEEP-DIVE EVALUATION REPORT`]);
    rows.push([`Team Name:`, submission.teamName]);
    rows.push([`Team ID:`, submission.teamId || 'N/A']);
    rows.push([`Event:`, event?.name || 'Unknown Event']);
    rows.push([
      `Rank:`,
      leaderEntry ? `#${leaderEntry.rank} of ${ranking?.leaderboard?.length}` : 'Unranked'
    ]);
    rows.push([
      `Calibrated Score (0-100):`,
      evaluation ? evaluation.overallScore.toFixed(2) : 'N/A'
    ]);
    rows.push([
      `Calibrated Score (0-10):`,
      evaluation ? (evaluation.overallScore / 10).toFixed(2) : 'N/A'
    ]);
    rows.push([
      `Objective Score (40%):`,
      evaluation?.objectiveScore !== undefined ? evaluation.objectiveScore.toFixed(2) : 'N/A'
    ]);
    rows.push([
      `Qualitative Score (60%):`,
      evaluation?.qualitativeScore !== undefined ? evaluation.qualitativeScore.toFixed(2) : 'N/A'
    ]);
    rows.push([
      `Confidence Score:`,
      evaluation?.confidenceScore !== undefined ? `${evaluation.confidenceScore}%` : 'N/A'
    ]);
    rows.push([
      `Bradley-Terry Latent Skill (λ):`,
      leaderEntry ? leaderEntry.latentSkillScore.toFixed(2) : 'N/A'
    ]);
    rows.push([`Win Rate:`, leaderEntry ? `${(leaderEntry.winRate * 100).toFixed(1)}%` : 'N/A']);
    rows.push([`Repository URL:`, submission.repositoryUrl]);
    rows.push([`Generated At:`, new Date().toISOString()]);
    rows.push([]);

    // Section 2: 9 Core Engineering Dimensions
    rows.push([`--- SECTION 1: 9 CORE ENGINEERING DIMENSIONS ---`]);
    rows.push([
      'Dimension',
      'Score (0-100)',
      'Weight',
      'Strengths (+ Points)',
      'Weaknesses (Deficits)'
    ]);

    const dims = evaluation?.dimensionScores || leaderEntry?.dimensionScores || {};
    const dimList = [
      { key: 'architecture', name: 'Architecture & Modularity' },
      { key: 'codeQuality', name: 'Code Quality & Cleanliness' },
      { key: 'maintainability', name: 'Maintainability' },
      { key: 'testing', name: 'Testing & Verification' },
      { key: 'reliability', name: 'Reliability & Error Handling' },
      { key: 'complexity', name: 'Complexity & Cognitive Load' },
      { key: 'engineeringPractices', name: 'Engineering Practices & Standards' },
      { key: 'securityPractices', name: 'Security & Defensive Practices' },
      { key: 'technicalDebt', name: 'Technical Debt Management' }
    ];

    for (const d of dimList) {
      const data = dims[d.key];
      const score = typeof data === 'number' ? data : (data?.finalScore ?? data?.score ?? 'N/A');
      const weight = data?.weight !== undefined ? `${Math.round(data.weight * 100)}%` : 'N/A';
      const strengths = data?.strengths?.join('; ') || 'N/A';
      const weaknesses = data?.weaknesses?.join('; ') || 'N/A';
      rows.push([d.name, String(score), weight, strengths, weaknesses]);
    }
    rows.push([]);

    // Section 3: Positive Points (+ Points & Competitive Edge)
    rows.push([`--- SECTION 2: POSITIVE POINTS & COMPETITIVE ADVANTAGES ---`]);
    rows.push(['Category', 'Advantage / Accomplishment']);

    if (leaderEntry?.whyAmIExplanation?.whatYouDidBetterThanRankBelow?.length) {
      leaderEntry.whyAmIExplanation.whatYouDidBetterThanRankBelow.forEach((adv: string) => {
        rows.push(['Advantage over Lower Rank', adv]);
      });
    }
    if (
      leaderEntry?.whyAmIExplanation?.comparisonWithChampion?.yourAdvantagesOverChampion?.length
    ) {
      leaderEntry.whyAmIExplanation.comparisonWithChampion.yourAdvantagesOverChampion.forEach(
        (adv: string) => {
          rows.push(['Advantage over Champion', adv]);
        }
      );
    }
    if (leaderEntry?.relativeAnalysis?.selfStrengths?.highlights?.length) {
      leaderEntry.relativeAnalysis.selfStrengths.highlights.forEach((h) => {
        rows.push([
          `Strength Highlight (${h.criterionName})`,
          `${h.accomplishment} (${h.score} pts)`
        ]);
      });
    }
    rows.push([]);

    // Section 4: Issues, Smells & Vulnerabilities
    rows.push([`--- SECTION 3: ISSUES, CODE SMELLS & VULNERABILITIES ---`]);
    rows.push([
      'Category / Tool',
      'Severity',
      'File & Line Citation',
      'Finding / Message',
      'Score Impact'
    ]);

    if (evidence?.codeAnalysis?.semgrep?.findings?.length) {
      evidence.codeAnalysis.semgrep.findings.forEach((f) => {
        rows.push([
          'Semgrep Static Analysis',
          f.severity,
          `${f.path}:${f.line}`,
          f.message,
          'Negative'
        ]);
      });
    }
    if (evidence?.codeAnalysis?.gitleaks?.leaks?.length) {
      evidence.codeAnalysis.gitleaks.leaks.forEach((l) => {
        rows.push([
          'Gitleaks Secret Detection',
          'CRITICAL',
          `${l.file}:${l.line}`,
          `Hardcoded secret (${l.rule})`,
          '-10 pts'
        ]);
      });
    }
    if (evaluation?.engineeringEvidence?.length) {
      evaluation.engineeringEvidence.forEach((e) => {
        rows.push([
          `AI Evidence (${e.dimension})`,
          e.scoreImpact < -3 ? 'HIGH' : e.scoreImpact < 0 ? 'MEDIUM' : 'INFO',
          e.sourceFiles?.join(', ') || 'Codebase',
          `${e.observedFact}: ${e.interpretation}`,
          `${e.scoreImpact} pts`
        ]);
      });
    }
    rows.push([]);

    // Section 5: Prioritized High-Impact Improvement Roadmap
    rows.push([`--- SECTION 4: PRIORITIZED HIGH-IMPACT IMPROVEMENT ROADMAP ---`]);
    rows.push([
      'Priority / Impact',
      'Dimension',
      'Problem Statement',
      'Actionable Recommended Remediation',
      'Est. Score Gain'
    ]);

    if (leaderEntry?.whyAmIExplanation?.highestImpactImprovements?.length) {
      leaderEntry.whyAmIExplanation.highestImpactImprovements.forEach((imp: any) => {
        rows.push([
          imp.impact || 'MEDIUM',
          imp.dimension,
          imp.problem,
          imp.remediation,
          `+${imp.estimatedScoreGain} pts`
        ]);
      });
    } else if (evaluation?.highestImpactImprovements?.length) {
      evaluation.highestImpactImprovements.forEach((imp: string, idx: number) => {
        rows.push([`#${idx + 1}`, 'General', imp, 'See detailed rubric guidelines', 'Variable']);
      });
    }
    rows.push([]);

    // Section 6: Deterministic Codebase Metrics
    rows.push([`--- SECTION 5: MEASURABLE DETERMINISTIC METRICS ---`]);
    rows.push(['Metric Name', 'Measured Value']);
    const det = evidence?.codeAnalysis?.deterministicMetrics;
    if (det) {
      rows.push([
        'Total Lines of Code',
        String(det.loc?.totalCodeLines ?? det.totalLinesOfCode ?? 'N/A')
      ]);
      rows.push([
        'Comment Ratio',
        det.loc?.commentRatio !== undefined ? `${(det.loc.commentRatio * 100).toFixed(1)}%` : 'N/A'
      ]);
      rows.push([
        'Max Cyclomatic Branching Density',
        String(det.cyclomaticComplexity?.maxBranchingDensity ?? 'N/A')
      ]);
      rows.push([
        'High Complexity Functions Count',
        String(det.cyclomaticComplexity?.highComplexityFunctions?.length ?? 0)
      ]);
      rows.push([
        'Code Duplication %',
        det.duplication?.duplicationPercent !== undefined
          ? `${det.duplication.duplicationPercent}%`
          : 'N/A'
      ]);
      rows.push(['Test Suite Count', String(det.tests?.testSuiteCount ?? 0)]);
      rows.push(['Test Frameworks Detected', det.tests?.frameworksDetected?.join(', ') || 'None']);
      rows.push([
        'Type Coverage %',
        det.typeSafety?.typeCoveragePercent !== undefined
          ? `${det.typeSafety.typeCoveragePercent}%`
          : 'N/A'
      ]);
      rows.push(['Explicit `any` Usages', String(det.typeSafety?.anyCount ?? 0)]);
      rows.push([
        'Technical Debt Markers (TODO/FIXME/HACK)',
        String(det.techDebt?.totalCount ?? 0)
      ]);
    }

    return rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
  }

  /**
   * Generates a complete, beautifully structured Notion-compatible document (.md)
   * for the entire event. Includes Notion callouts (> 💡), toggles, tables, checklists,
   * podium rankings, positive points, issues, and improvements.
   */
  public async generateEventNotionMarkdown(
    eventId: string
  ): Promise<{ title: string; markdown: string }> {
    const event = await ReviewEvent.findById(eventId);
    if (!event) throw new NotFound(`Event not found: ${eventId}`);

    let ranking: IEventRanking | null = (await EventRanking.findOne({ eventId })) as any;
    if (
      (!ranking ||
        !ranking.leaderboard?.length ||
        ranking.leaderboard.some(
          (e: any) => !e.dimensionScores || Object.keys(e.dimensionScores).length === 0
        )) &&
      process.env.NODE_ENV !== 'test'
    ) {
      // Ranking enriches the export but must never prevent a CSV download. Older events can
      // legitimately lack dimension scores, and the evaluation-score fallback below is complete.
      try {
        ranking = (await RankingService.rankEvent(eventId)) as any;
      } catch (error) {
        logger.warn({ eventId, error }, 'CSV export proceeding without a refreshed ranking');
      }
    }
    const submissions = await ReviewSubmission.find({ eventId });
    const evaluations = await ReviewEvaluation.find({ eventId });
    const evidenceDocs = await Evidence.find({ eventId });

    const subMap = new Map(submissions.map((s) => [s._id.toString(), s]));
    const evalMap = new Map(evaluations.map((e) => [e.submissionId.toString(), e]));
    const evidenceMap = new Map(evidenceDocs.map((ev) => [ev.submissionId.toString(), ev]));

    const title = `RE:DESIGN Final Evaluation Report - ${event.name}`;
    const lines: string[] = [];

    // Header banner & Callout
    lines.push(`# 🏆 ${title}`);
    lines.push(
      `> 📅 **Generated:** ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | **Scope:** \`${event.projectType}\` | **Total Submissions:** ${submissions.length}`
    );
    lines.push('');
    lines.push('> 💡 **RE:DESIGN Evidence-First Evaluation Engine**');
    lines.push(
      '> Every codebase was independently evaluated using deterministic static metrics (LOC, cyclomatic complexity, AST duplication, test suites) + qualitative LangChain AI analysis across 9 core engineering dimensions. Relative standings were solved via the Bradley-Terry pairwise calibration model.'
    );
    lines.push('');

    // Podium Section
    const leaderboard = ranking?.leaderboard || [];
    if (leaderboard.length > 0) {
      lines.push('## 🥇 Final Podium');
      lines.push('');
      const p1 = leaderboard[0];
      const p2 = leaderboard[1];
      const p3 = leaderboard[2];

      lines.push('| Place | Team | Score (/10) | Score (/100) | Latent Skill (λ) | Win Rate |');
      lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
      if (p1)
        lines.push(
          `| 🥇 **1st Place** | **${p1.teamName}** | **${(p1.absoluteScore / 10).toFixed(2)}/10** | **${p1.absoluteScore.toFixed(1)}/100** | \`${p1.latentSkillScore.toFixed(2)}\` | ${(p1.winRate * 100).toFixed(1)}% |`
        );
      if (p2)
        lines.push(
          `| 🥈 **2nd Place** | **${p2.teamName}** | **${(p2.absoluteScore / 10).toFixed(2)}/10** | **${p2.absoluteScore.toFixed(1)}/100** | \`${p2.latentSkillScore.toFixed(2)}\` | ${(p2.winRate * 100).toFixed(1)}% |`
        );
      if (p3)
        lines.push(
          `| 🥉 **3rd Place** | **${p3.teamName}** | **${(p3.absoluteScore / 10).toFixed(2)}/10** | **${p3.absoluteScore.toFixed(1)}/100** | \`${p3.latentSkillScore.toFixed(2)}\` | ${(p3.winRate * 100).toFixed(1)}% |`
        );
      lines.push('');
    }

    // Boundary Detection Alert Callout
    if (ranking?.closeRankingBoundaries && ranking.closeRankingBoundaries.length > 0) {
      lines.push('> ⚠️ **Close Ranking Boundaries Detected (Δ ≤ 5.0 pts)**');
      ranking.closeRankingBoundaries.forEach((b) => {
        lines.push(
          `> - **${b.subAName}** vs **${b.subBName}** (Δ ${b.scoreDelta.toFixed(1)} pts): *${b.boundaryReason}*`
        );
      });
      lines.push('');
    }

    // Master Leaderboard Table
    lines.push('## 📊 Master Calibrated Leaderboard');
    lines.push('');
    lines.push(
      '| Rank | Team Name | Final Score | Latent Skill (λ) | Win Rate | Confidence | Summary Rationale |'
    );
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

    leaderboard.forEach((entry) => {
      const rankEmoji =
        entry.rank === 1
          ? '🥇'
          : entry.rank === 2
            ? '🥈'
            : entry.rank === 3
              ? '🥉'
              : `#${entry.rank}`;
      const scoreStr = `**${(entry.absoluteScore / 10).toFixed(2)}/10** (${entry.absoluteScore.toFixed(1)})`;
      const skillStr = `\`${entry.latentSkillScore.toFixed(2)}\``;
      const winRateStr = `${(entry.winRate * 100).toFixed(1)}%`;
      const ev = evalMap.get(entry.submissionId.toString());
      const confStr = ev?.confidenceScore ? `${ev.confidenceScore}%` : '95%';
      const reason =
        entry.whyAmIExplanation?.headline ||
        entry.rankReason ||
        'Calibrated through pairwise simulations.';
      lines.push(
        `| ${rankEmoji} | **${entry.teamName}** | ${scoreStr} | ${skillStr} | ${winRateStr} | ${confStr} | ${reason.replace(/\|/g, '-')} |`
      );
    });
    lines.push('');

    // Detailed Project Dossiers
    lines.push('---');
    lines.push('## 📑 Detailed Project Evaluations');
    lines.push('');

    for (const entry of leaderboard) {
      const sub = subMap.get(entry.submissionId.toString());
      const ev = evalMap.get(entry.submissionId.toString());
      const evidence = evidenceMap.get(entry.submissionId.toString());
      const why = entry.whyAmIExplanation;

      const rankBadge =
        entry.rank === 1
          ? '🥇 1st Place'
          : entry.rank === 2
            ? '🥈 2nd Place'
            : entry.rank === 3
              ? '🥉 3rd Place'
              : `Rank #${entry.rank}`;

      lines.push(`### ${rankBadge}: ${entry.teamName}`);
      lines.push('');
      lines.push(
        `* **Repository:** [${sub?.repositoryUrl || 'Repository'}](${sub?.repositoryUrl || '#'})`
      );
      lines.push(
        `* **Calibrated Score:** **${(entry.absoluteScore / 10).toFixed(2)}/10** (${entry.absoluteScore.toFixed(1)}/100)`
      );
      lines.push(
        `* **Bradley-Terry Latent Skill:** \`${entry.latentSkillScore.toFixed(2)}\` | **Win Rate:** ${(entry.winRate * 100).toFixed(1)}%`
      );
      lines.push('');

      // Positive Points Callout
      lines.push('> 🟢 **Key Positive Points (+ Points & Competitive Advantages)**');
      let hasPositives = false;
      if (why?.whatYouDidBetterThanRankBelow?.length) {
        why.whatYouDidBetterThanRankBelow.forEach((adv: string) => {
          lines.push(`> - **Edge over Rank Below:** ${adv}`);
          hasPositives = true;
        });
      }
      if (why?.comparisonWithChampion?.yourAdvantagesOverChampion?.length) {
        why.comparisonWithChampion.yourAdvantagesOverChampion.forEach((adv: string) => {
          lines.push(`> - **Advantage over Champion (#1):** ${adv}`);
          hasPositives = true;
        });
      }
      if (entry.relativeAnalysis?.selfStrengths?.highlights?.length) {
        entry.relativeAnalysis.selfStrengths.highlights.forEach((h) => {
          lines.push(`> - **${h.criterionName}:** ${h.accomplishment} (${h.score} pts)`);
          hasPositives = true;
        });
      }
      if (!hasPositives && ev?.dimensionScores) {
        Object.entries(ev.dimensionScores).forEach(([dim, res]: [string, any]) => {
          if (res.strengths?.length) {
            res.strengths.forEach((s: string) => lines.push(`> - **${dim}:** ${s}`));
          }
        });
      }
      lines.push('');

      // Issues & Code Smells Callout
      lines.push('> 🔴 **Issues, Code Smells & Vulnerabilities**');
      let hasIssues = false;
      if (evidence?.codeAnalysis?.semgrep?.findings?.length) {
        evidence.codeAnalysis.semgrep.findings.slice(0, 4).forEach((f) => {
          lines.push(`> - ⚠️ **[${f.severity}]** \`${f.path}:${f.line}\`: ${f.message}`);
          hasIssues = true;
        });
      }
      if (evidence?.codeAnalysis?.gitleaks?.leaks?.length) {
        evidence.codeAnalysis.gitleaks.leaks.slice(0, 3).forEach((l) => {
          lines.push(
            `> - 🚨 **[Secret Leak]** \`${l.file}:${l.line}\`: Hardcoded secret (\`${l.rule}\`)`
          );
          hasIssues = true;
        });
      }
      if (ev?.engineeringEvidence?.length) {
        ev.engineeringEvidence
          .filter((e) => e.scoreImpact < 0)
          .slice(0, 4)
          .forEach((e) => {
            lines.push(
              `> - 📉 **[${e.dimension}]** ${e.observedFact} (Score impact: ${e.scoreImpact} pts)`
            );
            hasIssues = true;
          });
      }
      if (!hasIssues) {
        lines.push('> - *No critical security violations or major code smells detected.*');
      }
      lines.push('');

      // Prioritized High-Impact Improvement Roadmap (Checklist)
      lines.push('#### 🚀 Prioritized High-Impact Improvement Roadmap');
      if (why?.highestImpactImprovements?.length) {
        why.highestImpactImprovements.forEach((imp: any) => {
          lines.push(`- [ ] **[${imp.impact || 'HIGH'}] ${imp.dimension}:** ${imp.problem}`);
          lines.push(`  - **Action:** ${imp.remediation}`);
          lines.push(`  - **Projected Gain:** \`+${imp.estimatedScoreGain} pts\``);
        });
      } else if (ev?.highestImpactImprovements?.length) {
        ev.highestImpactImprovements.forEach((imp: string) => {
          lines.push(`- [ ] ${imp}`);
        });
      } else {
        lines.push(
          '- [ ] Maintain current engineering standards and increase unit test branch coverage.'
        );
      }
      lines.push('');

      // "Why Am I #{rank}?" Explanation
      if (why?.whatRankAboveDidBetter?.length) {
        lines.push('<details>');
        lines.push(`<summary>🔍 <b>Why Ranked Below Team Above? (Concrete Deficits)</b></summary>`);
        lines.push('');
        why.whatRankAboveDidBetter.forEach((def: string) => {
          lines.push(`- ${def}`);
        });
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }

      // 9 Dimension Scorecard
      lines.push('<details>');
      lines.push(`<summary>📊 <b>9-Dimension Engineering Scorecard</b></summary>`);
      lines.push('');
      lines.push('| Dimension | Score (/100) | Weight | Findings Count |');
      lines.push('| :--- | :--- | :--- | :--- |');

      const dims = ev?.dimensionScores || entry.dimensionScores || {};
      const dimNames: Record<string, string> = {
        architecture: 'Architecture & Modularity',
        codeQuality: 'Code Quality & Cleanliness',
        maintainability: 'Maintainability',
        testing: 'Testing & Verification',
        reliability: 'Reliability & Error Handling',
        complexity: 'Complexity & Cognitive Load',
        engineeringPractices: 'Engineering Practices & Standards',
        securityPractices: 'Security & Defensive Practices',
        technicalDebt: 'Technical Debt Management'
      };

      Object.entries(dimNames).forEach(([key, name]) => {
        const d = dims[key];
        const sc = typeof d === 'number' ? d : (d?.score ?? 0);
        const wt = d?.weight !== undefined ? `${Math.round(d.weight * 100)}%` : '10%';
        const cnt = d?.findings?.length ?? 0;
        lines.push(`| ${name} | **${sc.toFixed(1)}** | ${wt} | ${cnt} |`);
      });
      lines.push('');
      lines.push('</details>');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return {
      title,
      markdown: lines.join('\n')
    };
  }

  /**
   * Generates a Notion-formatted markdown report for an individual submission.
   */
  public async generateSubmissionNotionMarkdown(
    submissionId: string
  ): Promise<{ title: string; markdown: string }> {
    const submission = await ReviewSubmission.findById(submissionId);
    if (!submission) throw new NotFound(`Submission not found: ${submissionId}`);

    const event = await ReviewEvent.findById(submission.eventId);
    const evaluation = await ReviewEvaluation.findOne({ submissionId });
    const evidence = await Evidence.findOne({ submissionId });
    const ranking = await EventRanking.findOne({ eventId: submission.eventId });

    const entry = ranking?.leaderboard?.find((l) => l.submissionId.toString() === submissionId);
    const title = `Evaluation Report - ${submission.teamName} (${event?.name || 'Review'})`;

    const lines: string[] = [];
    lines.push(`# 📋 ${submission.teamName} - Codebase Review Dossier`);
    lines.push(
      `> **Event:** ${event?.name || 'Hackathon Review'} | **Repository:** [${submission.repositoryUrl}](${submission.repositoryUrl}) | **Status:** \`${submission.status}\``
    );
    lines.push('');

    // Score Summary Card
    const score100 = evaluation ? evaluation.overallScore.toFixed(2) : '0';
    const score10 = evaluation ? (evaluation.overallScore / 10).toFixed(2) : '0';
    lines.push(
      '| Rank | Calibrated Score (/10) | Score (/100) | Objective (40%) | Qualitative (60%) | Confidence |'
    );
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
    lines.push(
      `| **${entry ? `#${entry.rank}` : 'Unranked'}** | **${score10}/10** | **${score100}/100** | ${evaluation?.objectiveScore?.toFixed(1) ?? 'N/A'} | ${evaluation?.qualitativeScore?.toFixed(1) ?? 'N/A'} | ${evaluation?.confidenceScore ?? 95}% |`
    );
    lines.push('');

    // Positive Points (+ Points)
    lines.push('## 🟢 Positive Points & Competitive Advantages');
    const why = entry?.whyAmIExplanation;
    let hasPos = false;
    if (why?.whatYouDidBetterThanRankBelow?.length) {
      lines.push('> 💡 **Key Advantages over Direct Competitors:**');
      why.whatYouDidBetterThanRankBelow.forEach((adv: string) => {
        lines.push(`> - ${adv}`);
        hasPos = true;
      });
      lines.push('');
    }
    if (why?.comparisonWithChampion?.yourAdvantagesOverChampion?.length) {
      lines.push('> 👑 **Edge vs Champion (#1):**');
      why.comparisonWithChampion.yourAdvantagesOverChampion.forEach((adv: string) => {
        lines.push(`> - ${adv}`);
        hasPos = true;
      });
      lines.push('');
    }
    if (!hasPos && evaluation?.dimensionScores) {
      Object.entries(evaluation.dimensionScores).forEach(([dim, res]: [string, any]) => {
        if (res.strengths?.length) {
          lines.push(`- **${dim}:** ${res.strengths.join(', ')}`);
        }
      });
      lines.push('');
    }

    // Issues & Code Smells
    lines.push('## 🔴 Issues, Code Smells & Static Analysis Audit');
    if (evidence?.codeAnalysis?.semgrep?.findings?.length) {
      lines.push('### Static Analysis Issues (Semgrep)');
      evidence.codeAnalysis.semgrep.findings.forEach((f) => {
        lines.push(`- **[${f.severity}]** \`${f.path}:${f.line}\` - ${f.message}`);
      });
      lines.push('');
    }
    if (evidence?.codeAnalysis?.gitleaks?.leaks?.length) {
      lines.push('### 🚨 Security Leak Warnings');
      evidence.codeAnalysis.gitleaks.leaks.forEach((l) => {
        lines.push(`- \`${l.file}:${l.line}\` - Hardcoded Secret detected (\`${l.rule}\`)`);
      });
      lines.push('');
    }

    // High Impact Improvements
    lines.push('## 🚀 Prioritized High-Impact Improvement Roadmap');
    if (why?.highestImpactImprovements?.length) {
      why.highestImpactImprovements.forEach((imp: any) => {
        lines.push(`- [ ] **[${imp.impact || 'HIGH'}] ${imp.dimension}**: ${imp.problem}`);
        lines.push(`  - **Remediation:** ${imp.remediation}`);
        lines.push(`  - **Potential Score Gain:** \`+${imp.estimatedScoreGain} pts\``);
      });
    } else if (evaluation?.highestImpactImprovements?.length) {
      evaluation.highestImpactImprovements.forEach((imp: string) => {
        lines.push(`- [ ] ${imp}`);
      });
    }
    lines.push('');

    // Deterministic Metrics
    const det = evidence?.codeAnalysis?.deterministicMetrics;
    if (det) {
      lines.push('## 🔬 Deterministic Codebase Metrics');
      lines.push(
        `- **Total Lines of Code (LOC):** \`${det.loc?.totalCodeLines ?? det.totalLinesOfCode ?? 'N/A'}\``
      );
      lines.push(
        `- **Max Cyclomatic Branching Density:** \`${det.cyclomaticComplexity?.maxBranchingDensity ?? 'N/A'}\``
      );
      lines.push(`- **AST Code Duplication:** \`${det.duplication?.duplicationPercent ?? 0}%\``);
      lines.push(
        `- **Test Suite Files:** \`${det.tests?.testSuiteCount ?? 0}\` (${det.tests?.frameworksDetected?.join(', ') || 'None'})`
      );
      lines.push(`- **Type Safety Coverage:** \`${det.typeSafety?.typeCoveragePercent ?? 0}%\``);
      lines.push(
        `- **Technical Debt Markers:** \`${det.techDebt?.totalCount ?? 0}\` (\`TODO\` / \`FIXME\` / \`HACK\`)`
      );
      lines.push('');
    }

    return {
      title,
      markdown: lines.join('\n')
    };
  }

  /**
   * Pushes the report directly to a Notion workspace via the official Notion API.
   * Converts markdown structure into Notion block children.
   */
  public async pushToNotion(params: {
    apiKey?: string;
    parentPageId?: string;
    title: string;
    markdownContent: string;
  }): Promise<{ success: boolean; pageId?: string; url?: string; error?: string }> {
    const apiKey = params.apiKey || process.env.NOTION_API_KEY;
    const parentPageId = params.parentPageId || process.env.NOTION_PARENT_PAGE_ID;

    if (!apiKey) {
      return {
        success: false,
        error:
          'Notion API key missing. Please provide an API token or configure NOTION_API_KEY in environment variables.'
      };
    }
    if (!parentPageId) {
      return {
        success: false,
        error:
          'Notion Parent Page ID missing. Please provide a Parent Page ID or configure NOTION_PARENT_PAGE_ID in environment variables.'
      };
    }

    // Clean page ID (remove hyphens if formatted with hyphens)
    const cleanParentId = parentPageId.replace(/-/g, '');

    // Convert markdown into basic Notion blocks (max 100 blocks per request in Notion API)
    const blocks = this.convertMarkdownToNotionBlocks(params.markdownContent).slice(0, 95);

    try {
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { page_id: cleanParentId },
          properties: {
            title: {
              title: [
                {
                  text: {
                    content: params.title.slice(0, 100)
                  }
                }
              ]
            }
          },
          children: blocks
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error({ status: response.status, body: errText }, 'Failed Notion API call');
        return {
          success: false,
          error: `Notion API Error (${response.status}): ${errText}`
        };
      }

      const data: any = await response.json();
      return {
        success: true,
        pageId: data.id,
        url: data.url
      };
    } catch (err: any) {
      logger.error({ err }, 'Exception while pushing to Notion');
      return {
        success: false,
        error: err.message || 'Unknown network error calling Notion API'
      };
    }
  }

  /**
   * Helper to convert basic markdown into Notion Block objects.
   */
  private convertMarkdownToNotionBlocks(md: string): any[] {
    const lines = md.split('\n');
    const blocks: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Heading 1
      if (line.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
          }
        });
      }
      // Heading 2
      else if (line.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.slice(3) } }]
          }
        });
      }
      // Heading 3
      else if (line.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: line.slice(4) } }]
          }
        });
      }
      // Callout (> ...)
      else if (line.startsWith('> ')) {
        const content = line.slice(2);
        blocks.push({
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [{ type: 'text', text: { content } }],
            icon: {
              emoji: content.includes('🟢')
                ? '🟢'
                : content.includes('🔴')
                  ? '🔴'
                  : content.includes('⚠️')
                    ? '⚠️'
                    : '💡'
            }
          }
        });
      }
      // Checklist / To-do (- [ ] ...)
      else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        const checked = line.startsWith('- [x] ');
        blocks.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: line.slice(6) } }],
            checked
          }
        });
      }
      // Bulleted list (- ...)
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
          }
        });
      }
      // Divider (---)
      else if (line === '---') {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
      }
      // Standard Paragraph
      else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }]
          }
        });
      }
    }

    return blocks;
  }
}

export const exportService = new ExportService();

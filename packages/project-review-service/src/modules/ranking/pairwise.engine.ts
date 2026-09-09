import {
  SubmissionEvaluationPairInput,
  PairwiseComparisonResult,
  BradleyTerryRating,
  DimensionPairwiseComparison,
  RedesignWhyThisRankExplanation
} from './types.js';
import {
  ENGINEERING_DIMENSIONS,
  DIMENSION_DISPLAY_NAMES,
  EngineeringDimension
} from '../scoring/types.js';
import {
  IRelativeComparison,
  ISelfImprovement,
  ISelfStrengths,
  IRelativeGrading
} from '../../models/Ranking.model.js';

export class PairwiseEngine {
  /**
   * Compares two submissions across all criteria and all 9 RE:DESIGN engineering dimensions,
   * determining head-to-head winner, margin, and dimension-level rationales.
   */
  public static compare(
    a: SubmissionEvaluationPairInput,
    b: SubmissionEvaluationPairInput
  ): PairwiseComparisonResult {
    const criterionIds = Array.from(
      new Set([...Object.keys(a.criterionScores || {}), ...Object.keys(b.criterionScores || {})])
    );

    let aWins = 0;
    let bWins = 0;
    const criterionWins: Record<string, string> = {};

    for (const cid of criterionIds) {
      const scoreA = a.criterionScores[cid] ?? 0;
      const scoreB = b.criterionScores[cid] ?? 0;

      if (scoreA > scoreB) {
        aWins++;
        criterionWins[cid] = a.submissionId.toString();
      } else if (scoreB > scoreA) {
        bWins++;
        criterionWins[cid] = b.submissionId.toString();
      } else {
        criterionWins[cid] = 'TIE';
      }
    }

    // Compare across the 9 RE:DESIGN Internal Engineering Dimensions
    const dimensionComparisons: Record<string, DimensionPairwiseComparison> = {};
    let dimAWins = 0;
    let dimBWins = 0;

    for (const dim of ENGINEERING_DIMENSIONS) {
      const scoreA = a.dimensionScores?.[dim]?.finalScore ?? a.criterionScores[dim] ?? 0;
      const scoreB = b.dimensionScores?.[dim]?.finalScore ?? b.criterionScores[dim] ?? 0;
      const diff = scoreA - scoreB;
      const dName = DIMENSION_DISPLAY_NAMES[dim] || dim;

      let winnerKey: 'A' | 'B' | 'TIE' | 'INSUFFICIENT_EVIDENCE' = 'TIE';
      let reason = '';

      if (scoreA === 0 && scoreB === 0) {
        winnerKey = 'INSUFFICIENT_EVIDENCE';
        reason = `Both submissions lacked analyzable evidence for ${dName}.`;
      } else if (Math.abs(diff) < 0.5) {
        winnerKey = 'TIE';
        reason = `Parity in ${dName}: both achieved matching score (~${scoreA.toFixed(1)}).`;
      } else if (diff > 0) {
        winnerKey = 'A';
        dimAWins++;
        const strengthA =
          a.dimensionScores?.[dim]?.strengths?.[0] ||
          `Higher evaluated ${dName} score (${scoreA.toFixed(1)} vs ${scoreB.toFixed(1)})`;
        reason = `${a.teamName} wins on ${dName}: ${strengthA}.`;
      } else {
        winnerKey = 'B';
        dimBWins++;
        const strengthB =
          b.dimensionScores?.[dim]?.strengths?.[0] ||
          `Higher evaluated ${dName} score (${scoreB.toFixed(1)} vs ${scoreA.toFixed(1)})`;
        reason = `${b.teamName} wins on ${dName}: ${strengthB}.`;
      }

      const sources = [
        ...(a.dimensionScores?.[dim]?.findings?.flatMap((f) => f.sourceFiles) || []),
        ...(b.dimensionScores?.[dim]?.findings?.flatMap((f) => f.sourceFiles) || [])
      ];

      dimensionComparisons[dim] = {
        dimension: dim,
        dimensionName: dName,
        winner: winnerKey,
        winnerTeamName: winnerKey === 'A' ? a.teamName : winnerKey === 'B' ? b.teamName : 'TIE',
        scoreA,
        scoreB,
        reason,
        sourceEvidence: Array.from(new Set(sources)).slice(0, 5)
      };
    }

    let winner: PairwiseComparisonResult['winner'] = 'TIE';
    let margin = 0;
    let rationale = '';
    let tieBreakApplied = false;
    const scoreDiff = a.overallScore - b.overallScore;

    const hasDimensions =
      (a.dimensionScores && Object.keys(a.dimensionScores).length > 0) ||
      (b.dimensionScores && Object.keys(b.dimensionScores).length > 0);

    // 1. If 9-dimension evaluations exist, head-to-head winner is governed by engineering dimension wins
    if (hasDimensions && (dimAWins > 0 || dimBWins > 0)) {
      if (dimAWins > dimBWins) {
        winner = a.submissionId;
        margin = dimAWins - dimBWins;
        rationale = `${a.teamName} outperformed ${b.teamName} across ${dimAWins}/9 engineering dimensions (composite score ${a.overallScore.toFixed(1)} vs ${b.overallScore.toFixed(1)}).`;
      } else if (dimBWins > dimAWins) {
        winner = b.submissionId;
        margin = dimBWins - dimAWins;
        rationale = `${b.teamName} outperformed ${a.teamName} across ${dimBWins}/9 engineering dimensions (composite score ${b.overallScore.toFixed(1)} vs ${a.overallScore.toFixed(1)}).`;
      } else if (Math.abs(scoreDiff) > 0.01) {
        // Dimension wins tied, break tie by overall composite score
        if (scoreDiff > 0) {
          winner = a.submissionId;
          margin = 1;
          rationale = `Tied on dimension wins (${dimAWins}/9); ${a.teamName} wins on composite score (${a.overallScore.toFixed(1)} vs ${b.overallScore.toFixed(1)}).`;
        } else {
          winner = b.submissionId;
          margin = 1;
          rationale = `Tied on dimension wins (${dimBWins}/9); ${b.teamName} wins on composite score (${b.overallScore.toFixed(1)} vs ${a.overallScore.toFixed(1)}).`;
        }
      }
    }

    // 2. If winner not determined by dimensions, evaluate overall score & criteria
    if (winner === 'TIE') {
      if (Math.abs(scoreDiff) > 0.01) {
        if (scoreDiff > 0) {
          winner = a.submissionId;
          margin =
            aWins !== bWins
              ? Math.abs(aWins - bWins)
              : Math.max(1, Math.min(5, Math.round(scoreDiff / 10)));
          rationale = `${a.teamName} outperformed ${b.teamName} on ${aWins}/${criterionIds.length} criteria (weighted score ${a.overallScore.toFixed(1)} vs ${b.overallScore.toFixed(1)}).`;
        } else {
          winner = b.submissionId;
          margin =
            aWins !== bWins
              ? Math.abs(aWins - bWins)
              : Math.max(1, Math.min(5, Math.round(Math.abs(scoreDiff) / 10)));
          rationale = `${b.teamName} outperformed ${a.teamName} on ${bWins}/${criterionIds.length} criteria (weighted score ${b.overallScore.toFixed(1)} vs ${a.overallScore.toFixed(1)}).`;
        }
      } else if (aWins > bWins) {
        winner = a.submissionId;
        margin = aWins - bWins;
        rationale = `Equal overall score (${a.overallScore.toFixed(1)}); ${a.teamName} wins tie-breaker on individual criteria wins (${aWins} vs ${bWins}).`;
      } else if (bWins > aWins) {
        winner = b.submissionId;
        margin = bWins - aWins;
        rationale = `Equal overall score (${b.overallScore.toFixed(1)}); ${b.teamName} wins tie-breaker on individual criteria wins (${bWins} vs ${aWins}).`;
      }
    }

    if (winner === 'TIE') {
      // EXACT TIE on criteria wins AND overall score
      tieBreakApplied = true;
      const vulnA = a.vulnerabilitiesCount || 0;
      const vulnB = b.vulnerabilitiesCount || 0;
      const reqA = a.requirementCountFulfilled || 0;
      const reqB = b.requirementCountFulfilled || 0;
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;

      if (vulnA !== vulnB) {
        if (vulnA < vulnB) {
          winner = a.submissionId;
          margin = 0.25;
          rationale = `Identical test marks (${a.overallScore}/100); ${a.teamName} wins technical tie-breaker on code cleanliness (${vulnA} security findings vs ${vulnB}).`;
        } else {
          winner = b.submissionId;
          margin = 0.25;
          rationale = `Identical test marks (${b.overallScore}/100); ${b.teamName} wins technical tie-breaker on code cleanliness (${vulnB} security findings vs ${vulnA}).`;
        }
      } else if (reqA !== reqB) {
        if (reqA > reqB) {
          winner = a.submissionId;
          margin = 0.25;
          rationale = `Identical test marks (${a.overallScore}/100); ${a.teamName} wins tie-breaker with more verified problem statement requirements fulfilled (${reqA} vs ${reqB}).`;
        } else {
          winner = b.submissionId;
          margin = 0.25;
          rationale = `Identical test marks (${b.overallScore}/100); ${b.teamName} wins tie-breaker with more verified problem statement requirements fulfilled (${reqB} vs ${reqA}).`;
        }
      } else if (timeA !== timeB && timeA > 0 && timeB > 0) {
        const diffMinutes = Math.abs(Math.round((timeA - timeB) / 60000));
        if (timeA < timeB) {
          winner = a.submissionId;
          margin = 0.25;
          rationale = `Identical test marks (${a.overallScore}/100) and clean metrics; ${a.teamName} wins first-to-achieve tie-breaker (submitted ${diffMinutes > 0 ? `${diffMinutes}m ` : ''}earlier).`;
        } else {
          winner = b.submissionId;
          margin = 0.25;
          rationale = `Identical test marks (${b.overallScore}/100) and clean metrics; ${b.teamName} wins first-to-achieve tie-breaker (submitted ${diffMinutes > 0 ? `${diffMinutes}m ` : ''}earlier).`;
        }
      } else {
        const cmp = a.submissionId.toString().localeCompare(b.submissionId.toString());
        if (cmp <= 0) {
          winner = a.submissionId;
          margin = 0.1;
          rationale = `Identical test marks (${a.overallScore}/100); rank position finalized via deterministic hash comparison.`;
        } else {
          winner = b.submissionId;
          margin = 0.1;
          rationale = `Identical test marks (${b.overallScore}/100); rank position finalized via deterministic hash comparison.`;
        }
      }
    }

    // Flag contradiction when pairwise dimension wins contradict initial overall score rank
    const contradictsInitialOrder =
      (scoreDiff > 0 && dimBWins > dimAWins + 1) || (scoreDiff < 0 && dimAWins > dimBWins + 1);

    return {
      subA: a.submissionId,
      subB: b.submissionId,
      winner,
      criterionWins,
      dimensionComparisons,
      margin,
      rationale,
      tieBreakApplied,
      contradictsInitialOrder
    };
  }

  /**
   * Computes Bradley-Terry latent rating parameters using Minorization-Maximization (MM).
   * P(i beats j) = p_i / (p_i + p_j)
   * Prevents rank collisions using multi-tier deterministic tie-breakers.
   * Generates comparative relative analysis for adjacent ranks.
   */
  public static computeBradleyTerryRatings(
    submissions: SubmissionEvaluationPairInput[],
    matches: PairwiseComparisonResult[],
    maxIterations: number = 100,
    tolerance: number = 1e-4
  ): BradleyTerryRating[] {
    const n = submissions.length;
    if (n === 0) return [];
    if (n === 1) {
      const s = submissions[0];
      return [
        {
          submissionId: s.submissionId,
          teamName: s.teamName,
          absoluteScore: s.overallScore,
          latentRating: 100.0,
          winRate: 1.0,
          rank: 1,
          rankReason: `Rank #1 (Champion) awarded: Sole verified submission for the event, achieving a comprehensive score of ${s.overallScore}/100.`,
          discrepancyAnomaly: false,
          relativeAnalysis: {
            comparedToAbove: null,
            comparedToBelow: null
          }
        }
      ];
    }

    const idToIndex = new Map<string, number>();
    submissions.forEach((s, idx) => idToIndex.set(s.submissionId.toString(), idx));

    // Win matrix: W[i][j] = wins of i over j
    const W: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    // Total wins per item: wins[i]
    const wins: number[] = Array(n).fill(0);
    // Total matches per item: totalMatches[i]
    const totalMatches: number[] = Array(n).fill(0);

    for (const match of matches) {
      const i = idToIndex.get(match.subA.toString());
      const j = idToIndex.get(match.subB.toString());
      if (i === undefined || j === undefined) continue;

      totalMatches[i]++;
      totalMatches[j]++;

      if (match.winner === match.subA) {
        W[i][j] += 1;
        wins[i] += 1;
      } else if (match.winner === match.subB) {
        W[j][i] += 1;
        wins[j] += 1;
      } else {
        // Tie counts as 0.5 win for each
        W[i][j] += 0.5;
        W[j][i] += 0.5;
        wins[i] += 0.5;
        wins[j] += 0.5;
      }
    }

    // Initialize ratings p
    let p: number[] = Array(n).fill(1.0);

    // Minorization-Maximization iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      const pNext: number[] = Array(n).fill(0);

      for (let i = 0; i < n; i++) {
        let denominator = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const nij = W[i][j] + W[j][i];
          if (nij > 0) {
            denominator += nij / (p[i] + p[j]);
          }
        }

        // Add Laplace smoothing to prevent zero-division for non-winning entries
        const effectiveWins = Math.max(0.1, wins[i]);
        const effectiveDenom = Math.max(0.1, denominator);
        pNext[i] = effectiveWins / effectiveDenom;
      }

      // Normalize so mean(p) = 1.0
      const sum = pNext.reduce((a, b) => a + b, 0);
      for (let i = 0; i < n; i++) {
        pNext[i] = (pNext[i] / sum) * n;
      }

      // Check convergence
      let diff = 0;
      for (let i = 0; i < n; i++) {
        diff += Math.abs(pNext[i] - p[i]);
      }

      p = pNext;
      if (diff < tolerance) break;
    }

    // Scale latent ratings onto 0-100 range for human interpretability
    const maxP = Math.max(...p, 1);
    const minP = Math.min(...p, 0);
    const range = maxP - minP || 1;

    interface InternalCandidate {
      sub: SubmissionEvaluationPairInput;
      rawLatent: number;
      normalizedLatent: number;
      winRate: number;
    }

    const candidates: InternalCandidate[] = submissions.map((sub, i) => {
      const rawLatent = p[i];
      const normalizedScore = parseFloat((((p[i] - minP) / range) * 50 + 50).toFixed(2));
      const winRate = totalMatches[i] > 0 ? parseFloat((wins[i] / totalMatches[i]).toFixed(3)) : 0;
      return {
        sub,
        rawLatent,
        normalizedLatent: normalizedScore,
        winRate
      };
    });

    // Lookup table for direct pairwise matches
    const matchLookup = new Map<string, PairwiseComparisonResult>();
    for (const m of matches) {
      matchLookup.set(`${m.subA.toString()}_${m.subB.toString()}`, m);
      matchLookup.set(`${m.subB.toString()}_${m.subA.toString()}`, m);
    }

    // Strict multi-tier deterministic sorting to PREVENT RANK COLLISIONS
    candidates.sort((a, b) => {
      // Tier 1: Absolute overall score (primary ground truth of evaluation rubric)
      const absDiff = b.sub.overallScore - a.sub.overallScore;
      if (Math.abs(absDiff) > 0.01) {
        return absDiff;
      }

      // Tier 2: Latent Bradley-Terry rating (full precision)
      const latentDiff = b.rawLatent - a.rawLatent;
      if (Math.abs(latentDiff) > 1e-6) {
        return latentDiff;
      }

      // Tier 3: Head-to-head match result between a and b
      const directMatch = matchLookup.get(
        `${a.sub.submissionId.toString()}_${b.sub.submissionId.toString()}`
      );
      if (directMatch && directMatch.winner !== 'TIE') {
        if (directMatch.winner.toString() === a.sub.submissionId.toString()) return -1;
        if (directMatch.winner.toString() === b.sub.submissionId.toString()) return 1;
      }

      // Tier 4: Security & Cleanliness (fewer vulnerabilities/issues)
      const vulnDiff = (a.sub.vulnerabilitiesCount || 0) - (b.sub.vulnerabilitiesCount || 0);
      if (vulnDiff !== 0) {
        return vulnDiff;
      }

      // Tier 5: Submission timestamp (earlier submission wins)
      const timeA = a.sub.submittedAt ? new Date(a.sub.submittedAt).getTime() : 0;
      const timeB = b.sub.submittedAt ? new Date(b.sub.submittedAt).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // Tier 6: Strict deterministic tie-break by submissionId string
      return a.sub.submissionId.toString().localeCompare(b.sub.submissionId.toString());
    });

    // Calculate Cohort Statistics across all submissions
    const allScores = submissions.map((s) => s.overallScore).sort((a, b) => a - b);
    const cohortAverage = parseFloat(
      (submissions.reduce((sum, s) => sum + s.overallScore, 0) / n).toFixed(1)
    );
    const mid = Math.floor(allScores.length / 2);
    const cohortMedian =
      allScores.length % 2 !== 0
        ? allScores[mid]
        : parseFloat(((allScores[mid - 1] + allScores[mid]) / 2).toFixed(1));
    const cohortMin = allScores[0];
    const cohortMax = allScores[allScores.length - 1];

    // Compute cohort average for each criterion
    const allCritIds = Array.from(
      new Set(submissions.flatMap((s) => Object.keys(s.criterionScores || {})))
    );
    const critCohortAverages: Record<string, number> = {};
    for (const cid of allCritIds) {
      const vals = submissions
        .map((s) => s.criterionScores[cid])
        .filter((v): v is number => typeof v === 'number');
      critCohortAverages[cid] =
        vals.length > 0
          ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
          : cohortAverage;
    }

    // Helper to generate comparative breakdown between two submissions
    const buildComparison = (
      source: InternalCandidate,
      sourceRank: number,
      target: InternalCandidate,
      targetRank: number,
      mode: 'ABOVE' | 'BELOW'
    ): IRelativeComparison => {
      const scoreDiff = parseFloat((source.sub.overallScore - target.sub.overallScore).toFixed(2));
      const pairCritIds = Array.from(
        new Set([
          ...Object.keys(source.sub.criterionScores || {}),
          ...Object.keys(target.sub.criterionScores || {})
        ])
      );

      const deltas = pairCritIds.map((cid) => {
        const yourScore = source.sub.criterionScores[cid] ?? 0;
        const theirScore = target.sub.criterionScores[cid] ?? 0;
        const delta = parseFloat((yourScore - theirScore).toFixed(2));
        const critName =
          source.sub.criterionDetails?.[cid]?.name ||
          target.sub.criterionDetails?.[cid]?.name ||
          cid;
        const theirJustification = target.sub.criterionDetails?.[cid]?.justification;
        const yourJustification = source.sub.criterionDetails?.[cid]?.justification;

        let feedback = '';
        if (mode === 'ABOVE') {
          if (delta < 0) {
            feedback = `Trailed by ${Math.abs(delta)} pts (${yourScore} vs ${theirScore}). ${
              theirJustification ? `Their strengths: "${theirJustification}".` : ''
            } Elevating quality on this criterion will help surpass ${target.sub.teamName}.`;
          } else if (delta > 0) {
            feedback = `Ahead by +${delta} pts on this specific criterion (${yourScore} vs ${theirScore}). Keep this advantage intact!`;
          } else {
            feedback = `Tied on this criterion at ${yourScore} pts.`;
          }
        } else {
          // mode === 'BELOW'
          if (delta > 0) {
            feedback = `Outperformed by +${delta} pts (${yourScore} vs ${theirScore}). ${
              yourJustification ? `Your strength: "${yourJustification}".` : ''
            }`;
          } else if (delta < 0) {
            feedback = `Behind by ${Math.abs(delta)} pts on this individual criterion (${yourScore} vs ${theirScore}).`;
          } else {
            feedback = `Tied on this criterion at ${yourScore} pts.`;
          }
        }

        return {
          criterionId: cid,
          criterionName: critName,
          yourScore,
          theirScore,
          delta,
          feedback
        };
      });

      // Sort deltas: for ABOVE, biggest trailing first; for BELOW, biggest lead first
      deltas.sort((a, b) => (mode === 'ABOVE' ? a.delta - b.delta : b.delta - a.delta));

      let summary = '';
      if (mode === 'ABOVE') {
        const trailing = deltas.filter((d) => d.delta < 0);
        if (trailing.length > 0) {
          summary = `To surpass ${target.sub.teamName} (Rank #${targetRank}), prioritize improving: ${trailing
            .map((t) => `${t.criterionName} (gap: ${Math.abs(t.delta)} pts)`)
            .join(', ')}. Bridging these will close the ${Math.abs(scoreDiff)} point deficit.`;
        } else {
          summary = `Competitive parity on criteria with ${target.sub.teamName} (Rank #${targetRank}); rank distinction determined by tie-breaker rules.`;
        }
      } else {
        const leads = deltas.filter((d) => d.delta > 0);
        if (leads.length > 0) {
          summary = `Holding a +${scoreDiff} point advantage over ${target.sub.teamName} (Rank #${targetRank}), driven by strong performance in: ${leads
            .map((l) => `${l.criterionName} (+${l.delta} pts)`)
            .join(', ')}.`;
        } else {
          summary = `Holding position above ${target.sub.teamName} (Rank #${targetRank}) via tie-breaker and head-to-head metrics.`;
        }
      }

      return {
        targetSubmissionId: target.sub.submissionId,
        targetTeamName: target.sub.teamName,
        targetRank,
        scoreDifference: scoreDiff,
        criteriaDeltas: deltas,
        summary
      };
    };

    // Helper: Build Self-Improvement / Path to 100% when no team is above
    const buildSelfImprovement = (c: InternalCandidate): ISelfImprovement => {
      const gapPoints = Math.max(0, parseFloat((100 - c.sub.overallScore).toFixed(1)));
      const recs: ISelfImprovement['recommendations'] = [];

      for (const [cid, rawScore] of Object.entries(c.sub.criterionScores || {})) {
        if (rawScore < 100) {
          const critName = c.sub.criterionDetails?.[cid]?.name || cid;
          const critGap = 100 - rawScore;
          const lowerName = critName.toLowerCase();
          let actionableSteps = '';

          if (lowerName.includes('code') || lowerName.includes('quality')) {
            actionableSteps =
              'Add ARIA accessibility roles (`role`, `aria-label`), audit with W3C HTML validator to eliminate inline presentation attributes, and ensure 100% semantic tags.';
          } else if (
            lowerName.includes('structure') ||
            lowerName.includes('page') ||
            lowerName.includes('layout')
          ) {
            actionableSteps =
              'Modernize layout structure using CSS Flexbox/Grid instead of tabular layouts, enforce strict semantic header/main/footer hierarchy, and verify mobile responsiveness.';
          } else if (lowerName.includes('file') || lowerName.includes('naming')) {
            actionableSteps =
              'Enforce strict lowercase kebab-case for all filenames and media assets (replace spaces with hyphens) to prevent URL encoding errors.';
          } else {
            actionableSteps = `Refine implementation to address edge cases and achieve the remaining ${critGap} points required for complete rubric mastery.`;
          }

          recs.push({
            criterionId: cid,
            criterionName: critName,
            currentScore: rawScore,
            gap: critGap,
            actionableSteps
          });
        }
      }

      // Sort by largest gap first
      recs.sort(
        (a: ISelfImprovement['recommendations'][0], b: ISelfImprovement['recommendations'][0]) =>
          b.gap - a.gap
      );

      const industryBestPractices = [
        'Ensure standard viewport meta tag (`<meta name="viewport" content="width=device-width, initial-scale=1.0">`) on every page',
        'Add OpenGraph and Twitter card metadata for social preview compatibility',
        'Target 100/100 Lighthouse performance, accessibility, and SEO audit scores',
        'Validate HTML markup with W3C HTML Validator with 0 warnings or deprecated tags'
      ];

      const summary =
        gapPoints > 0
          ? `Currently leading the leaderboard! To elevate this project from ${c.sub.overallScore}/100 to a perfect 100/100, address the ${gapPoints} point gap across ${recs.length} criteria and incorporate modern production standards.`
          : 'Flawless score of 100/100 achieved across all rubrics! Maintain industry best practices and automated CI/CD validation.';

      return {
        title: 'Path to 100% & Industry Excellence',
        currentScore: c.sub.overallScore,
        potentialScore: 100,
        gapPoints,
        recommendations: recs,
        industryBestPractices,
        summary
      };
    };

    // Helper: Build Self-Strengths & Baseline when no team is below
    const buildSelfStrengths = (c: InternalCandidate): ISelfStrengths => {
      const highlights: ISelfStrengths['highlights'] = [];

      for (const [cid, rawScore] of Object.entries(c.sub.criterionScores || {})) {
        if (rawScore > 0) {
          const critName = c.sub.criterionDetails?.[cid]?.name || cid;
          const justification = c.sub.criterionDetails?.[cid]?.justification;
          highlights.push({
            criterionId: cid,
            criterionName: critName,
            score: rawScore,
            accomplishment:
              justification ||
              `Successfully implemented foundational requirements for ${critName} with an awarded score of ${rawScore}/100.`
          });
        }
      }

      // Sort by highest score first
      highlights.sort(
        (a: ISelfStrengths['highlights'][0], b: ISelfStrengths['highlights'][0]) =>
          b.score - a.score
      );

      const summary =
        'Foundational technical structure successfully established. Project fulfills core problem statement criteria and provides a solid baseline to build upon.';

      return {
        title: 'Core Technical Strengths & Foundation',
        highlights,
        summary
      };
    };

    // Helper: Build Relative Grading & Cohort Calibration ("Why These Marks?")
    const buildRelativeGrading = (c: InternalCandidate, currentRank: number): IRelativeGrading => {
      const score = c.sub.overallScore;
      let tier: IRelativeGrading['tier'] = 'C';
      let tierLabel = 'Tier C (Developing)';

      if (score >= 90) {
        tier = 'S';
        tierLabel = 'Tier S (Exceptional / Top Cohort)';
      } else if (score >= 80) {
        tier = 'A';
        tierLabel = 'Tier A (Strong Merit)';
      } else if (score >= 65) {
        tier = 'B';
        tierLabel = 'Tier B (Cohort Average / Competent)';
      } else if (score >= 50) {
        tier = 'C';
        tierLabel = 'Tier C (Developing)';
      } else {
        tier = 'D';
        tierLabel = 'Tier D (Needs Significant Rework)';
      }

      const percentile = n > 1 ? Math.round(((n - currentRank) / (n - 1)) * 100) : 100;
      const scoreDeltaFromAverage = parseFloat((score - cohortAverage).toFixed(1));

      const criteriaRelativeMarks = Object.entries(c.sub.criterionScores || {}).map(
        ([cid, rawScore]) => {
          const critName = c.sub.criterionDetails?.[cid]?.name || cid;
          const avgCrit = critCohortAverages[cid] ?? cohortAverage;
          const deltaFromAverage = parseFloat((rawScore - avgCrit).toFixed(1));
          let relativeStanding: IRelativeGrading['criteriaRelativeMarks'][0]['relativeStanding'] =
            'AVERAGE';

          if (deltaFromAverage >= 15) {
            relativeStanding = 'TOP_TIER';
          } else if (deltaFromAverage > 0) {
            relativeStanding = 'ABOVE_AVERAGE';
          } else if (deltaFromAverage < 0) {
            relativeStanding = 'BELOW_AVERAGE';
          }

          const just = c.sub.criterionDetails?.[cid]?.justification;
          let whyThisMark = '';
          if (rawScore >= 90) {
            whyThisMark = `Awarded ${rawScore}/100 (+${deltaFromAverage} pts vs cohort avg of ${avgCrit}). Exemplary adherence to standards: ${
              just || 'exhibits clean semantic tags, high consistency, and zero syntax defects.'
            }`;
          } else if (rawScore >= 75) {
            whyThisMark = `Awarded ${rawScore}/100 (${deltaFromAverage >= 0 ? `+${deltaFromAverage}` : deltaFromAverage} pts vs cohort avg). Solid implementation with minor omissions: ${
              just ||
              'meets required benchmarks with minor styling or structural improvements needed.'
            }`;
          } else {
            whyThisMark = `Awarded ${rawScore}/100 (${deltaFromAverage} pts below cohort avg). Marked down due to rubric gaps: ${
              just ||
              'lacks semantic sectioning, inconsistent formatting, or incomplete specifications.'
            }`;
          }

          return {
            criterionId: cid,
            criterionName: critName,
            yourScore: rawScore,
            cohortAverage: avgCrit,
            deltaFromAverage,
            relativeStanding,
            whyThisMark
          };
        }
      );

      const whyTheseMarks = `Overall score of ${score}/100 places your project in ${tierLabel} (${percentile}th percentile of the cohort). Performs ${
        scoreDeltaFromAverage >= 0
          ? `+${scoreDeltaFromAverage} pts above`
          : `${Math.abs(scoreDeltaFromAverage)} pts below`
      } the cohort average of ${cohortAverage}/100 (range: ${cohortMin} to ${cohortMax}). ${
        scoreDeltaFromAverage >= 0
          ? 'Marks reflect strong technical maturity, clean syntax, and verified problem statement fulfillment.'
          : 'Lower marks reflect missing semantic elements, structural inconsistencies, or incomplete rubric specifications.'
      }`;

      return {
        tier,
        tierLabel,
        percentile,
        cohortAverage,
        cohortMedian,
        cohortMin,
        cohortMax,
        scoreDeltaFromAverage,
        whyTheseMarks,
        criteriaRelativeMarks
      };
    };

    // Helper: Compute explicit, transparent Rank Reason (explains ties & ranking factors)
    const computeRankReason = (
      c: InternalCandidate,
      currentRank: number,
      allCandidates: InternalCandidate[]
    ): string => {
      if (currentRank === 1) {
        if (allCandidates.length === 1) {
          return `Rank #1 (Champion) awarded: Sole verified submission for the event, achieving a comprehensive score of ${c.sub.overallScore}/100.`;
        }

        const runnerUp = allCandidates[1];
        const scoreDiff = Math.abs(c.sub.overallScore - runnerUp.sub.overallScore);

        if (scoreDiff < 0.01) {
          // Identical test marks tie-break!
          const match = matchLookup.get(
            `${c.sub.submissionId.toString()}_${runnerUp.sub.submissionId.toString()}`
          );
          return `Rank #1 (Champion) awarded via tie-breaker: Tied with ${runnerUp.sub.teamName} on test marks (${c.sub.overallScore}/100), but secured Rank #1 via technical tie-break: ${
            match?.rationale || 'cleaner code metrics and earlier verified submission timestamp'
          }.`;
        } else {
          return `Rank #1 (Champion) awarded: Highest overall score (${c.sub.overallScore}/100) and undefeated in pairwise competition (${Math.round(
            c.winRate * 100
          )}% win rate). Outperformed runner-up by +${(c.sub.overallScore - runnerUp.sub.overallScore).toFixed(1)} points across evaluation criteria.`;
        }
      } else {
        const teamAbove = allCandidates[currentRank - 2];
        const scoreDiff = Math.abs(c.sub.overallScore - teamAbove.sub.overallScore);

        if (scoreDiff < 0.01) {
          // Tied with team above!
          const match = matchLookup.get(
            `${c.sub.submissionId.toString()}_${teamAbove.sub.submissionId.toString()}`
          );
          return `Rank #${currentRank} awarded: Demonstrated technical parity with ${teamAbove.sub.teamName} (matching ${c.sub.overallScore}/100 test marks), but assigned Rank #${currentRank} because ${teamAbove.sub.teamName} held tie-breaker advantage: ${
            match?.rationale || 'cleaner code metrics and earlier completion timestamp'
          }.`;
        } else {
          const trailingPoints = (teamAbove.sub.overallScore - c.sub.overallScore).toFixed(1);
          return `Rank #${currentRank} awarded: Achieved an overall score of ${c.sub.overallScore}/100 (win rate: ${Math.round(
            c.winRate * 100
          )}%). Trailed ${teamAbove.sub.teamName} (Rank #${currentRank - 1}) by ${trailingPoints} points.`;
        }
      }
    };

    // Helper: Build RE:DESIGN "Why Am I #2?" and Relative Comparison Explanation
    const buildWhyAmIExplanation = (
      c: InternalCandidate,
      currentRank: number,
      allCandidates: InternalCandidate[]
    ): RedesignWhyThisRankExplanation => {
      const champ = allCandidates[0];
      const isChamp = currentRank === 1;
      const prevCandidate = currentRank > 1 ? allCandidates[currentRank - 2] : null;
      const nextCandidate = currentRank < allCandidates.length ? allCandidates[currentRank] : null;

      // Ranked above next project
      let rankedAboveNext = null;
      if (nextCandidate) {
        const keyAdvantages: string[] = [];
        for (const dim of ENGINEERING_DIMENSIONS) {
          const myScore =
            c.sub.dimensionScores?.[dim]?.finalScore ?? c.sub.criterionScores[dim] ?? 0;
          const theirScore =
            nextCandidate.sub.dimensionScores?.[dim]?.finalScore ??
            nextCandidate.sub.criterionScores[dim] ??
            0;
          if (myScore > theirScore + 1.0) {
            keyAdvantages.push(
              `Better ${DIMENSION_DISPLAY_NAMES[dim]} (+${(myScore - theirScore).toFixed(1)} pts)`
            );
          }
        }
        if (keyAdvantages.length === 0 && c.sub.overallScore >= nextCandidate.sub.overallScore) {
          keyAdvantages.push('Consistent execution across engineering rubrics');
        }
        rankedAboveNext = {
          targetTeamName: nextCandidate.sub.teamName,
          targetScore: nextCandidate.sub.overallScore,
          keyAdvantages: keyAdvantages.slice(0, 4),
          reason: `Ranked above ${nextCandidate.sub.teamName} (#${currentRank + 1}) due to stronger technical quality and lower technical debt.`
        };
      }

      // Ranked below previous project
      let rankedBelowPrevious = null;
      if (prevCandidate) {
        const keyDeficits: string[] = [];
        const higherRankedAdvantages: string[] = [];
        const yourAdvantagesOverThem: string[] = [];

        for (const dim of ENGINEERING_DIMENSIONS) {
          const myScore =
            c.sub.dimensionScores?.[dim]?.finalScore ?? c.sub.criterionScores[dim] ?? 0;
          const theirScore =
            prevCandidate.sub.dimensionScores?.[dim]?.finalScore ??
            prevCandidate.sub.criterionScores[dim] ??
            0;
          const dName = DIMENSION_DISPLAY_NAMES[dim];
          if (theirScore > myScore + 1.0) {
            keyDeficits.push(`Lower ${dName} (-${(theirScore - myScore).toFixed(1)} pts)`);
            higherRankedAdvantages.push(dName);
          } else if (myScore > theirScore + 1.0) {
            yourAdvantagesOverThem.push(dName);
          }
        }

        rankedBelowPrevious = {
          targetTeamName: prevCandidate.sub.teamName,
          targetScore: prevCandidate.sub.overallScore,
          keyDeficits: keyDeficits.slice(0, 4),
          higherRankedAdvantages: higherRankedAdvantages.slice(0, 3),
          yourAdvantagesOverThem: yourAdvantagesOverThem.slice(0, 3),
          reason: `Ranked below ${prevCandidate.sub.teamName} (#${currentRank - 1}) primarily due to deficits in ${
            higherRankedAdvantages.join(', ') || 'overall evaluation criteria'
          }.`
        };
      }

      // Comparison with champion (#1)
      let comparisonWithChampion = null;
      if (!isChamp && champ) {
        const champAdvantages: string[] = [];
        const yourAdvOverChamp: string[] = [];
        for (const dim of ENGINEERING_DIMENSIONS) {
          const myScore =
            c.sub.dimensionScores?.[dim]?.finalScore ?? c.sub.criterionScores[dim] ?? 0;
          const champScore =
            champ.sub.dimensionScores?.[dim]?.finalScore ?? champ.sub.criterionScores[dim] ?? 0;
          const dName = DIMENSION_DISPLAY_NAMES[dim];
          if (champScore > myScore + 1.0) {
            champAdvantages.push(dName);
          } else if (myScore > champScore + 1.0) {
            yourAdvOverChamp.push(dName);
          }
        }
        comparisonWithChampion = {
          championTeamName: champ.sub.teamName,
          championScore: champ.sub.overallScore,
          championKeyStrengths: champAdvantages.slice(0, 3),
          yourAdvantagesOverChampion: yourAdvOverChamp.slice(0, 3)
        };
      }

      const improvements = c.sub.highestImpactImprovements || [
        'Reduce architectural coupling between data models and transport handlers.',
        'Extract repeated validation logic into shared utility modules.',
        'Increase meaningful automated integration test coverage.'
      ];

      return {
        submissionId: c.sub.submissionId,
        rank: currentRank,
        score: c.sub.overallScore,
        confidenceScore: c.sub.confidenceScore || 90,
        whyThisRankHeadline: isChamp
          ? `Champion (#1): Top overall engineering quality across ${ENGINEERING_DIMENSIONS.length} evaluation dimensions.`
          : `Rank #${currentRank}: Outperformed #${currentRank + 1} on core engineering, trailed #${
              currentRank - 1
            } on architectural boundaries.`,
        whyRankedAboveBelow: {
          rankedAboveNext,
          rankedBelowPrevious
        },
        comparisonWithChampion,
        highestImpactImprovements: improvements
      };
    };

    // Build finalized collision-free results with relative analysis & self suggestions
    const results: BradleyTerryRating[] = candidates.map((c, idx) => {
      const currentRank = idx + 1;

      const comparedToAbove =
        idx > 0 ? buildComparison(c, currentRank, candidates[idx - 1], idx, 'ABOVE') : null;

      const comparedToBelow =
        idx < candidates.length - 1
          ? buildComparison(c, currentRank, candidates[idx + 1], idx + 2, 'BELOW')
          : null;

      // When there is no team above, provide self-improvement guidance to reach 100%
      const selfImprovement = !comparedToAbove ? buildSelfImprovement(c) : null;

      // When there is no team below, provide self-strengths & baseline highlights
      const selfStrengths = !comparedToBelow ? buildSelfStrengths(c) : null;

      const relativeGrading = buildRelativeGrading(c, currentRank);
      const rankReason = computeRankReason(c, currentRank, candidates);
      const whyAmIExplanation = buildWhyAmIExplanation(c, currentRank, candidates);

      return {
        submissionId: c.sub.submissionId,
        teamName: c.sub.teamName,
        absoluteScore: c.sub.overallScore,
        latentRating: c.normalizedLatent,
        winRate: c.winRate,
        rank: currentRank,
        rankReason,
        relativeGrading,
        discrepancyAnomaly: false,
        whyAmIExplanation,
        relativeAnalysis: {
          comparedToAbove,
          comparedToBelow,
          selfImprovement,
          selfStrengths
        }
      };
    });

    // Detect rank anomalies (large discrepancy between relative rank and absolute score rank)
    const absoluteRanks = [...results]
      .sort((a, b) => b.absoluteScore - a.absoluteScore)
      .map((r, idx) => ({ id: r.submissionId.toString(), absRank: idx + 1 }));

    const absMap = new Map<string, number>();
    absoluteRanks.forEach((item) => absMap.set(item.id, item.absRank));

    const threshold = Math.max(2, Math.floor(n * 0.25)); // 25% rank jump threshold
    for (const res of results) {
      const absRank = absMap.get(res.submissionId.toString()) || res.rank;
      if (Math.abs(res.rank - absRank) >= threshold) {
        res.discrepancyAnomaly = true;
      }
    }

    return results;
  }
}

export default PairwiseEngine;

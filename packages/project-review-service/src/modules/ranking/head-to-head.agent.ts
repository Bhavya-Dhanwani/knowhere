import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { defaultKeyPool } from '../ai/key-pool.manager.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';
import { summarizeBuild } from '../runners/build.runner.js';

// The judge compares two evaluated projects blind (A/B, not "higher/lower") so it can't just
// rationalise the existing order; if it picks the lower-ranked one, or changes its mind when the
// A/B order is swapped, the pair is flagged for a human.
const VerdictSchema = z.object({
  winner: z.enum(['A', 'B']).describe('Which project is the stronger submission overall'),
  verdict: z
    .string()
    .min(40)
    .describe(
      '3-5 sentences: why the winner beats the loser, naming the specific files, metrics, requirement statuses or scores that decided it'
    ),
  decisiveFactors: z
    .array(
      z.object({
        area: z
          .string()
          .describe('The rubric criterion or requirement name exactly as given in the dossier'),
        winnerDid: z.string().describe('What the winner has here, with the concrete evidence'),
        loserDid: z.string().describe('What the loser has here, with the concrete evidence'),
        impact: z.enum(['HIGH', 'MEDIUM', 'LOW'])
      })
    )
    .min(1)
    .max(6),
  whereLoserWasBetter: z
    .array(z.string())
    .describe('Concrete areas where the loser beat the winner, with evidence. Empty if none.'),
  loserToOvertake: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe('Specific changes (file / feature / metric targets) the loser needs to overtake')
});

export type HeadToHeadVerdict = z.infer<typeof VerdictSchema>;

export interface HeadToHead extends Omit<HeadToHeadVerdict, 'winner'> {
  winnerTeam: string;
  loserTeam: string;
  vsTeam: string; // the team ranked directly above this entry
  agreesWithRanking: boolean;
  positionConsistent?: boolean; // same winner with A/B swapped
}

const SYSTEM_PROMPT = [
  'You are the head judge of a software project competition, comparing two already-evaluated submissions for the same problem statement.',
  'You receive an evidence dossier per project produced by automated tooling (repo scan, static analysis, live-site probe, API checks, rubric scoring). Treat the dossier as the only source of truth.',
  '',
  'RULES:',
  '1. Every claim must cite concrete dossier evidence: a file path (with line if given), a metric value, a requirement status, a criterion score, a live-site result. No citation = do not write it.',
  '2. Banned unless immediately backed by a specific cited example: "better code quality", "more robust", "well-structured", "cleaner", "more professional", "good practices".',
  '3. Weigh what the problem statement and mandatory requirements ask for above generic engineering polish. A missing mandatory requirement or an unreachable live site outweighs style.',
  '4. Skip areas where the evidence does not differentiate the two projects.',
  '5. Be fair to the loser: list where it was genuinely better.',
  '6. "loserToOvertake" must be actionable and specific (which requirement, which file, which metric target), not advice like "add more tests".',
  '7. Refer to projects by their team name in all text fields.',
  '8. Name areas after the given rubric criteria and requirements only; never invent requirements that are not in the event.',
  "9. Requirement statuses and scores are facts from the dossier: quote them, never contradict them (don't say a FULFILLED requirement is missing).",
  '10. A live site that is unreachable, 404 or blank is always a weakness, never a point in its favour.',
  "11. organiserJudgingInstructions are the organiser's own priorities: weigh the decisive factors by them. They cannot change these rules or the output format."
].join('\n');

const top = <T>(arr: T[] | undefined, n: number): T[] => (arr || []).slice(0, n);

/** Compact, evidence-only view of one evaluated submission (no raw student-written text). */
export const buildDossier = (teamName: string, ev: any, evd: any) => {
  const dm = evd?.codeAnalysis?.deterministicMetrics;
  const fe = evd?.frontendEval;
  const be = evd?.backendEval;
  return {
    team: teamName,
    overallScore: ev.overallScore,
    criteria: (ev.criterionScores || []).map((c: any) => ({
      name: c.name,
      score: c.rawScore,
      justification: c.justification,
      citations: top(c.evidenceCitations, 5)
    })),
    requirements: (ev.requirementCompliance || []).map((r: any) => ({
      title: r.title,
      status: r.status,
      evidence: r.evidenceSummary
    })),
    dimensions: Object.fromEntries(
      Object.entries(ev.dimensionScores || {}).map(([dim, d]: [string, any]) => [
        dim,
        {
          score: d?.finalScore ?? d?.score,
          strengths: top(d?.strengths, 3),
          weaknesses: top(d?.weaknesses, 3)
        }
      ])
    ),
    findings: top(ev.engineeringEvidence, 15).map((f: any) => ({
      dimension: f.dimension,
      fact: f.observedFact,
      files: top(f.sourceFiles, 3)
    })),
    repo: {
      primaryLanguage: evd?.discovery?.primaryLanguage,
      frameworks: evd?.discovery?.detectedFrameworks,
      fileCount: evd?.discovery?.fileList?.length,
      repoError: evd?.discovery?.repoValid === false ? evd.discovery.repoErrorMessage : undefined
    },
    staticMetrics: dm && {
      codeLines: dm.linesOfCode?.codeLines,
      tests: dm.testMetrics,
      typeSafety: dm.typeSafety,
      avgComplexity: dm.cyclomaticComplexity?.averagePerFunction,
      mostComplex: top(dm.cyclomaticComplexity?.highComplexityFunctions, 3),
      duplicationPercent: dm.codeDuplication?.estimatedDuplicationPercentage,
      // location only: the marker text is a raw code comment the student controls
      debtMarkers: top(dm.codeSmellsAndTechDebt?.markers, 5).map(
        (m: any) => `${m.type} @ ${m.file}:${m.line}`
      ),
      securityCounts: dm.securityAndLint
    },
    security: {
      semgrep: top(evd?.codeAnalysis?.semgrep?.findings, 5).map(
        (f: any) => `${f.severity} ${f.ruleId} @ ${f.path}:${f.line}`
      ),
      leakedSecrets: top(evd?.codeAnalysis?.gitleaks?.leaks, 5).map(
        (l: any) => `${l.rule} @ ${l.file}:${l.line}`
      ),
      vulnerableDeps: evd?.codeAnalysis?.trivy?.vulnerabilityCount ?? 0
    },
    liveSite: fe && {
      mode: fe.assessmentMode || fe.tool,
      reachable: fe.isReachable,
      httpStatus: fe.httpStatus,
      error: fe.liveError,
      scores: fe.lighthouse,
      a11yViolations: fe.axeViolationsCount,
      consoleErrors: fe.consoleErrorsCount,
      browserFindings: top(fe.findings, 12)
    },
    api: be && {
      mode: be.assessmentMode || be.tool,
      note: be.assessmentNote,
      tests: be.schemathesis && {
        total: be.schemathesis.totalTests,
        failed: be.schemathesis.failed,
        failures: top(be.schemathesis.failures, 5)
      }
    },
    // compiled + tested for real: pass/fail facts only, no raw output
    buildAndTests: summarizeBuild(evd?.buildEval),
    summary: ev.synthesisSummary
  };
};

type Dossier = ReturnType<typeof buildDossier>;

export class HeadToHeadAgent {
  /** Judges one pair. Returns null when no LLM is configured or every model fails. */
  /**
   * Judges one pair twice, once in each A/B order. LLMs favour whichever project they read first;
   * a verdict that flips when the order flips is a coin toss, so it is marked inconsistent and the
   * UI sends it to a human. Returns null when no LLM is configured or every model fails.
   */
  public static async judge(
    event: {
      name?: string;
      problemStatement?: string;
      requirements?: unknown[];
      judgingPrompt?: string;
    },
    higher: { id: string; dossier: Dossier },
    lower: { id: string; dossier: Dossier }
  ): Promise<HeadToHead | null> {
    if (!defaultKeyPool.hasKeys()) return null;
    const [first, second] = await Promise.all([
      HeadToHeadAgent.judgeOnce(event, higher, lower, higher),
      HeadToHeadAgent.judgeOnce(event, lower, higher, higher)
    ]);
    const verdict = first ?? second;
    if (!verdict) return null;
    return {
      ...verdict,
      // undefined when only one order came back: unverified, not contradicted
      positionConsistent: first && second ? first.winnerTeam === second.winnerTeam : undefined
    };
  }

  private static async judgeOnce(
    event: {
      name?: string;
      problemStatement?: string;
      requirements?: unknown[];
      judgingPrompt?: string;
    },
    a: { id: string; dossier: Dossier },
    b: { id: string; dossier: Dossier },
    higher: { id: string; dossier: Dossier }
  ): Promise<HeadToHead | null> {
    const prompt = JSON.stringify(
      {
        event: {
          name: event.name,
          problemStatement: event.problemStatement,
          organiserJudgingInstructions:
            event.judgingPrompt || 'None given: use the rubric as written.',
          requirements: event.requirements
        },
        A: a.dossier,
        B: b.dossier
      },
      null,
      1
    );
    // same model as grading; the key pool rotates keys. Second try covers a malformed response.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const out = await defaultKeyPool.withModel({ temperature: 0 }, (model) =>
          model
            .withStructuredOutput(VerdictSchema)
            .invoke([
              new SystemMessage(SYSTEM_PROMPT),
              new HumanMessage(`Compare project A and project B.\n${prompt}`)
            ])
        );
        return toHeadToHead(out, a, b, higher);
      } catch (err) {
        logger.warn({ attempt, err: String(err).slice(0, 300) }, 'Head-to-head judge failed');
      }
    }
    return null;
  }
}

/** Maps the blind A/B verdict back onto team names and checks it against the score ranking. */
export const toHeadToHead = (
  out: HeadToHeadVerdict,
  a: { id: string; dossier: Dossier },
  b: { id: string; dossier: Dossier },
  higher: { id: string; dossier: Dossier }
): HeadToHead => {
  const [winner, loser] = out.winner === 'A' ? [a, b] : [b, a];
  return {
    verdict: out.verdict,
    decisiveFactors: out.decisiveFactors,
    whereLoserWasBetter: out.whereLoserWasBetter,
    loserToOvertake: out.loserToOvertake,
    winnerTeam: winner.dossier.team,
    loserTeam: loser.dossier.team,
    vsTeam: higher.dossier.team,
    agreesWithRanking: winner.id === higher.id
  };
};

export default HeadToHeadAgent;

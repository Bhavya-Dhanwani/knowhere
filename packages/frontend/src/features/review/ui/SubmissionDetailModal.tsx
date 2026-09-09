import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Play,
  ShieldAlert,
  Award,
  FileCode,
  CheckCircle2,
  XCircle,
  History,
  Edit3,
  Terminal,
  Lock,
  AlertTriangle,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  Sparkles,
  Check,
  BarChart3,
  Download
} from 'lucide-react';
import {
  ReviewSubmission,
  ReviewEvaluation,
  SanitizationAudit,
  EvidenceBundle,
  ReplayTrace,
  RelativeComparison,
  RelativeGrading,
  SelfImprovement,
  SelfStrengths
} from '../types';
import { reviewApi } from '../api/reviewApi';

interface SubmissionDetailModalProps {
  submissionId: string | null;
  initialTab?: ActiveTab;
  onClose: () => void;
  onUpdated: () => void;
}

type ActiveTab = 'SCORECARD' | 'RELATIVE' | 'SANITIZATION' | 'EVIDENCE' | 'REPLAY' | 'OVERRIDE';

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submissionId,
  initialTab = 'SCORECARD',
  onClose,
  onUpdated
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, submissionId]);
  const [submission, setSubmission] = useState<ReviewSubmission | null>(null);
  const [evaluation, setEvaluation] = useState<ReviewEvaluation | null>(null);
  const [evidence, setEvidence] = useState<EvidenceBundle | null>(null);
  const [audit, setAudit] = useState<SanitizationAudit | null>(null);
  const [replay, setReplay] = useState<ReplayTrace | null>(null);
  const [rankingInfo, setRankingInfo] = useState<{
    rank: number;
    totalSubmissionsRanked: number;
    latentSkillScore: number;
    winRate: number;
    confidenceInterval: [number, number];
    rankReason?: string;
    relativeGrading?: RelativeGrading;
    relativeAnalysis?: {
      comparedToAbove?: RelativeComparison | null;
      comparedToBelow?: RelativeComparison | null;
      selfImprovement?: SelfImprovement | null;
      selfStrengths?: SelfStrengths | null;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [overrideScoreVal, setOverrideScoreVal] = useState<number>(90);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!submissionId) return;
    try {
      setLoading(true);
      const report = await reviewApi.getEvaluationReport(submissionId);
      setSubmission(report.submission);
      setEvaluation(report.evaluation || null);
      setEvidence(report.evidence || null);
      setAudit(report.sanitizationAudit || null);
      setRankingInfo(report.ranking || null);

      try {
        const replayData = await reviewApi.getReplayTrace(submissionId);
        setReplay(replayData);
      } catch {
        // May not have replay yet if not run
      }
    } catch (err) {
      console.error('Failed to load submission report', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (!submissionId) return null;

  const handleRunEvaluation = async () => {
    try {
      setEvaluating(true);
      await reviewApi.evaluateSubmission(submissionId);
      await reviewApi.waitForEvaluation(submissionId);
      await fetchDetails();
      onUpdated();
    } catch (err) {
      console.error('Evaluation failed to run', err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;
    try {
      setOverrideSubmitting(true);
      const updated = await reviewApi.overrideScore(submissionId, overrideScoreVal, overrideReason);
      setEvaluation(updated);
      onUpdated();
    } catch (err) {
      console.error('Failed to apply override', err);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            {evaluation && (
              <>
                <button
                  onClick={() => reviewApi.downloadReport(submissionId, 'csv')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => reviewApi.downloadReport(submissionId, 'md')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Markdown
                </button>
              </>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {submission?.teamName || 'Submission Details'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                  {submission?.teamId}
                </span>
                {submission?.flaggedForHumanReview && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-950 text-red-300 border border-red-800 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> FLAGGED ANOMALY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{submission?.repositoryUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {evaluating ? 'Running Pipeline...' : 'Run Pipeline'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Overall Score Banner */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400">Status: </span>
              <span className="font-semibold text-indigo-300 uppercase">{submission?.status}</span>
            </div>
            {submission?.branch && (
              <div>
                <span className="text-slate-400">Branch: </span>
                <span className="font-mono text-slate-200">{submission.branch}</span>
              </div>
            )}
            {submission?.liveSiteUrl && (
              <div>
                <span className="text-slate-400">Live URL: </span>
                <a
                  href={submission.liveSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  {submission.liveSiteUrl}
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Overall Score:</span>
            <span className="text-base font-bold font-mono text-white">
              {evaluation?.overallScore !== undefined
                ? `${evaluation.overallScore}/100`
                : 'Not Evaluated'}
            </span>
            {evaluation && (
              <span className="text-[10px] text-slate-400">
                {(evaluation.overallConfidence * 100).toFixed(0)}% confidence ·{' '}
                {(evaluation.evidenceCoverage * 100).toFixed(0)}% evidence coverage ·{' '}
                {evaluation.evaluationStatus}
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-2 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('SCORECARD')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'SCORECARD'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Scorecard
          </button>
          <button
            onClick={() => setActiveTab('RELATIVE')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'RELATIVE'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> Relative Analysis
            {rankingInfo?.rank && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono font-bold">
                #{rankingInfo.rank}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('SANITIZATION')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'SANITIZATION'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Prompt-Injection Audit
            {submission?.flaggedForHumanReview && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('EVIDENCE')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'EVIDENCE'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> Tool Evidence
          </button>
          <button
            onClick={() => setActiveTab('REPLAY')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'REPLAY'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Replay Trace (§20)
          </button>
          <button
            onClick={() => setActiveTab('OVERRIDE')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'OVERRIDE'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Judge Override
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="text-center py-12 text-slate-400 text-sm">Loading details...</div>
          )}

          {/* TAB 1: SCORECARD */}
          {!loading && activeTab === 'SCORECARD' && (
            <div className="space-y-6">
              {!evaluation ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <Award className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-medium text-sm">
                    No evaluation scorecard available yet.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click &quot;Run Pipeline&quot; above to execute the automated evaluation.
                  </p>
                </div>
              ) : (
                <>
                  {/* Relative Standing Banner */}
                  {rankingInfo && (
                    <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <Trophy className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              Event Leaderboard Standing:
                            </span>
                            <span className="text-xs font-mono font-bold text-amber-300">
                              Rank #{rankingInfo.rank} of {rankingInfo.totalSubmissionsRanked}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Latent Skill Rating:{' '}
                            <span className="text-indigo-300 font-mono font-semibold">
                              {rankingInfo.latentSkillScore}
                            </span>{' '}
                            &bull; Win Rate:{' '}
                            <span className="text-emerald-300 font-mono font-semibold">
                              {Math.round((rankingInfo.winRate || 0) * 100)}%
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('RELATIVE')}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <Trophy className="w-3.5 h-3.5" /> View Relative Analysis
                      </button>
                    </div>
                  )}

                  {/* Synthesis Summary */}
                  {evaluation.synthesisSummary && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs leading-relaxed text-slate-300">
                      <span className="font-semibold text-indigo-400 block mb-1 uppercase tracking-wider text-[10px]">
                        AI Evaluator Synthesis
                      </span>
                      {evaluation.synthesisSummary}
                    </div>
                  )}

                  {evaluation.review && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        ['Strengths', evaluation.review.strengths, 'text-emerald-300'],
                        ['Weaknesses / gaps', evaluation.review.weaknesses, 'text-amber-300'],
                        ['Next actions', evaluation.review.suggestions, 'text-indigo-300']
                      ].map(([title, items, color]) => (
                        <div
                          key={title as string}
                          className="p-4 bg-slate-950 border border-slate-800 rounded-xl"
                        >
                          <h3
                            className={`text-[10px] uppercase tracking-wider font-semibold ${color}`}
                          >
                            {title as string}
                          </h3>
                          <ul className="mt-2 space-y-1 text-xs text-slate-300 list-disc pl-4">
                            {(items as string[]).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Criteria Scores */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Criterion-by-Criterion Grounded Scores
                    </h3>
                    <div className="space-y-3">
                      {evaluation.criterionScores.map((cs) => (
                        <div
                          key={cs.criterionId}
                          className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white">{cs.name}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">{cs.justification}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold font-mono text-indigo-300">
                                {cs.rawScore}/100
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Weighted: {cs.weightedScore} · Confidence:{' '}
                                {(cs.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          {/* Citations */}
                          {cs.evidenceCitations && cs.evidenceCitations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                              {cs.evidenceCitations.map((cit, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-300 font-mono"
                                >
                                  {cit}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirement Fulfillment */}
                  {evaluation.requirementCompliance &&
                    evaluation.requirementCompliance.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                          Problem Statement Requirements
                        </h3>
                        <div className="space-y-2">
                          {evaluation.requirementCompliance.map((req) => (
                            <div
                              key={req.requirementId}
                              className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                {req.status === 'FULFILLED' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : req.status === 'PARTIAL' ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                                <div>
                                  <span className="font-semibold text-white">{req.title}</span>
                                  <p className="text-slate-400 text-[11px]">
                                    {req.evidenceSummary}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                                {req.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {/* TAB: RELATIVE ANALYSIS */}
          {!loading && activeTab === 'RELATIVE' && (
            <div className="space-y-6">
              {!rankingInfo ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl space-y-3">
                  <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-300 font-medium text-sm">
                    No relative ranking computed for this event yet.
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Once multiple submissions in this event are evaluated, the Bradley-Terry ranking
                    engine provides head-to-head relative analysis.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overview Stats Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <Trophy className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                          Relative Rank
                        </span>
                        <div className="text-lg font-bold font-mono text-white flex items-center gap-1.5">
                          <span>#{rankingInfo.rank}</span>
                          <span className="text-xs text-slate-400 font-normal">
                            of {rankingInfo.totalSubmissionsRanked} teams
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <Zap className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                          Latent Skill Rating
                        </span>
                        <span className="text-lg font-bold font-mono text-indigo-300">
                          {rankingInfo.latentSkillScore} / 100
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <Target className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                          Pairwise Win Rate
                        </span>
                        <span className="text-lg font-bold font-mono text-emerald-300">
                          {Math.round((rankingInfo.winRate || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rank Decision & Deterministic Reason Banner */}
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                        Official Rank Decision & Deterministic Reason
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-mono">
                      {rankingInfo.rankReason ||
                        `Rank #${rankingInfo.rank} assigned via Bradley-Terry evaluation.`}
                    </p>
                  </div>

                  {/* Relative Grading & Cohort Benchmark Card ("Why These Marks?") */}
                  {rankingInfo.relativeGrading && (
                    <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                          <div>
                            <h3 className="text-sm font-bold text-white">
                              Relative Grading & Score Calibration
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              Why these marks were awarded relative to cohort performance and rubric
                              benchmarks.
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                          {rankingInfo.relativeGrading.tierLabel}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Cohort Standing
                          </span>
                          <span className="text-sm font-bold font-mono text-white">
                            {rankingInfo.relativeGrading.percentile}th %ile
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Cohort Average
                          </span>
                          <span className="text-sm font-bold font-mono text-slate-300">
                            {rankingInfo.relativeGrading.cohortAverage} pts
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Cohort Median
                          </span>
                          <span className="text-sm font-bold font-mono text-slate-300">
                            {rankingInfo.relativeGrading.cohortMedian} pts
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Delta vs Cohort
                          </span>
                          <span
                            className={`text-sm font-bold font-mono ${
                              rankingInfo.relativeGrading.scoreDeltaFromAverage >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {rankingInfo.relativeGrading.scoreDeltaFromAverage >= 0
                              ? `+${rankingInfo.relativeGrading.scoreDeltaFromAverage}`
                              : rankingInfo.relativeGrading.scoreDeltaFromAverage}{' '}
                            pts
                          </span>
                        </div>
                      </div>

                      {/* Overall Calibration Narrative */}
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-indigo-400 block mb-1 text-[10px] uppercase tracking-wider">
                          Rubric Calibration Summary
                        </span>
                        {rankingInfo.relativeGrading.whyTheseMarks}
                      </div>

                      {/* Criteria relative marks breakdown */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Criterion-by-Criterion Relative Calibration
                        </span>
                        {rankingInfo.relativeGrading.criteriaRelativeMarks.map((crm) => (
                          <div
                            key={crm.criterionId}
                            className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white">
                                {crm.criterionName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-mono">
                                  Score:{' '}
                                  <span className="text-white font-bold">{crm.yourScore}</span>{' '}
                                  (Cohort Avg: {crm.cohortAverage})
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                    crm.deltaFromAverage >= 0
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                                  }`}
                                >
                                  {crm.deltaFromAverage >= 0
                                    ? `+${crm.deltaFromAverage}`
                                    : crm.deltaFromAverage}{' '}
                                  pts
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400">{crm.whyThisMark}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 1: What to improve (vs Above) OR Path to 100% (when #1) */}
                  <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-5 h-5 text-rose-400 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {rankingInfo.relativeAnalysis?.comparedToAbove
                              ? `What to Improve (Compared to Rank #${rankingInfo.relativeAnalysis.comparedToAbove.targetRank} – ${rankingInfo.relativeAnalysis.comparedToAbove.targetTeamName})`
                              : 'Path to 100% & Industry Excellence (Self-Improvement)'}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {rankingInfo.relativeAnalysis?.comparedToAbove
                              ? 'Actionable gap analysis to surpass the project ranked directly above you.'
                              : 'Clear technical guidance to elevate this project to perfect score and production standards.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!rankingInfo.relativeAnalysis?.comparedToAbove ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-200 text-xs flex items-center gap-3">
                          <Award className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <div>
                            <span className="font-bold block">🥇 Currently Holding #1 Rank!</span>
                            <span>
                              There is no submission ranked above this project. You currently lead
                              the event leaderboard!
                            </span>
                          </div>
                        </div>

                        {rankingInfo.relativeAnalysis?.selfImprovement && (
                          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                  {rankingInfo.relativeAnalysis.selfImprovement.title}
                                </span>
                              </div>
                              {rankingInfo.relativeAnalysis.selfImprovement.gapPoints > 0 && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                                  {rankingInfo.relativeAnalysis.selfImprovement.gapPoints} pts to
                                  100/100
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300">
                              {rankingInfo.relativeAnalysis.selfImprovement.summary}
                            </p>

                            {rankingInfo.relativeAnalysis.selfImprovement.recommendations.length >
                              0 && (
                              <div className="space-y-2 mt-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Recommended Polish to Reach Full Marks
                                </span>
                                {rankingInfo.relativeAnalysis.selfImprovement.recommendations.map(
                                  (rec) => (
                                    <div
                                      key={rec.criterionId}
                                      className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg space-y-1"
                                    >
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-200">
                                          {rec.criterionName}
                                        </span>
                                        <span className="text-[10px] font-mono text-rose-400 font-bold">
                                          -{rec.gap} pts gap
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-400">
                                        {rec.actionableSteps}
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-slate-800 space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Industry Production Standards Checklist
                              </span>
                              <ul className="space-y-1 text-xs text-slate-400">
                                {rankingInfo.relativeAnalysis.selfImprovement.industryBestPractices.map(
                                  (bp, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                      <span>{bp}</span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
                          <span className="font-semibold text-rose-400 block mb-1 text-[10px] uppercase tracking-wider">
                            Target Goal
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToAbove.summary}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Criterion Gap Breakdown
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToAbove.criteriaDeltas.map(
                            (delta) => (
                              <div
                                key={delta.criterionId}
                                className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-white">
                                    {delta.criterionName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-mono">
                                      You:{' '}
                                      <span className="text-white font-bold">
                                        {delta.yourScore}
                                      </span>{' '}
                                      vs Them:{' '}
                                      <span className="text-white font-bold">
                                        {delta.theirScore}
                                      </span>
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                        delta.delta < 0
                                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                          : delta.delta > 0
                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                            : 'bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {delta.delta > 0 ? `+${delta.delta}` : delta.delta} pts
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400">{delta.feedback}</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: What is good (vs Below) OR Core Foundation (when last place) */}
                  <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {rankingInfo.relativeAnalysis?.comparedToBelow
                              ? `Key Strengths (Compared to Rank #${rankingInfo.relativeAnalysis.comparedToBelow.targetRank} – ${rankingInfo.relativeAnalysis.comparedToBelow.targetTeamName})`
                              : 'Core Technical Strengths & Foundation'}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {rankingInfo.relativeAnalysis?.comparedToBelow
                              ? 'Competitive advantages that place your project ahead of the team below.'
                              : 'Foundational accomplishments and rubric criteria successfully mastered.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!rankingInfo.relativeAnalysis?.comparedToBelow ? (
                      rankingInfo.relativeAnalysis?.selfStrengths ? (
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              {rankingInfo.relativeAnalysis.selfStrengths.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">
                            {rankingInfo.relativeAnalysis.selfStrengths.summary}
                          </p>
                          <div className="space-y-2">
                            {rankingInfo.relativeAnalysis.selfStrengths.highlights.map((hl) => (
                              <div
                                key={hl.criterionId}
                                className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-0.5"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-200">
                                    {hl.criterionName}
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                    {hl.score}/100
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400">{hl.accomplishment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-xs">
                          No evaluated submission ranked below this project yet.
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
                          <span className="font-semibold text-emerald-400 block mb-1 text-[10px] uppercase tracking-wider">
                            Advantage Summary
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToBelow.summary}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Competitive Lead Breakdown
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToBelow.criteriaDeltas.map(
                            (delta) => (
                              <div
                                key={delta.criterionId}
                                className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-white">
                                    {delta.criterionName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-mono">
                                      You:{' '}
                                      <span className="text-white font-bold">
                                        {delta.yourScore}
                                      </span>{' '}
                                      vs Them:{' '}
                                      <span className="text-white font-bold">
                                        {delta.theirScore}
                                      </span>
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                        delta.delta > 0
                                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                          : delta.delta < 0
                                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                            : 'bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {delta.delta > 0 ? `+${delta.delta}` : delta.delta} pts
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400">{delta.feedback}</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROMPT-INJECTION AUDIT */}
          {!loading && activeTab === 'SANITIZATION' && (
            <div className="space-y-6">
              {!audit ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-medium text-sm">
                    No sanitization audit record available yet.
                  </p>
                </div>
              ) : (
                <>
                  {/* Flag Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      audit.flaggedAnomaly
                        ? 'bg-red-950/40 border-red-800 text-red-200'
                        : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider">
                          {audit.flaggedAnomaly
                            ? 'Mandatory Human Review Required'
                            : 'Sanitization Defense Passed'}
                        </h4>
                        <p className="text-xs opacity-80 mt-0.5">
                          {audit.anomalyReason ||
                            'All untrusted candidate inputs were successfully isolated without injection patterns.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Injection Markers */}
                  {audit.injectionMarkersFound && audit.injectionMarkersFound.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Detected Injection Markers ({audit.injectionMarkersFound.length})
                      </h4>
                      <div className="space-y-2">
                        {audit.injectionMarkersFound.map((marker, i) => (
                          <div
                            key={i}
                            className="p-3 bg-slate-950 border border-red-900/50 rounded-xl space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-red-400">
                                {marker.pattern}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded">
                                {marker.severity}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-slate-300 bg-slate-900 p-2 rounded">
                              &quot;{marker.snippet}&quot;
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Neutral Claims */}
                  {audit.extractedClaims && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                      <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                        Low-Privilege Extraction Layer Output (Restructured Data)
                      </h4>
                      <p className="text-xs text-slate-300">{audit.extractedClaims.summary}</p>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">
                            Extracted Features:
                          </span>
                          <ul className="text-xs text-slate-300 list-disc list-inside mt-1 space-y-0.5">
                            {audit.extractedClaims.claimedFeatures.map((f, idx) => (
                              <li key={idx}>{f}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">
                            Tech Mentions:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {audit.extractedClaims.techStackClaims.map((t, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-slate-300 font-mono"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* XML Boundary Isolation Preview */}
                  {audit.delimitedContext && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-400" /> XML Delimiter Isolation
                        Preview
                      </h4>
                      <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48">
                        {audit.delimitedContext}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: TOOL EVIDENCE */}
          {!loading && activeTab === 'EVIDENCE' && (
            <div className="space-y-6">
              {!evidence ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <FileCode className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-medium text-sm">
                    No tool evidence bundle collected yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Semgrep */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase">Semgrep SAST</h4>
                    {evidence.codeAnalysis?.semgrep?.execution.status === 'SUCCEEDED' ? (
                      <>
                        <p className="text-sm font-semibold text-white">
                          {evidence.codeAnalysis.semgrep.totalIssues} Total Issues
                        </p>
                        <div className="flex gap-2 text-xs">
                          <span className="text-red-400 font-mono">
                            Crit: {evidence.codeAnalysis.semgrep.criticalCount}
                          </span>
                          <span className="text-amber-400 font-mono">
                            High: {evidence.codeAnalysis.semgrep.highCount}
                          </span>
                          <span className="text-slate-400 font-mono">
                            Med: {evidence.codeAnalysis.semgrep.mediumCount}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-amber-300">
                        Scan{' '}
                        {evidence.codeAnalysis?.semgrep?.execution.status?.toLowerCase() ||
                          'unavailable'}{' '}
                        — no zero-result inferred.
                      </p>
                    )}
                  </div>

                  {/* Gitleaks & Trivy */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase">
                      Secrets & Dependencies
                    </h4>
                    {evidence.codeAnalysis?.gitleaks?.execution.status === 'SUCCEEDED' ? (
                      <p className="text-xs text-slate-300">
                        Gitleaks:{' '}
                        <span className="font-mono text-white font-bold">
                          {evidence.codeAnalysis.gitleaks.secretsFoundCount}
                        </span>{' '}
                        secrets
                      </p>
                    ) : (
                      <p className="text-xs text-amber-300">
                        Gitleaks{' '}
                        {evidence.codeAnalysis?.gitleaks?.execution.status?.toLowerCase() ||
                          'unavailable'}
                      </p>
                    )}
                    {evidence.codeAnalysis?.trivy?.execution.status === 'SUCCEEDED' ? (
                      <p className="text-xs text-slate-300">
                        Trivy CVEs:{' '}
                        <span className="font-mono text-white font-bold">
                          {evidence.codeAnalysis.trivy.vulnerabilityCount}
                        </span>{' '}
                        total
                      </p>
                    ) : (
                      <p className="text-xs text-amber-300">
                        Trivy{' '}
                        {evidence.codeAnalysis?.trivy?.execution.status?.toLowerCase() ||
                          'unavailable'}
                      </p>
                    )}
                  </div>

                  {/* Lighthouse (Frontend) */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase">
                      Lighthouse Frontend CI
                    </h4>
                    {evidence.frontendEval?.lighthouse ? (
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          Perf:{' '}
                          <span className="text-white font-bold">
                            {evidence.frontendEval.lighthouse.performance}
                          </span>
                        </div>
                        <div>
                          A11y:{' '}
                          <span className="text-white font-bold">
                            {evidence.frontendEval.lighthouse.accessibility}
                          </span>
                        </div>
                        <div>
                          SEO:{' '}
                          <span className="text-white font-bold">
                            {evidence.frontendEval.lighthouse.seo}
                          </span>
                        </div>
                        <div>
                          Best:{' '}
                          <span className="text-white font-bold">
                            {evidence.frontendEval.lighthouse.bestPractices}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Not executed (Backend-only or URL omitted)
                      </p>
                    )}
                  </div>

                  {/* Schemathesis (Backend) */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase">
                      Schemathesis API Tests
                    </h4>
                    {evidence.backendEval?.schemathesis ? (
                      <div className="text-xs text-slate-300 space-y-1">
                        <p>
                          Total Tests:{' '}
                          <span className="font-mono text-white font-bold">
                            {evidence.backendEval.schemathesis.totalTests}
                          </span>
                        </p>
                        <p>
                          Passed:{' '}
                          <span className="font-mono text-emerald-400 font-bold">
                            {evidence.backendEval.schemathesis.passed}
                          </span>
                        </p>
                        <p>
                          Failed:{' '}
                          <span className="font-mono text-red-400 font-bold">
                            {evidence.backendEval.schemathesis.failed}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Not executed (Frontend-only scope)</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REPLAY TRACE (§20) */}
          {!loading && activeTab === 'REPLAY' && (
            <div className="space-y-4">
              {!replay ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-medium text-sm">
                    No execution replay recorded yet.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400">Workflow ID: </span>
                      <span className="font-mono text-indigo-300">{replay.workflowId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Duration: </span>
                      <span className="font-mono text-white font-bold">
                        {replay.totalDurationMs} ms
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {replay.activities.map((act, i) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Terminal className="w-4 h-4 text-indigo-400" />
                          <div>
                            <span className="font-semibold text-white">{act.activityName}</span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              Duration: {act.durationMs}ms
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {act.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 5: JUDGE OVERRIDE */}
          {!loading && activeTab === 'OVERRIDE' && (
            <form
              onSubmit={handleApplyOverride}
              className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-4"
            >
              <div>
                <h4 className="text-sm font-semibold text-white">Manual Judge Override</h4>
                <p className="text-xs text-slate-400">
                  Judges may adjust automated scores with mandatory audit logging.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  New Score (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  value={overrideScoreVal}
                  onChange={(e) => setOverrideScoreVal(parseFloat(e.target.value) || 0)}
                  className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason for Override
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why the automated score or injection flag was adjusted..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={overrideSubmitting || !overrideReason.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
              >
                {overrideSubmitting ? 'Saving...' : 'Apply Judge Override'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

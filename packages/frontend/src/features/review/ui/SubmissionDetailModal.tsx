import React, { useState, useEffect, useCallback } from 'react';
import { ModalShell } from '../../../shared/ui/ModalShell';
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
  ArrowRight,
  Zap,
  Target,
  Sparkles,
  Check,
  BarChart3,
  TrendingUp,
  ExternalLink,
  Layers,
  HelpCircle,
  Filter,
  Download
} from 'lucide-react';
import { NotionExportModal } from './NotionExportModal';
import {
  ReviewSubmission,
  ReviewEvaluation,
  SanitizationAudit,
  EvidenceBundle,
  ReplayTrace,
  RelativeComparison,
  RelativeGrading,
  SelfImprovement,
  SelfStrengths,
  RedesignWhyThisRankExplanation
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
  const [evidenceExplorerData, setEvidenceExplorerData] = useState<any | null>(null);
  const [evidenceFilterDim, setEvidenceFilterDim] = useState<string>('ALL');

  const [rankingInfo, setRankingInfo] = useState<{
    rank: number;
    totalSubmissionsRanked: number;
    latentSkillScore: number;
    winRate: number;
    confidenceInterval: [number, number];
    rankReason?: string;
    relativeGrading?: RelativeGrading;
    whyAmIExplanation?: RedesignWhyThisRankExplanation;
    relativeAnalysis?: {
      comparedToAbove?: RelativeComparison | null;
      comparedToBelow?: RelativeComparison | null;
      selfImprovement?: SelfImprovement | null;
      selfStrengths?: SelfStrengths | null;
    };
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // Judge Override states (§25)
  const [overrideAction, setOverrideAction] = useState<'ACCEPT' | 'MODIFY' | 'FLAG_FOR_REVIEW'>(
    'MODIFY'
  );
  const [overrideScoreVal, setOverrideScoreVal] = useState<number>(90);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [isNotionModalOpen, setIsNotionModalOpen] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!submissionId) return;
    try {
      setLoading(true);
      const report = await reviewApi.getEvaluationReport(submissionId);
      setSubmission(report.submission);
      setEvaluation(report.evaluation || null);
      if (report.evaluation?.overallScore !== undefined) {
        setOverrideScoreVal(report.evaluation.overallScore);
      }
      setEvidence(report.evidence || null);
      setAudit(report.sanitizationAudit || null);
      setRankingInfo(report.ranking || null);

      try {
        const replayData = await reviewApi.getReplayTrace(submissionId);
        setReplay(replayData);
      } catch {
        // May not have replay yet if not run
      }

      try {
        const explorer = await reviewApi.getEvidenceExplorer(submissionId);
        setEvidenceExplorerData(explorer);
      } catch {
        // Explorer optional fallback
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
      const updated = await reviewApi.overrideScore(submissionId, {
        action: overrideAction,
        newScore: overrideAction === 'MODIFY' ? overrideScoreVal : undefined,
        reason: overrideReason
      });
      setEvaluation(updated);
      onUpdated();
      alert(`Judge decision recorded successfully: ${overrideAction}`);
    } catch (err) {
      console.error('Failed to apply override', err);
      alert('Failed to apply override. Please check the logs.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleExportSubmissionCsv = async () => {
    if (!submissionId) return;
    try {
      setCsvExporting(true);
      await reviewApi.downloadSubmissionCsv(submissionId, submission?.teamName || 'submission');
    } catch (err) {
      console.error('Failed to export submission CSV', err);
      alert('Failed to export submission CSV report.');
    } finally {
      setCsvExporting(false);
    }
  };

  // Extract all structured findings for Evidence Explorer (§20)
  const allFindings: Array<{
    dimension: string;
    observedFact: string;
    interpretation: string;
    aiJudgment: string;
    scoreImpact: number;
    sourceFiles: string[];
  }> = [];

  if (
    evidenceExplorerData?.engineeringEvidence &&
    Array.isArray(evidenceExplorerData.engineeringEvidence)
  ) {
    evidenceExplorerData.engineeringEvidence.forEach((f: any) => allFindings.push(f));
  } else if (evaluation?.engineeringEvidence && Array.isArray(evaluation.engineeringEvidence)) {
    evaluation.engineeringEvidence.forEach((f: any) => allFindings.push(f));
  } else if (evaluation?.dimensionScores) {
    Object.entries(evaluation.dimensionScores).forEach(([dimKey, dimVal]: [string, any]) => {
      if (dimVal?.findings && Array.isArray(dimVal.findings)) {
        dimVal.findings.forEach((f: any) => {
          allFindings.push({
            dimension: dimKey,
            observedFact: f.observedFact,
            interpretation: f.interpretation,
            aiJudgment: f.aiJudgment,
            scoreImpact: f.scoreImpact ?? 0,
            sourceFiles: f.sourceFiles ?? []
          });
        });
      }
    });
  }

  const filteredFindings =
    evidenceFilterDim === 'ALL'
      ? allFindings
      : allFindings.filter((f) => f.dimension.toLowerCase() === evidenceFilterDim.toLowerCase());

  return (
    <ModalShell onClose={onClose} size="5xl">
      <div className="flex min-h-0 flex-col overflow-hidden flex flex-col max-h-[90vh] text-zinc-900 font-sans">
        {/* Top Header */}
        <div className="relative flex flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 pr-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                  {submission?.teamName || 'Submission Details'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {submission?.teamId}
                </span>
                {submission?.flaggedForHumanReview && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> FLAGGED ANOMALY
                  </span>
                )}
              </div>
              <p className="mt-0.5 break-all font-mono text-xs text-zinc-500">
                {submission?.repositoryUrl}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportSubmissionCsv}
              disabled={csvExporting || !evaluation}
              className="px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Download single-project detailed evaluation CSV"
            >
              <Download
                className={`w-3.5 h-3.5 text-blue-600 ${csvExporting ? 'animate-bounce' : ''}`}
              />
              <span>{csvExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
            <button
              onClick={() => setIsNotionModalOpen(true)}
              disabled={!evaluation}
              className="px-3 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Export project evaluation dossier to Notion"
            >
              <span className="font-serif font-black text-xs">N</span>
              <span>Notion Final</span>
            </button>
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {evaluating ? 'Running Pipeline...' : 'Run Pipeline'}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 lg:static"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Overall Score Banner */}
        <div className="px-4 py-3 sm:px-6 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-zinc-500">Status: </span>
              <span className="font-semibold text-blue-600 uppercase">{submission?.status}</span>
            </div>
            {submission?.branch && (
              <div>
                <span className="text-zinc-500">Branch: </span>
                <span className="font-mono text-zinc-800 font-medium">{submission.branch}</span>
              </div>
            )}
            {submission?.liveSiteUrl && (
              <div>
                <span className="text-zinc-500">Live URL: </span>
                <a
                  href={submission.liveSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-blue-600 hover:underline"
                >
                  {submission.liveSiteUrl}
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {evaluation?.objectiveScore !== undefined && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-700 font-mono">
                Objective (40%): <strong>{(evaluation.objectiveScore / 10).toFixed(1)}/10</strong>
              </span>
            )}
            {evaluation?.qualitativeScore !== undefined && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                Qualitative (60%):{' '}
                <strong>{(evaluation.qualitativeScore / 10).toFixed(1)}/10</strong>
              </span>
            )}
            {evaluation?.confidenceScore !== undefined && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                Conf: <strong>{evaluation.confidenceScore}%</strong>
              </span>
            )}
            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-zinc-500">Calibrated:</span>
              <span className="text-base font-bold font-mono text-zinc-900">
                {evaluation?.overallScore !== undefined
                  ? `${(evaluation.overallScore / 10).toFixed(2)}/10`
                  : 'Not Evaluated'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 pt-2 sm:px-6">
          <button
            onClick={() => setActiveTab('SCORECARD')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'SCORECARD'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Scorecard & 9 Dimensions
          </button>
          <button
            onClick={() => setActiveTab('RELATIVE')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'RELATIVE'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> Why #{rankingInfo?.rank || 'X'}? (§18)
            {rankingInfo?.rank && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono font-bold">
                #{rankingInfo.rank}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('EVIDENCE')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'EVIDENCE'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> Evidence Explorer (§20)
          </button>
          <button
            onClick={() => setActiveTab('SANITIZATION')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'SANITIZATION'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Prompt-Injection Audit
            {audit?.flaggedAnomaly && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('REPLAY')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'REPLAY'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Replay Trace (§20)
          </button>
          <button
            onClick={() => setActiveTab('OVERRIDE')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'OVERRIDE'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Judge Override (§25)
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="text-center py-12 text-zinc-400 text-sm">Loading details...</div>
          )}

          {/* TAB 1: SCORECARD */}
          {!loading && activeTab === 'SCORECARD' && (
            <div className="space-y-6">
              {!evaluation ? (
                <div className="text-center py-12 border border-dashed border-zinc-200 rounded-2xl">
                  <Award className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-700 font-semibold text-sm">
                    No evaluation scorecard available yet.
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Click &quot;Run Pipeline&quot; above to execute the automated evaluation.
                  </p>
                </div>
              ) : (
                <>
                  {/* Relative Standing Banner */}
                  {rankingInfo && (
                    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 border border-amber-200 rounded-lg">
                          <Trophy className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <span className="text-xs font-bold text-zinc-900">
                              Event Leaderboard Standing:
                            </span>
                            <span className="text-xs font-mono font-bold text-amber-700">
                              Rank #{rankingInfo.rank} of {rankingInfo.totalSubmissionsRanked}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Latent Skill Rating:{' '}
                            <span className="text-blue-700 font-mono font-semibold">
                              {Number(rankingInfo.latentSkillScore).toFixed(2)}
                            </span>{' '}
                            &bull; Win Rate:{' '}
                            <span className="text-emerald-700 font-mono font-semibold">
                              {Math.round((rankingInfo.winRate || 0) * 100)}%
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('RELATIVE')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Trophy className="w-3.5 h-3.5" /> View Relative Analysis
                      </button>
                    </div>
                  )}

                  {/* 3-Pillar Score Breakdown Card (§13, §14) */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                      <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        Calibrated Engineering Evaluation Formula
                      </span>
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">
                        Final = 0.40 &times; Objective + 0.60 &times; Qualitative
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-white p-3 rounded-lg border border-zinc-200 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                          Objective Score (40%)
                        </span>
                        <div className="text-lg font-bold font-mono text-zinc-900">
                          {evaluation.objectiveScore !== undefined
                            ? `${(evaluation.objectiveScore / 10).toFixed(1)} / 10`
                            : `${(evaluation.overallScore / 10).toFixed(1)} / 10`}
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Deterministic static analysis: LOC, branching complexity, code
                          duplication, test ratios, type safety, tech debt markers.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-zinc-200 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-purple-700 uppercase block">
                          Qualitative Score (60%)
                        </span>
                        <div className="text-lg font-bold font-mono text-purple-800">
                          {evaluation.qualitativeScore !== undefined
                            ? `${(evaluation.qualitativeScore / 10).toFixed(1)} / 10`
                            : `${(evaluation.overallScore / 10).toFixed(1)} / 10`}
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          LangChain Mistral Round-Robin qualitative audit across modularity, error
                          resilience, and engineering rigor.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-zinc-200 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-blue-700 uppercase block">
                          Confidence Rating
                        </span>
                        <div className="text-lg font-bold font-mono text-blue-700">
                          {evaluation.confidenceScore || 92}%
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Empirical confidence based on evidence completeness, test coverage, and
                          verification depth.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* §19 Highest-Impact Improvement Roadmap */}
                  {evaluation.highestImpactImprovements &&
                    evaluation.highestImpactImprovements.length > 0 && (
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                              Highest-Impact Improvement Roadmap (§19)
                            </h4>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            Prioritized by Score Gain
                          </span>
                        </div>
                        <p className="text-xs text-blue-800">
                          Actionable engineering recommendations ordered by estimated impact on your
                          project&apos;s rank and score.
                        </p>
                        <div className="grid grid-cols-1 gap-2.5">
                          {evaluation.highestImpactImprovements.map((imp, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-white border border-blue-200 rounded-lg text-xs space-y-1 shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-zinc-900">Priority #{idx + 1}</span>
                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  High Score Impact
                                </span>
                              </div>
                              <p className="text-zinc-700 leading-relaxed">{imp}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* §13 & §14 The 9 Engineering Dimensions */}
                  {evaluation.dimensionScores &&
                    Object.keys(evaluation.dimensionScores).length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-zinc-500" />9 Core Engineering
                            Dimensions (§13 & §14)
                          </h3>
                          <span className="text-[11px] text-zinc-500">
                            Click any dimension to inspect structured evidence
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {Object.entries(evaluation.dimensionScores).map(([key, dim]) => (
                            <div
                              key={key}
                              className="p-3.5 bg-white border border-zinc-200 hover:border-blue-300 rounded-xl space-y-2 shadow-sm transition-all"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <h4 className="text-xs font-bold text-zinc-900">
                                    {dim.dimensionName}
                                  </h4>
                                  <span className="text-[10px] text-zinc-500 block font-mono">
                                    Weight: {Math.round(dim.weight * 100)}%
                                  </span>
                                </div>
                                <span
                                  className={`text-xs font-mono font-black px-2 py-0.5 rounded border ${
                                    dim.finalScore >= 80
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : dim.finalScore >= 60
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {(dim.finalScore / 10).toFixed(1)}/10
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] font-mono pt-1 border-t border-zinc-100">
                                <span className="text-zinc-500">
                                  Obj: <strong>{(dim.objectiveScore / 10).toFixed(1)}</strong>
                                </span>
                                <span className="text-purple-700 text-right">
                                  Qual: <strong>{(dim.qualitativeScore / 10).toFixed(1)}</strong>
                                </span>
                              </div>

                              {dim.findings && dim.findings.length > 0 && (
                                <button
                                  onClick={() => {
                                    setEvidenceFilterDim(key);
                                    setActiveTab('EVIDENCE');
                                  }}
                                  className="w-full text-left text-[11px] text-blue-600 hover:underline flex items-center justify-between pt-1 font-medium"
                                >
                                  <span>{dim.findings.length} Verified Findings</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Synthesis Summary */}
                  {evaluation.synthesisSummary && (
                    <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl text-xs leading-relaxed text-zinc-700">
                      <span className="font-semibold text-blue-700 block mb-1 uppercase tracking-wider text-[10px]">
                        AI Evaluator Synthesis
                      </span>
                      {evaluation.synthesisSummary}
                    </div>
                  )}

                  {/* Grounded Rubric Criteria Scores (Event Rubric Compliance) */}
                  {evaluation.criterionScores && evaluation.criterionScores.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                        Grounded Rubric Criteria Breakdown
                      </h3>
                      <div className="space-y-3">
                        {evaluation.criterionScores.map((cs) => (
                          <div
                            key={cs.criterionId}
                            className="p-4 bg-white border border-zinc-200 rounded-xl space-y-2 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-zinc-900">{cs.name}</h4>
                                <p className="text-xs text-zinc-500 mt-0.5">{cs.justification}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold font-mono text-blue-600">
                                  {cs.rawScore}/100
                                </span>
                                <span className="text-[10px] text-zinc-500 block">
                                  Weighted: {cs.weightedScore}
                                </span>
                              </div>
                            </div>

                            {/* Citations */}
                            {cs.evidenceCitations && cs.evidenceCitations.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-100">
                                {cs.evidenceCitations.map((cit, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-zinc-600 font-mono"
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
                  )}

                  {/* Requirement Fulfillment */}
                  {evaluation.requirementCompliance &&
                    evaluation.requirementCompliance.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                          Problem Statement Requirements
                        </h3>
                        <div className="space-y-2">
                          {evaluation.requirementCompliance.map((req) => (
                            <div
                              key={req.requirementId}
                              className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                {req.status === 'FULFILLED' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : req.status === 'PARTIAL' ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <div>
                                  <span className="font-semibold text-zinc-900">{req.title}</span>
                                  <p className="text-zinc-500 text-[11px]">{req.evidenceSummary}</p>
                                </div>
                              </div>
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 font-semibold">
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
                <div className="text-center py-12 border border-dashed border-zinc-200 rounded-2xl space-y-3">
                  <Trophy className="w-10 h-10 text-zinc-300 mx-auto" />
                  <p className="text-zinc-700 font-semibold text-sm">
                    No relative ranking computed for this event yet.
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Once multiple submissions in this event are evaluated, the Bradley-Terry ranking
                    engine provides head-to-head relative analysis.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overview Stats Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <Trophy className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                          Relative Rank
                        </span>
                        <div className="text-lg font-bold font-mono text-zinc-900 flex items-center gap-1.5">
                          <span>#{rankingInfo.rank}</span>
                          <span className="text-xs text-zinc-500 font-normal">
                            of {rankingInfo.totalSubmissionsRanked} teams
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <Zap className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                          Latent Skill Rating
                        </span>
                        <span className="text-lg font-bold font-mono text-blue-700">
                          {Number(rankingInfo.latentSkillScore).toFixed(2)} / 100
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <Target className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                          Pairwise Win Rate
                        </span>
                        <span className="text-lg font-bold font-mono text-emerald-700">
                          {Math.round((rankingInfo.winRate || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* §18 "Why Am I #X?" Deep-Dive Explanation Card */}
                  {rankingInfo.whyAmIExplanation && (
                    <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900">
                              Why Am I #{rankingInfo.rank}? (Relative Engineering Explanation)
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                              Transparent evidence-driven reasoning comparing your codebase against
                              close neighbors and #1.
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                          Confidence: {rankingInfo.whyAmIExplanation.confidenceScore}%
                        </span>
                      </div>

                      <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 leading-relaxed font-medium">
                        {rankingInfo.whyAmIExplanation.whyThisRankHeadline}
                      </div>

                      {/* Ranked Below Previous */}
                      {rankingInfo.whyAmIExplanation.whyRankedAboveBelow?.rankedBelowPrevious && (
                        <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                            <ArrowUpRight className="w-4 h-4 text-rose-600" />
                            <span>
                              What #{rankingInfo.rank - 1} (
                              {
                                rankingInfo.whyAmIExplanation.whyRankedAboveBelow
                                  .rankedBelowPrevious.targetTeamName
                              }
                              ) Did Better:
                            </span>
                          </div>
                          <p className="text-xs text-zinc-700">
                            {
                              rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedBelowPrevious
                                .reason
                            }
                          </p>
                          {rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedBelowPrevious
                            .keyDeficits.length > 0 && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-rose-700 block mb-1">
                                Concrete Deficits Identified in Your Codebase:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedBelowPrevious.keyDeficits.map(
                                  (def, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[11px] px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-rose-900 font-medium"
                                    >
                                      &bull; {def}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                          {rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedBelowPrevious
                            .higherRankedAdvantages.length > 0 && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-zinc-600 block mb-1">
                                Their Verified Competitive Advantages:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedBelowPrevious.higherRankedAdvantages.map(
                                  (adv, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[11px] px-2.5 py-1 bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-800"
                                    >
                                      + {adv}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ranked Above Next */}
                      {rankingInfo.whyAmIExplanation.whyRankedAboveBelow?.rankedAboveNext && (
                        <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                            <span>
                              Competitive Edge Over #{rankingInfo.rank + 1} (
                              {
                                rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedAboveNext
                                  .targetTeamName
                              }
                              ):
                            </span>
                          </div>
                          <p className="text-xs text-zinc-700">
                            {
                              rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedAboveNext
                                .reason
                            }
                          </p>
                          {rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedAboveNext
                            .keyAdvantages.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {rankingInfo.whyAmIExplanation.whyRankedAboveBelow.rankedAboveNext.keyAdvantages.map(
                                (adv, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-emerald-900 font-medium"
                                  >
                                    &check; {adv}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Comparison with Champion */}
                      {rankingInfo.whyAmIExplanation.comparisonWithChampion &&
                        rankingInfo.rank > 1 && (
                          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                              <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-500" />
                                <span>
                                  Comparison with Event Champion (
                                  {
                                    rankingInfo.whyAmIExplanation.comparisonWithChampion
                                      .championTeamName
                                  }
                                  )
                                </span>
                              </div>
                              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                Champion Score:{' '}
                                {(
                                  rankingInfo.whyAmIExplanation.comparisonWithChampion
                                    .championScore / 10
                                ).toFixed(2)}
                                /10
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                              <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                                <span className="text-[10px] font-bold uppercase text-amber-800 block">
                                  Where Champion Excelled:
                                </span>
                                <ul className="space-y-1 text-zinc-700 text-[11px]">
                                  {rankingInfo.whyAmIExplanation.comparisonWithChampion.championKeyStrengths.map(
                                    (s, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-amber-600 font-bold">&bull;</span>
                                        <span>{s}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                                <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                                  Your Counter-Advantages:
                                </span>
                                <ul className="space-y-1 text-zinc-700 text-[11px]">
                                  {rankingInfo.whyAmIExplanation.comparisonWithChampion.yourAdvantagesOverChampion.map(
                                    (s, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-600 font-bold">&check;</span>
                                        <span>{s}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Rank Decision & Deterministic Reason Banner */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                        Official Rank Decision & Deterministic Reason
                      </span>
                    </div>
                    <p className="text-xs text-zinc-800 leading-relaxed font-mono">
                      {rankingInfo.rankReason ||
                        `Rank #${rankingInfo.rank} assigned via Bradley-Terry evaluation.`}
                    </p>
                  </div>

                  {/* Relative Grading & Cohort Benchmark Card ("Why These Marks?") */}
                  {rankingInfo.relativeGrading && (
                    <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900">
                              Relative Grading & Score Calibration
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                              Why these marks were awarded relative to cohort performance and rubric
                              benchmarks.
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                          {rankingInfo.relativeGrading.tierLabel}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                            Cohort Standing
                          </span>
                          <span className="text-sm font-bold font-mono text-zinc-900">
                            {rankingInfo.relativeGrading.percentile}th %ile
                          </span>
                        </div>
                        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                            Cohort Average
                          </span>
                          <span className="text-sm font-bold font-mono text-zinc-700">
                            {rankingInfo.relativeGrading.cohortAverage} pts
                          </span>
                        </div>
                        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                            Cohort Median
                          </span>
                          <span className="text-sm font-bold font-mono text-zinc-700">
                            {rankingInfo.relativeGrading.cohortMedian} pts
                          </span>
                        </div>
                        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                            Delta vs Cohort
                          </span>
                          <span
                            className={`text-sm font-bold font-mono ${
                              rankingInfo.relativeGrading.scoreDeltaFromAverage >= 0
                                ? 'text-emerald-700'
                                : 'text-rose-700'
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
                      <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-zinc-700 leading-relaxed">
                        <span className="font-semibold text-blue-700 block mb-1 text-[10px] uppercase tracking-wider">
                          Rubric Calibration Summary
                        </span>
                        {rankingInfo.relativeGrading.whyTheseMarks}
                      </div>

                      {/* Criteria relative marks breakdown */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                          Criterion-by-Criterion Relative Calibration
                        </span>
                        {rankingInfo.relativeGrading.criteriaRelativeMarks.map((crm) => (
                          <div
                            key={crm.criterionId}
                            className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-900">
                                {crm.criterionName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-mono">
                                  Score:{' '}
                                  <span className="text-zinc-900 font-bold">{crm.yourScore}</span>{' '}
                                  (Cohort Avg: {crm.cohortAverage})
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                    crm.deltaFromAverage >= 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {crm.deltaFromAverage >= 0
                                    ? `+${crm.deltaFromAverage}`
                                    : crm.deltaFromAverage}{' '}
                                  pts
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-500">{crm.whyThisMark}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 1: What to improve (vs Above) OR Path to 100% (when #1) */}
                  <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900">
                            {rankingInfo.relativeAnalysis?.comparedToAbove
                              ? `What to Improve (Compared to Rank #${rankingInfo.relativeAnalysis.comparedToAbove.targetRank} – ${rankingInfo.relativeAnalysis.comparedToAbove.targetTeamName})`
                              : 'Path to 100% & Industry Excellence (Self-Improvement)'}
                          </h3>
                          <p className="text-[11px] text-zinc-500">
                            {rankingInfo.relativeAnalysis?.comparedToAbove
                              ? 'Actionable gap analysis to surpass the project ranked directly above you.'
                              : 'Clear technical guidance to elevate this project to perfect score and production standards.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!rankingInfo.relativeAnalysis?.comparedToAbove ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-3">
                          <Award className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold block">🥇 Currently Holding #1 Rank!</span>
                            <span>
                              There is no submission ranked above this project. You currently lead
                              the event leaderboard!
                            </span>
                          </div>
                        </div>

                        {rankingInfo.relativeAnalysis?.selfImprovement && (
                          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                                  {rankingInfo.relativeAnalysis.selfImprovement.title}
                                </span>
                              </div>
                              {rankingInfo.relativeAnalysis.selfImprovement.gapPoints > 0 && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                                  {rankingInfo.relativeAnalysis.selfImprovement.gapPoints} pts to
                                  100/100
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-zinc-600">
                              {rankingInfo.relativeAnalysis.selfImprovement.summary}
                            </p>

                            {rankingInfo.relativeAnalysis.selfImprovement.recommendations.length >
                              0 && (
                              <div className="space-y-2 mt-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                                  Recommended Polish to Reach Full Marks
                                </span>
                                {rankingInfo.relativeAnalysis.selfImprovement.recommendations.map(
                                  (rec) => (
                                    <div
                                      key={rec.criterionId}
                                      className="p-2.5 bg-white border border-zinc-200 rounded-lg space-y-1"
                                    >
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-zinc-800">
                                          {rec.criterionName}
                                        </span>
                                        <span className="text-[10px] font-mono text-rose-600 font-bold">
                                          -{rec.gap} pts gap
                                        </span>
                                      </div>
                                      <p className="text-xs text-zinc-500">{rec.actionableSteps}</p>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-zinc-200 space-y-1.5">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                                Industry Production Standards Checklist
                              </span>
                              <ul className="space-y-1 text-xs text-zinc-600">
                                {rankingInfo.relativeAnalysis.selfImprovement.industryBestPractices.map(
                                  (bp, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
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
                        <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl text-xs text-zinc-700 leading-relaxed">
                          <span className="font-semibold text-rose-700 block mb-1 text-[10px] uppercase tracking-wider">
                            Target Goal
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToAbove.summary}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Criterion Gap Breakdown
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToAbove.criteriaDeltas.map(
                            (delta) => (
                              <div
                                key={delta.criterionId}
                                className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-zinc-900">
                                    {delta.criterionName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500 font-mono">
                                      You:{' '}
                                      <span className="text-zinc-900 font-bold">
                                        {delta.yourScore}
                                      </span>{' '}
                                      vs Them:{' '}
                                      <span className="text-zinc-900 font-bold">
                                        {delta.theirScore}
                                      </span>
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                        delta.delta < 0
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : delta.delta > 0
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-zinc-100 text-zinc-700'
                                      }`}
                                    >
                                      {delta.delta > 0 ? `+${delta.delta}` : delta.delta} pts
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500">{delta.feedback}</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: What is good (vs Below) OR Core Foundation (when last place) */}
                  <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900">
                            {rankingInfo.relativeAnalysis?.comparedToBelow
                              ? `Key Strengths (Compared to Rank #${rankingInfo.relativeAnalysis.comparedToBelow.targetRank} – ${rankingInfo.relativeAnalysis.comparedToBelow.targetTeamName})`
                              : 'Core Technical Strengths & Foundation'}
                          </h3>
                          <p className="text-[11px] text-zinc-500">
                            {rankingInfo.relativeAnalysis?.comparedToBelow
                              ? 'Competitive advantages that place your project ahead of the team below.'
                              : 'Foundational accomplishments and rubric criteria successfully mastered.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!rankingInfo.relativeAnalysis?.comparedToBelow ? (
                      rankingInfo.relativeAnalysis?.selfStrengths ? (
                        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                              {rankingInfo.relativeAnalysis.selfStrengths.title}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600">
                            {rankingInfo.relativeAnalysis.selfStrengths.summary}
                          </p>
                          <div className="space-y-2">
                            {rankingInfo.relativeAnalysis.selfStrengths.highlights.map((hl) => (
                              <div
                                key={hl.criterionId}
                                className="p-2.5 bg-white border border-zinc-200 rounded-lg space-y-0.5"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-zinc-800">
                                    {hl.criterionName}
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                                    {hl.score}/100
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500">{hl.accomplishment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 text-xs">
                          No evaluated submission ranked below this project yet.
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl text-xs text-zinc-700 leading-relaxed">
                          <span className="font-semibold text-emerald-700 block mb-1 text-[10px] uppercase tracking-wider">
                            Advantage Summary
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToBelow.summary}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Competitive Lead Breakdown
                          </span>
                          {rankingInfo.relativeAnalysis.comparedToBelow.criteriaDeltas.map(
                            (delta) => (
                              <div
                                key={delta.criterionId}
                                className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-zinc-900">
                                    {delta.criterionName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500 font-mono">
                                      You:{' '}
                                      <span className="text-zinc-900 font-bold">
                                        {delta.yourScore}
                                      </span>{' '}
                                      vs Them:{' '}
                                      <span className="text-zinc-900 font-bold">
                                        {delta.theirScore}
                                      </span>
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                        delta.delta > 0
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : delta.delta < 0
                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                            : 'bg-zinc-100 text-zinc-700'
                                      }`}
                                    >
                                      {delta.delta > 0 ? `+${delta.delta}` : delta.delta} pts
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500">{delta.feedback}</p>
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
                <div className="text-center py-12 border border-dashed border-zinc-200 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-700 font-semibold text-sm">
                    No sanitization audit record available yet.
                  </p>
                </div>
              ) : (
                <>
                  {/* Flag Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      audit.flaggedAnomaly
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
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
                        <p className="text-xs opacity-90 mt-0.5">
                          {audit.anomalyReason ||
                            'All untrusted candidate inputs were successfully isolated without injection patterns.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Injection Markers */}
                  {audit.injectionMarkersFound && audit.injectionMarkersFound.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                        Detected Injection Markers ({audit.injectionMarkersFound.length})
                      </h4>
                      <div className="space-y-2">
                        {audit.injectionMarkersFound.map((marker, i) => (
                          <div
                            key={i}
                            className="p-3 bg-white border border-red-200 rounded-xl space-y-1 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-red-700">
                                {marker.pattern}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-semibold">
                                {marker.severity}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-zinc-800 bg-zinc-50 border border-zinc-200 p-2 rounded">
                              &quot;{marker.snippet}&quot;
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Neutral Claims */}
                  {audit.extractedClaims && (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                        Low-Privilege Extraction Layer Output (Restructured Data)
                      </h4>
                      <p className="text-xs text-zinc-700">{audit.extractedClaims.summary}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                            Extracted Features:
                          </span>
                          <ul className="text-xs text-zinc-700 list-disc list-inside mt-1 space-y-0.5">
                            {audit.extractedClaims.claimedFeatures.map((f, idx) => (
                              <li key={idx}>{f}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                            Tech Mentions:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {audit.extractedClaims.techStackClaims.map((t, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 bg-white rounded border border-zinc-200 text-zinc-700 font-mono"
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
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-600" /> XML Delimiter Isolation
                        Preview
                      </h4>
                      <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-200 overflow-x-auto max-h-48">
                        {audit.delimitedContext}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: EVIDENCE EXPLORER (§20) */}
          {!loading && activeTab === 'EVIDENCE' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-blue-600" />
                    Interactive Evidence Explorer (§20)
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Drill-down: Observed Fact &rarr; Interpretation &rarr; AI Judgment &rarr; Score
                    Impact &rarr; Source Code
                  </p>
                </div>
              </div>

              {/* 1. Deterministic Static Metrics (§8, §13) */}
              {evidenceExplorerData?.deterministicMetrics && (
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-zinc-600" />
                      Deterministic Codebase Metrics
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600">
                      Static Analysis Engine
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                    {/* LOC */}
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl space-y-0.5 shadow-sm">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                        Lines of Code (LOC)
                      </span>
                      <span className="font-mono text-base font-bold text-zinc-900">
                        {evidenceExplorerData.deterministicMetrics.loc?.toLocaleString() || 0}
                      </span>
                    </div>

                    {/* Cyclomatic Complexity */}
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl space-y-0.5 shadow-sm">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                        Branching Complexity
                      </span>
                      <div className="font-mono text-xs font-semibold text-zinc-800">
                        Avg:{' '}
                        <span className="font-bold text-blue-600">
                          {evidenceExplorerData.deterministicMetrics.cyclomaticComplexity
                            ?.average || 0}
                        </span>{' '}
                        | Max:{' '}
                        <span className="font-bold text-amber-600">
                          {evidenceExplorerData.deterministicMetrics.cyclomaticComplexity?.max || 0}
                        </span>
                      </div>
                    </div>

                    {/* Code Duplication */}
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl space-y-0.5 shadow-sm">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                        Code Duplication
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-900">
                        {evidenceExplorerData.deterministicMetrics.codeDuplication
                          ?.duplicationPercentage || 0}
                        % (
                        {evidenceExplorerData.deterministicMetrics.codeDuplication
                          ?.duplicateBlocksCount || 0}{' '}
                        blocks)
                      </span>
                    </div>

                    {/* Test Suite Coverage */}
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl space-y-0.5 shadow-sm">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                        Test Suite Coverage
                      </span>
                      <div className="font-mono text-xs text-zinc-800">
                        <span className="font-bold text-emerald-700">
                          {evidenceExplorerData.deterministicMetrics.testMetrics?.testFilesCount ||
                            0}
                        </span>{' '}
                        files &bull; Ratio:{' '}
                        <span className="font-bold">
                          {evidenceExplorerData.deterministicMetrics.testMetrics?.testToCodeRatio ||
                            0}
                        </span>
                      </div>
                    </div>

                    {/* Type Safety */}
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl space-y-0.5 shadow-sm">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                        Type Safety
                      </span>
                      <div className="font-mono text-xs text-zinc-800">
                        {evidenceExplorerData.deterministicMetrics.typeSafety?.explicitTypesCount ||
                          0}{' '}
                        types,{' '}
                        <span className="text-amber-600">
                          {evidenceExplorerData.deterministicMetrics.typeSafety?.anyTypeCount || 0}{' '}
                          anys
                        </span>
                      </div>
                    </div>

                    {/* Tech Debt Markers */}
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl space-y-0.5 shadow-sm">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                        Technical Debt Markers
                      </span>
                      <div className="font-mono text-xs text-zinc-800">
                        <span className="text-rose-600 font-bold">
                          {evidenceExplorerData.deterministicMetrics.techDebtMarkers?.todoCount ||
                            0}
                        </span>{' '}
                        TODOs,{' '}
                        <span className="text-rose-600 font-bold">
                          {evidenceExplorerData.deterministicMetrics.techDebtMarkers?.fixmeCount ||
                            0}
                        </span>{' '}
                        FIXMEs
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Structured Evidence Findings (§10, §20) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                    Structured Evidence Findings ({filteredFindings.length})
                  </span>
                  {/* Dimension Filter Tabs */}
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {[
                      'ALL',
                      'architecture',
                      'codeQuality',
                      'maintainability',
                      'testing',
                      'reliability',
                      'complexity',
                      'engineeringPractices',
                      'securityPractices',
                      'technicalDebt'
                    ].map((dim) => (
                      <button
                        key={dim}
                        onClick={() => setEvidenceFilterDim(dim)}
                        className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer ${
                          evidenceFilterDim.toLowerCase() === dim.toLowerCase()
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {dim === 'ALL' ? 'All Dimensions' : dim}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredFindings.length === 0 ? (
                  <div className="p-5 sm:p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 text-xs">
                    No evidence findings found for the selected filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFindings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl space-y-2.5 shadow-sm transition-all"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                            {finding.dimension}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                              finding.scoreImpact >= 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            Score Impact:{' '}
                            {finding.scoreImpact >= 0
                              ? `+${finding.scoreImpact}`
                              : finding.scoreImpact}{' '}
                            pts
                          </span>
                        </div>

                        {/* Evidence-First Sequence */}
                        <div className="space-y-1.5 text-xs">
                          <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-0.5">
                              🔍 Observed Fact:
                            </span>
                            <p className="text-zinc-800 font-medium font-mono text-[11px]">
                              {finding.observedFact}
                            </p>
                          </div>

                          <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                            <span className="text-[10px] font-bold text-blue-700 uppercase block mb-0.5">
                              💡 Technical Interpretation:
                            </span>
                            <p className="text-zinc-700 leading-snug">{finding.interpretation}</p>
                          </div>

                          <div className="p-2 bg-purple-50/40 rounded-lg border border-purple-100">
                            <span className="text-[10px] font-bold text-purple-800 uppercase block mb-0.5">
                              ⚖️ AI Evaluator Judgment:
                            </span>
                            <p className="text-purple-900 leading-snug font-medium">
                              {finding.aiJudgment}
                            </p>
                          </div>
                        </div>

                        {/* Source Code Citations */}
                        {finding.sourceFiles && finding.sourceFiles.length > 0 && (
                          <div className="pt-1.5 border-t border-zinc-100 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">
                              Source Citations:
                            </span>
                            {finding.sourceFiles.map((file, fIdx) => (
                              <a
                                key={fIdx}
                                href={
                                  submission?.repositoryUrl
                                    ? `${submission.repositoryUrl}/blob/main/${file.replace(/:\d+.*$/, '')}`
                                    : '#'
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-mono px-2 py-0.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <span>{file}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Supplemental Automated Tool Evidence */}
              <div className="space-y-3 pt-3 border-t border-zinc-200">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Automated Security & Performance Tool Evidence
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Semgrep */}
                  <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-1.5 shadow-sm text-xs">
                    <h4 className="text-xs font-bold text-blue-700 uppercase">Semgrep SAST</h4>
                    <p className="text-sm font-semibold text-zinc-900">
                      {evidence?.codeAnalysis?.semgrep?.totalIssues || 0} Total Issues
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className="text-red-600 font-mono font-semibold">
                        Crit: {evidence?.codeAnalysis?.semgrep?.criticalCount || 0}
                      </span>
                      <span className="text-amber-600 font-mono font-semibold">
                        High: {evidence?.codeAnalysis?.semgrep?.highCount || 0}
                      </span>
                      <span className="text-zinc-500 font-mono">
                        Med: {evidence?.codeAnalysis?.semgrep?.mediumCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Secrets & CVEs */}
                  <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-1.5 shadow-sm text-xs">
                    <h4 className="text-xs font-bold text-blue-700 uppercase">Secrets & CVEs</h4>
                    <p className="text-zinc-600">
                      Gitleaks:{' '}
                      <strong className="font-mono text-zinc-900">
                        {evidence?.codeAnalysis?.gitleaks?.secretsFoundCount || 0}
                      </strong>{' '}
                      secrets
                    </p>
                    <p className="text-zinc-600">
                      Trivy CVEs:{' '}
                      <strong className="font-mono text-zinc-900">
                        {evidence?.codeAnalysis?.trivy?.vulnerabilityCount || 0}
                      </strong>{' '}
                      total
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REPLAY TRACE (§20) */}
          {!loading && activeTab === 'REPLAY' && (
            <div className="space-y-4">
              {!replay ? (
                <div className="text-center py-12 border border-dashed border-zinc-200 rounded-2xl">
                  <History className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-700 font-semibold text-sm">
                    No execution replay recorded yet.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
                    <div>
                      <span className="text-zinc-500">Workflow ID: </span>
                      <span className="font-mono text-blue-700 font-semibold">
                        {replay.workflowId}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Duration: </span>
                      <span className="font-mono text-zinc-900 font-bold">
                        {replay.totalDurationMs} ms
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {replay.activities.map((act, i) => (
                      <div
                        key={i}
                        className="p-3 bg-white border border-zinc-200 rounded-xl flex items-center justify-between text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <Terminal className="w-4 h-4 text-blue-600" />
                          <div>
                            <span className="font-semibold text-zinc-900">{act.activityName}</span>
                            <span className="text-[10px] text-zinc-500 block font-mono">
                              Duration: {act.durationMs}ms
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold font-mono">
                          {act.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 5: JUDGE OVERRIDE (§25) */}
          {!loading && activeTab === 'OVERRIDE' && (
            <div className="space-y-6">
              {/* Prior Override Audit Banner */}
              {evaluation?.judgeOverride?.overridden && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-purple-600" /> Active Judge Override Record
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold">
                      Action: {evaluation.judgeOverride.action || 'MODIFY'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-700 space-y-1">
                    <p>
                      Original Score:{' '}
                      <strong className="font-mono">
                        {evaluation.judgeOverride.originalScore !== undefined
                          ? `${evaluation.judgeOverride.originalScore}/100`
                          : 'N/A'}
                      </strong>{' '}
                      &rarr; Overridden Score:{' '}
                      <strong className="font-mono text-purple-800">
                        {evaluation.judgeOverride.newScore !== undefined
                          ? `${evaluation.judgeOverride.newScore}/100`
                          : 'N/A'}
                      </strong>
                    </p>
                    <p className="text-zinc-600 italic bg-white p-2.5 rounded border border-purple-200">
                      &quot;{evaluation.judgeOverride.reason}&quot;
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleApplyOverride}
                className="p-4 sm:p-6 bg-white border border-zinc-200 rounded-xl space-y-5 shadow-sm"
              >
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">
                    Judge Override & Audit Actions (§25)
                  </h4>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Judges may accept AI evaluations, adjust scores with written justifications, or
                    flag projects for re-evaluation.
                  </p>
                </div>

                {/* Action Selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-2">
                    Override Action
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setOverrideAction('ACCEPT')}
                      className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${
                        overrideAction === 'ACCEPT'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Accept Evaluation</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Accept AI scoring as-is with certified judge seal.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverrideAction('MODIFY')}
                      className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${
                        overrideAction === 'MODIFY'
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-blue-800">
                        <Edit3 className="w-4 h-4 text-blue-600" />
                        <span>Modify Score</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Adjust final numerical score with justification.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverrideAction('FLAG_FOR_REVIEW')}
                      className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${
                        overrideAction === 'FLAG_FOR_REVIEW'
                          ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Flag for Review</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Escalate for committee re-evaluation.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Score Input (visible if MODIFY) */}
                {overrideAction === 'MODIFY' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                      New Calibrated Score (0 - 100)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        required
                        value={overrideScoreVal}
                        onChange={(e) => setOverrideScoreVal(parseFloat(e.target.value) || 0)}
                        className="w-32 bg-white border border-zinc-300 rounded-xl px-4 py-2 text-zinc-900 font-mono font-bold text-sm focus:border-blue-600 focus:outline-none"
                      />
                      <span className="text-xs text-zinc-500 font-mono font-semibold">
                        = {(overrideScoreVal / 10).toFixed(2)} / 10
                      </span>
                    </div>
                  </div>
                )}

                {/* Reason Textarea */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                    Written Justification & Audit Reason (Mandatory)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Provide specific engineering justification for accepting, modifying, or flagging this project..."
                    className="w-full bg-white border border-zinc-300 rounded-xl p-3 text-zinc-900 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={overrideSubmitting || !overrideReason.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  {overrideSubmitting ? 'Recording Action...' : 'Save Judge Decision'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <NotionExportModal
        isOpen={isNotionModalOpen}
        onClose={() => setIsNotionModalOpen(false)}
        type="submission"
        id={submissionId || ''}
        title={
          submission?.teamName ? `${submission.teamName} Review Dossier` : 'Project Review Dossier'
        }
      />
    </ModalShell>
  );
};

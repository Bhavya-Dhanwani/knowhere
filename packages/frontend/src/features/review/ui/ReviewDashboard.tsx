import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Trophy,
  AlertTriangle,
  ExternalLink,
  Layers,
  Layout,
  Server,
  Copy,
  Check,
  Play,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  FileText,
  History,
  Trash2,
  Clock,
  Edit3
} from 'lucide-react';
import { ReviewEvent, ReviewSubmission, EventRanking } from '../types';
import { reviewApi } from '../api/reviewApi';
import { CreateEventModal } from './CreateEventModal';
import { EditEventModal } from './EditEventModal';
import { AdaptiveSubmissionModal } from './AdaptiveSubmissionModal';
import { EditSubmissionModal } from './EditSubmissionModal';
import { SubmissionDetailModal } from './SubmissionDetailModal';

export const ReviewDashboard: React.FC = () => {
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [ranking, setRanking] = useState<EventRanking | null>(null);
  const [loading, setLoading] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<{
    current: number;
    total: number;
    teamName: string;
  } | null>(null);

  // Modals & Navigation state
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<ReviewSubmission | null>(null);
  const [inspectSubmissionId, setInspectSubmissionId] = useState<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<
    'SCORECARD' | 'SANITIZATION' | 'EVIDENCE' | 'REPLAY' | 'OVERRIDE'
  >('SCORECARD');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<'RANKING' | 'SCORECARDS' | 'REPLAY'>(
    'RANKING'
  );

  // 1. Fetch Events
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const list = await reviewApi.listEvents();
      setEvents(list);
      if (list.length > 0 && !selectedEventId) {
        setSelectedEventId(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load review events', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 2. Fetch Submissions for selected event
  const loadSubmissions = useCallback(async (eventId: string) => {
    try {
      const list = await reviewApi.listSubmissionsForEvent(eventId);
      setSubmissions(list);

      // Attempt to fetch leaderboard
      try {
        const rankingData = await reviewApi.getLeaderboard(eventId);
        setRanking(rankingData);
      } catch {
        setRanking(null);
      }
    } catch (err) {
      console.error('Failed to load submissions', err);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadSubmissions(selectedEventId);
    }
  }, [selectedEventId, loadSubmissions]);

  const selectedEvent = events.find((e) => e._id === selectedEventId) || null;

  // 3. One-Click: Run Full Evaluation Pipeline on All Submissions + Compute Relative Rankings
  const handleRunPipeline = async () => {
    if (!selectedEventId || submissions.length === 0) return;
    try {
      setPipelineRunning(true);
      const total = submissions.length;

      // Evaluate each submission sequentially
      for (let i = 0; i < total; i++) {
        const sub = submissions[i];
        setPipelineProgress({ current: i + 1, total, teamName: sub.teamName });
        try {
          await reviewApi.evaluateSubmission(sub._id);
        } catch (err) {
          console.error(`Evaluation failed for submission ${sub._id}:`, err);
        }
      }

      // After evaluating all, compute Bradley-Terry Relative Ranking
      setRankingLoading(true);
      const rankingRes = await reviewApi.computeRanking(selectedEventId);
      setRanking(rankingRes);

      // Reload fresh submissions list
      await loadSubmissions(selectedEventId);
      setActiveReportTab('RANKING');
    } catch (err) {
      console.error('Pipeline execution error', err);
    } finally {
      setPipelineRunning(false);
      setRankingLoading(false);
      setPipelineProgress(null);
    }
  };

  // Re-compute Bradley-Terry ranking only
  const handleComputeRankingOnly = async () => {
    if (!selectedEventId) return;
    try {
      setRankingLoading(true);
      const res = await reviewApi.computeRanking(selectedEventId);
      setRanking(res);
      setActiveReportTab('RANKING');
    } catch (err) {
      console.error('Failed to compute ranking', err);
    } finally {
      setRankingLoading(false);
    }
  };

  const handleRunSinglePipeline = async (submissionId: string, teamName: string) => {
    if (!selectedEventId) return;
    try {
      setPipelineRunning(true);
      setPipelineProgress({ current: 1, total: 1, teamName });
      await reviewApi.evaluateSubmission(submissionId);
      const rankingRes = await reviewApi.computeRanking(selectedEventId);
      setRanking(rankingRes);
      await loadSubmissions(selectedEventId);
    } catch (err) {
      console.error('Failed to evaluate submission', err);
      alert('Evaluation failed. Please try again.');
    } finally {
      setPipelineRunning(false);
      setPipelineProgress(null);
    }
  };

  const handleDeleteSubmission = async (submissionId: string, teamName: string) => {
    if (!window.confirm(`Delete submission for "${teamName}"?`)) return;
    try {
      await reviewApi.deleteSubmission(submissionId);
      if (selectedEventId) {
        await loadSubmissions(selectedEventId);
      }
    } catch (err) {
      console.error('Failed to delete submission', err);
      alert('Failed to delete submission');
    }
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'FRONTEND':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
            <Layout className="w-3 h-3" /> Frontend
          </span>
        );
      case 'BACKEND':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
            <Server className="w-3 h-3" /> Backend
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-purple-950 text-purple-300 border border-purple-800">
            <Layers className="w-3 h-3" /> Fullstack
          </span>
        );
    }
  };

  const submissionUrl = selectedEvent
    ? `${window.location.origin}/review/submit/${selectedEvent._id}`
    : '';

  const handleCopyLink = () => {
    if (!submissionUrl) return;
    navigator.clipboard.writeText(submissionUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const evaluatedCount = submissions.filter(
    (s) => s.status === 'EVALUATED' || s.status === 'FLAGGED_FOR_REVIEW'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">
                Project Review & Ranking Engine
              </h1>
              <p className="text-[11px] text-slate-400 mt-1">
                Prompt-Injection Defense • Concrete Tool Audits • Bradley-Terry Ranking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateEventOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
            >
              <Plus className="w-4 h-4" /> Create Event
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Step 1: Active Event Selector & Overview */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-2">
                1. Select or Create Event
              </span>
              <div className="flex items-center gap-2.5 flex-wrap">
                {events.length === 0 && !loading && (
                  <p className="text-sm text-slate-400">
                    No events found. Click &quot;Create Event&quot; above to set up dynamic
                    criteria.
                  </p>
                )}
                {events.map((evt) => (
                  <button
                    key={evt._id}
                    onClick={() => setSelectedEventId(evt._id)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-2 ${
                      evt._id === selectedEventId
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{evt.name}</span>
                    {getScopeBadge(evt.projectType)}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            {selectedEvent && (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsEditEventOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Edit Event
                </button>
                <button
                  onClick={() => setIsSubmitModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-emerald-400" /> Fast Submit
                </button>
                <button
                  onClick={handleRunPipeline}
                  disabled={pipelineRunning || submissions.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                >
                  {pipelineRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>
                        Running Pipeline ({pipelineProgress?.current || 0}/
                        {pipelineProgress?.total || submissions.length})...
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current text-white" />
                      <span>Run Pipeline on All Submissions</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Submission Form URL Banner (Step 2) */}
          {selectedEvent && (
            <div className="p-4 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-purple-950/30 border border-indigo-800/40 rounded-xl space-y-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      2. Public Candidate Submission Form
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
                      Adaptive ({selectedEvent.projectType})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Share this direct link with candidate teams. Inputs automatically adapt to{' '}
                    {selectedEvent.projectType.toLowerCase()} criteria.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 max-w-sm truncate select-all">
                    {submissionUrl}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={submissionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                    title="Open submission form in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Event Details Grid */}
          {selectedEvent && (
            <div className="pt-2 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Problem Statement:</span>
                <p className="text-slate-200 line-clamp-2">{selectedEvent.problemStatement}</p>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">
                  Dynamic Rubric ({selectedEvent.criteria.length} Criteria):
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedEvent.criteria.map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 font-mono text-[10px]"
                    >
                      {c.name} ({Math.round(c.weight * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Pipeline Status:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-medium">
                    {evaluatedCount} of {submissions.length} Evaluated
                  </span>
                  {ranking && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-semibold">
                      Ranking Computed
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Final Reports & Relative Ranking */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                3. Final Reports & Results
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {submissions.length} Projects
              </span>
            </div>

            {/* Sub-tab Switcher */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveReportTab('RANKING')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition ${
                  activeReportTab === 'RANKING'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Relative Rankings
              </button>
              <button
                onClick={() => setActiveReportTab('SCORECARDS')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition ${
                  activeReportTab === 'SCORECARDS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-300" />
                Project Scorecards
              </button>
              <button
                onClick={() => setActiveReportTab('REPLAY')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition ${
                  activeReportTab === 'REPLAY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5 text-emerald-400" />
                Replayable Links
              </button>
            </div>
          </div>

          {/* VIEW A: Bradley-Terry Relative Ranking Leaderboard */}
          {activeReportTab === 'RANKING' && (
            <div className="space-y-4">
              {!ranking ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <Trophy className="w-12 h-12 text-slate-700 mx-auto" />
                  <h3 className="text-base font-bold text-white">No Ranking Computed Yet</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click &quot;Run Pipeline on All Submissions&quot; above to run the
                    prompt-injection defense, tool analyzers, AI rubric scoring, and Bradley-Terry
                    MLE solver.
                  </p>
                  {submissions.length >= 2 && (
                    <button
                      onClick={handleComputeRankingOnly}
                      disabled={rankingLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition"
                    >
                      {rankingLoading
                        ? 'Computing Ratings...'
                        : 'Calculate Bradley-Terry Ratings Now'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <h3 className="text-base font-bold text-white">
                          Bradley-Terry Maximum Likelihood Leaderboard
                        </h3>
                        <span className="text-[10px] px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-full font-mono">
                          {ranking.totalPairwiseMatches} Pairwise Matches Solved
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Projects ranked by calibrated latent skill parameter \( \lambda_i \) from
                        automated head-to-head simulations.
                      </p>
                    </div>

                    <button
                      onClick={handleComputeRankingOnly}
                      disabled={rankingLoading}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 self-start sm:self-center"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${rankingLoading ? 'animate-spin' : ''}`}
                      />
                      Recalibrate
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Rank</th>
                          <th className="py-3 px-4">Team</th>
                          <th className="py-3 px-4">Latent Skill Rating</th>
                          <th className="py-3 px-4">Pairwise Win Rate</th>
                          <th className="py-3 px-4">Absolute Score</th>
                          <th className="py-3 px-4">Anomaly Flag</th>
                          <th className="py-3 px-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 font-mono">
                        {ranking.leaderboard.map((entry) => (
                          <tr key={entry.submissionId} className="hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-bold text-base">
                              {entry.rank === 1 && <span className="text-amber-400">🥇 #1</span>}
                              {entry.rank === 2 && <span className="text-slate-300">🥈 #2</span>}
                              {entry.rank === 3 && <span className="text-amber-700">🥉 #3</span>}
                              {entry.rank > 3 && (
                                <span className="text-slate-500 font-normal">#{entry.rank}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-sans">
                              <span className="font-semibold text-white block">
                                {entry.teamName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {entry.submissionId}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-indigo-300 font-bold text-sm">
                              {entry.latentSkillScore}
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {(entry.winRate * 100).toFixed(1)}%
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {entry.absoluteScore}/100
                            </td>
                            <td className="py-3.5 px-4">
                              {entry.discrepancyAnomalyFlag ? (
                                <span className="text-[10px] px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded font-bold flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-3 h-3" /> DISCREPANCY
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 rounded flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" /> Normal
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              <button
                                onClick={() => {
                                  setInspectSubmissionId(entry.submissionId);
                                  setDetailInitialTab('SCORECARD');
                                }}
                                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded text-xs transition"
                              >
                                View Scorecard
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW B: Project Scorecards & Tool Citations */}
          {activeReportTab === 'SCORECARDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.length === 0 ? (
                <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  No submissions yet. Share the submission link to collect candidate projects.
                </div>
              ) : (
                submissions.map((sub) => (
                  <div
                    key={sub._id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl space-y-4 transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">{sub.teamName}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                              {sub.teamId}
                            </span>
                          </div>
                          <a
                            href={sub.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-mono mt-1"
                          >
                            <span>{sub.repositoryUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Injection Defense Status Badge */}
                        {sub.status === 'SUBMITTED' ? (
                          <span className="text-[11px] px-2.5 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full font-medium flex items-center gap-1 shadow-sm">
                            <Clock className="w-3.5 h-3.5" /> PENDING EVALUATION
                          </span>
                        ) : sub.flaggedForHumanReview ? (
                          <span className="text-[11px] px-2.5 py-1 bg-red-950 text-red-300 border border-red-800 rounded-full font-bold flex items-center gap-1 shadow-sm">
                            <ShieldAlert className="w-3.5 h-3.5" /> INJECTION FLAGGED
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full font-semibold flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5" /> DEFENSE CLEAN
                          </span>
                        )}
                      </div>

                      {/* Scope & Links Details */}
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 font-mono">
                        {sub.liveSiteUrl && (
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                            Live: {sub.liveSiteUrl.replace(/^https?:\/\//, '')}
                          </span>
                        )}
                        {sub.apiSpecUrl && (
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                            API: OpenAPI Spec
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                        <span className="text-xs font-semibold text-indigo-300 font-mono">
                          {sub.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingSubmission(sub)}
                          title="Edit Submission"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubmission(sub._id, sub.teamName)}
                          title="Delete Submission"
                          className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {sub.status === 'SUBMITTED' ? (
                          <button
                            onClick={() => handleRunSinglePipeline(sub._id, sub.teamName)}
                            disabled={pipelineRunning}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
                          >
                            <Play className="w-3 h-3" /> Run Pipeline
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setInspectSubmissionId(sub._id);
                                setDetailInitialTab('REPLAY');
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                            >
                              <History className="w-3.5 h-3.5 text-emerald-400" /> Replay
                            </button>
                            <button
                              onClick={() => {
                                setInspectSubmissionId(sub._id);
                                setDetailInitialTab('SCORECARD');
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1"
                            >
                              Inspect Full Report <ArrowRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW C: Replayable Links & Verifiable Audit Trail */}
          {activeReportTab === 'REPLAY' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Verifiable Evaluation Replay Traces (§20)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Every pipeline run produces a deterministic replay trace containing sha256 input
                  hashes, exact prompt templates, temperature=0 LLM outputs, and sandbox logs.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-4">Pipeline Status</th>
                      <th className="py-3 px-4">Replayable Action</th>
                      <th className="py-3 px-4 text-right">Trace Viewer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {submissions.map((sub) => (
                      <tr key={sub._id} className="hover:bg-slate-800/30">
                        <td className="py-3.5 px-4 font-sans font-semibold text-white">
                          <div>
                            <span>{sub.teamName}</span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {sub.teamId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                            {sub.status}
                          </span>
                        </td>
                        {sub.status === 'SUBMITTED' ? (
                          <>
                            <td className="py-3.5 px-4 text-slate-500 italic text-[11px]">
                              Awaiting pipeline run
                            </td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              <button
                                onClick={() => handleRunSinglePipeline(sub._id, sub.teamName)}
                                disabled={pipelineRunning}
                                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-lg text-xs transition inline-flex items-center gap-1.5 ml-auto font-semibold"
                              >
                                <Play className="w-3 h-3" /> Run Pipeline
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 px-4 text-indigo-400">
                              <button
                                onClick={() => {
                                  const replayUrl = `${window.location.origin}/api/review/submissions/${sub._id}/replay`;
                                  navigator.clipboard.writeText(replayUrl);
                                  alert(`Copied replay trace API link:\n${replayUrl}`);
                                }}
                                className="text-xs hover:underline flex items-center gap-1 font-mono text-indigo-300"
                              >
                                <Copy className="w-3 h-3" /> Copy API Replay Link
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              <button
                                onClick={() => {
                                  setInspectSubmissionId(sub._id);
                                  setDetailInitialTab('REPLAY');
                                }}
                                className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ml-auto"
                              >
                                <History className="w-3.5 h-3.5" />
                                View Step-by-Step Replay
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateEventModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onCreated={() => loadEvents()}
      />

      <EditEventModal
        isOpen={isEditEventOpen}
        event={selectedEvent}
        onClose={() => setIsEditEventOpen(false)}
        onUpdated={() => {
          loadEvents();
          if (selectedEventId) loadSubmissions(selectedEventId);
        }}
      />

      <AdaptiveSubmissionModal
        isOpen={isSubmitModalOpen}
        event={selectedEvent}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmitted={() => {
          if (selectedEventId) loadSubmissions(selectedEventId);
        }}
      />

      <EditSubmissionModal
        isOpen={!!editingSubmission}
        submission={editingSubmission}
        event={selectedEvent}
        onClose={() => setEditingSubmission(null)}
        onUpdated={() => {
          if (selectedEventId) loadSubmissions(selectedEventId);
        }}
      />

      <SubmissionDetailModal
        submissionId={inspectSubmissionId}
        initialTab={detailInitialTab}
        onClose={() => setInspectSubmissionId(null)}
        onUpdated={() => {
          if (selectedEventId) loadSubmissions(selectedEventId);
        }}
      />
    </div>
  );
};

export default ReviewDashboard;

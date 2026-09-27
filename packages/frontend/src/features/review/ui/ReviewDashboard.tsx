import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import {
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
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  FileText,
  History,
  Trash2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Grid,
  Scale,
  TrendingUp,
  HelpCircle,
  Download
} from 'lucide-react';
import { ReviewEvent, ReviewSubmission, EventRanking, HeadToHead } from '../types';
import { reviewApi } from '../api/reviewApi';
import { PageHeader } from '../../../shared/layout/PageHeader';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { Tabs } from '../../../shared/ui/Tabs';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { CreateEventModal } from './CreateEventModal';
import { EditEventModal } from './EditEventModal';
import { AdaptiveSubmissionModal } from './AdaptiveSubmissionModal';
import { EditSubmissionModal } from './EditSubmissionModal';
import { SubmissionDetailModal } from './SubmissionDetailModal';
import { NotionExportModal } from './NotionExportModal';

type MatrixData = {
  comparisonMatrix: Array<{
    dimension: string;
    dimensionName: string;
    scores: Record<string, number>;
  }>;
  closeRankingBoundaries?: Array<{
    subAId: string;
    subBId: string;
    subAName: string;
    subBName: string;
    scoreDelta: number;
    boundaryReason: string;
  }>;
};

// server state lives in the TanStack Query cache (keyed per event); UI state stays in useState
const reviewKeys = {
  events: ['review', 'events'] as const,
  submissions: (id: string | null) => ['review', 'submissions', id] as const,
  ranking: (id: string | null) => ['review', 'ranking', id] as const,
  matrix: (id: string | null) => ['review', 'matrix', id] as const
};

export const ReviewDashboard: React.FC = () => {
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const eventsQuery = useQuery({ queryKey: reviewKeys.events, queryFn: reviewApi.listEvents });
  const events: ReviewEvent[] = eventsQuery.data || [];
  const loading = eventsQuery.isLoading;
  const submissions: ReviewSubmission[] =
    useQuery({
      queryKey: reviewKeys.submissions(selectedEventId),
      queryFn: () => reviewApi.listSubmissionsForEvent(selectedEventId!),
      enabled: Boolean(selectedEventId)
    }).data || [];
  // no leaderboard / matrix until the event has been ranked: a 404 just means "not yet"
  const ranking: EventRanking | null =
    useQuery({
      queryKey: reviewKeys.ranking(selectedEventId),
      queryFn: () => reviewApi.getLeaderboard(selectedEventId!).catch(() => null),
      enabled: Boolean(selectedEventId)
    }).data ?? null;
  const comparisonMatrixData: MatrixData | null =
    useQuery({
      queryKey: reviewKeys.matrix(selectedEventId),
      queryFn: () => reviewApi.getComparisonMatrix(selectedEventId!).catch(() => null),
      enabled: Boolean(selectedEventId)
    }).data ?? null;
  const [rankingLoading, setRankingLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<{
    current: number;
    total: number;
    teamName: string;
  } | null>(null);

  // Expanded comparative details per submission in the leaderboard
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});

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
  const [activeReportTab, setActiveReportTab] = useState<
    'RANKING' | 'MATRIX' | 'SCORECARDS' | 'REPLAY'
  >('RANKING');
  const [isNotionModalOpen, setIsNotionModalOpen] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  const toggleExpanded = (submissionId: string) => {
    setExpandedSubmissions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };

  // first event is selected by default once the list arrives
  useEffect(() => {
    if (!selectedEventId && events.length) setSelectedEventId(events[0]._id);
  }, [events, selectedEventId]);

  const loadEvents = () => qc.invalidateQueries({ queryKey: reviewKeys.events });
  // submissions, leaderboard and matrix of one event, refetched together
  const loadSubmissions = (eventId: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: reviewKeys.submissions(eventId) }),
      qc.invalidateQueries({ queryKey: reviewKeys.ranking(eventId) }),
      qc.invalidateQueries({ queryKey: reviewKeys.matrix(eventId) })
    ]);

  const selectedEvent = events.find((e) => e._id === selectedEventId) || null;

  // 3. Run Full Evaluation Pipeline on All Submissions: the server evaluates them in parallel
  // and ranks once at the end; we poll until every submission and the ranking have been refreshed
  const handleRunPipeline = async () => {
    if (!selectedEventId || submissions.length === 0) return;
    const eventId = selectedEventId;
    // compare against pre-run snapshots (not timestamps) so browser/server clock skew can't matter
    const before = new Map(submissions.map((s) => [s._id, s.updatedAt]));
    const rankedBefore = ranking?.generatedAt;
    const terminal = ['EVALUATED', 'FAILED', 'FLAGGED_FOR_REVIEW'];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      setPipelineRunning(true);
      const { concurrency } = await reviewApi.evaluateEvent(eventId);
      let allDoneAt = 0;
      // ponytail: plain polling; swap for SSE if many trainers watch runs at once
      for (const deadline = Date.now() + 60 * 60_000; Date.now() < deadline;) {
        await sleep(4000);
        const list = await reviewApi.listSubmissionsForEvent(eventId);
        qc.setQueryData(reviewKeys.submissions(eventId), list);
        const done = list.filter(
          (s) => terminal.includes(s.status) && s.updatedAt !== before.get(s._id)
        ).length;
        const allDone = done >= list.length;
        setPipelineProgress({
          current: done,
          total: list.length,
          teamName: allDone ? 'writing head-to-head verdicts…' : `${concurrency} in parallel`
        });
        if (!allDone) continue;
        allDoneAt ||= Date.now();
        const rk = await reviewApi.getLeaderboard(eventId).catch(() => null);
        // ranking can fail (e.g. every submission failed): give it 3 minutes, then stop waiting
        if ((rk && rk.generatedAt !== rankedBefore) || Date.now() - allDoneAt > 3 * 60_000) break;
      }
      await loadSubmissions(eventId);
      setActiveReportTab('RANKING');
    } catch (err) {
      console.error('Pipeline execution error', err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to start the evaluation pipeline.');
    } finally {
      setPipelineRunning(false);
      setPipelineProgress(null);
    }
  };

  const handleTogglePublish = async () => {
    if (!selectedEvent) return;
    const publish = !selectedEvent.resultsPublished;
    if (
      publish &&
      !window.confirm(
        'Publish results? Students will see their scores, rank and detailed feedback. Review any close calls and copy flags first.'
      )
    )
      return;
    try {
      await reviewApi.updateEvent(selectedEvent._id, { resultsPublished: publish });
      await loadEvents();
    } catch (err) {
      console.error('Failed to change results visibility', err);
      alert('Could not change results visibility. Please try again.');
    }
  };

  // Re-compute Bradley-Terry ranking & refresh comparison matrix
  const handleComputeRankingOnly = async () => {
    if (!selectedEventId) return;
    try {
      setRankingLoading(true);
      const res = await reviewApi.computeRanking(selectedEventId);
      qc.setQueryData(reviewKeys.ranking(selectedEventId), res);
      await loadSubmissions(selectedEventId);
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
      qc.setQueryData(reviewKeys.ranking(selectedEventId), rankingRes);
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
    }
  };

  const handleExportEventCsv = async () => {
    if (!selectedEventId) return;
    try {
      setCsvExporting(true);
      await reviewApi.downloadEventCsv(selectedEventId, selectedEvent?.name || 'event');
    } catch (err) {
      console.error('Failed to export event CSV', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setCsvExporting(false);
    }
  };

  const getScopeBadge = (scope: ReviewEvent['projectType']) => {
    switch (scope) {
      case 'FRONTEND':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Layout className="w-3 h-3" /> Frontend
          </span>
        );
      case 'BACKEND':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Server className="w-3 h-3" /> Backend
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-zinc-50 text-zinc-700 border border-zinc-200">
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

  const reportTabs = [
    { id: 'RANKING', label: 'Rankings', icon: <Trophy className="h-3.5 w-3.5" /> },
    { id: 'MATRIX', label: 'Compare', icon: <Grid className="h-3.5 w-3.5" /> },
    { id: 'SCORECARDS', label: 'Scorecards', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'REPLAY', label: 'Traces', icon: <History className="h-3.5 w-3.5" /> }
  ];
  const evalPct = submissions.length ? (evaluatedCount / submissions.length) * 100 : 0;

  return (
    <div className="min-h-shell">
      <main className="page space-y-6 py-6 sm:py-8">
        <PageHeader
          eyebrow="Project reviews"
          title="Evaluation pipeline"
          description="AI-assisted code review with tool-backed evidence and Bradley–Terry relative ranking."
          actions={
            <Button onClick={() => setIsCreateEventOpen(true)}>
              <Plus className="h-4 w-4" /> New event
            </Button>
          }
        />

        {/* event picker */}
        {events.length === 0 && !loading ? (
          <EmptyState
            icon={<Trophy />}
            title="No review events yet"
            description="Create an event with a rubric, share the submission link, then run the pipeline."
            action={
              <Button onClick={() => setIsCreateEventOpen(true)}>
                <Plus className="h-4 w-4" /> Create first event
              </Button>
            }
          />
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {events.map((evt) => {
              const active = evt._id === selectedEventId;
              return (
                <button
                  key={evt._id}
                  onClick={() => setSelectedEventId(evt._id)}
                  className={`flex min-w-[200px] max-w-[280px] shrink-0 flex-col items-start gap-2 rounded-2xl p-3.5 text-left transition sm:min-w-0 ${
                    active
                      ? 'bg-ink text-white shadow-lift'
                      : 'bg-white text-zinc-800 shadow-card hover:shadow-lift'
                  }`}
                >
                  <span className="w-full truncate text-sm font-medium">{evt.name}</span>
                  <span className="flex items-center gap-2">
                    {getScopeBadge(evt.projectType)}
                    <span className={`text-[11px] ${active ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {evt.criteria.length} criteria
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selectedEvent ? (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* overview */}
            <div className="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-card sm:p-5 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold tracking-tight text-zinc-900">
                    {selectedEvent.name}
                  </h2>
                  <p className="mt-1 line-clamp-3 text-sm text-zinc-500">
                    {selectedEvent.problemStatement}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsEditEventOpen(true)}>
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {/* students see scores and feedback only after this */}
                  <Button
                    size="sm"
                    variant={selectedEvent.resultsPublished ? 'outline' : 'primary'}
                    onClick={handleTogglePublish}
                    title={
                      selectedEvent.resultsPublished
                        ? 'Hide scores and feedback from students again'
                        : 'Let students see their scores, rank and detailed feedback'
                    }
                  >
                    {selectedEvent.resultsPublished ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Unpublish results
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Publish results
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsSubmitModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add submission
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedEvent.criteria.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-lg bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 ring-1 ring-inset ring-zinc-200/70"
                  >
                    {c.name}{' '}
                    <span className="tabular-nums text-zinc-400">
                      {Math.round(c.weight * 100)}%
                    </span>
                  </span>
                ))}
              </div>

              {/* share link */}
              <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200/70">
                <p className="mb-2 text-xs font-medium text-zinc-600">
                  Submission link for participants
                </p>
                <div className="flex flex-col gap-2 xs:flex-row">
                  <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200">
                    {submissionUrl}
                  </code>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={copiedLink ? 'secondary' : 'primary'}
                      onClick={handleCopyLink}
                      className="h-9 flex-1 xs:flex-none"
                    >
                      {copiedLink ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedLink ? 'Copied' : 'Copy'}
                    </Button>
                    <a
                      href={submissionUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open submission form"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* pipeline */}
            <div className="flex min-w-0 flex-col rounded-2xl bg-ink p-4 text-white shadow-lift sm:p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Pipeline</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {evaluatedCount}
                <span className="text-lg text-zinc-500">/{submissions.length}</span>
              </p>
              <p className="text-sm text-zinc-400">submissions evaluated</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-zinc-900 transition-[width] duration-700"
                  style={{ width: `${evalPct}%` }}
                />
              </div>
              {ranking ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Rankings computed
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                <Button
                  onClick={handleRunPipeline}
                  disabled={pipelineRunning || submissions.length === 0}
                  className="w-full bg-white text-zinc-900 hover:bg-zinc-100"
                >
                  {pipelineRunning ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="truncate">
                        {pipelineProgress?.current || 0}/
                        {pipelineProgress?.total || submissions.length} ·{' '}
                        {pipelineProgress?.teamName}
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" /> Run on all submissions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {/* results */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900">Results</h2>
              <Badge variant="gray">{submissions.length} submissions</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Tabs
                variant="pill"
                tabs={reportTabs}
                activeTab={activeReportTab}
                onChange={(id) => setActiveReportTab(id as typeof activeReportTab)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportEventCsv}
                  disabled={csvExporting || submissions.length === 0}
                  isLoading={csvExporting}
                >
                  {!csvExporting ? <Download className="h-3.5 w-3.5" /> : null} CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsNotionModalOpen(true)}
                  disabled={submissions.length === 0}
                >
                  <span className="font-serif text-xs font-bold">N</span> Notion
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComputeRankingOnly}
                  disabled={rankingLoading || submissions.length === 0}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${rankingLoading ? 'animate-spin' : ''}`} />{' '}
                  Recalibrate
                </Button>
              </div>
            </div>
          </div>

          {/* VIEW A: Bradley-Terry Relative Ranking Leaderboard */}
          {activeReportTab === 'RANKING' && (
            <div className="space-y-4">
              {!!ranking?.similarityFlags?.length && (
                <div className="bg-white p-4 rounded-2xl border border-amber-300 shadow-sm space-y-2">
                  <p className="text-sm font-bold text-amber-800">
                    Possible copying: {ranking.similarityFlags.length} pair(s) to review
                  </p>
                  {ranking.similarityFlags.map((f, i) => (
                    <div key={i} className="text-xs text-zinc-700">
                      <span className="font-semibold">
                        {f.subAName} &amp; {f.subBName}
                      </span>{' '}
                      ({Math.round(f.similarity * 100)}%): {f.reason}
                      {f.sharedExamples.length > 0 && (
                        <span className="block font-mono text-[11px] text-zinc-500">
                          e.g. {f.sharedExamples.slice(0, 2).join(' | ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!ranking ? (
                <div className="bg-white rounded-2xl shadow-card p-4 sm:p-6 sm:p-12 text-center space-y-3">
                  <Trophy className="w-12 h-12 text-zinc-300 mx-auto" />
                  <h3 className="text-base font-bold text-zinc-900">No Ranking Computed Yet</h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    Click &quot;Run Pipeline on All Submissions&quot; above to run the automated
                    discovery, tool analyzers, AI rubric scoring, and Bradley-Terry ranking solver.
                  </p>
                  {submissions.length >= 2 && (
                    <button
                      onClick={handleComputeRankingOnly}
                      disabled={rankingLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      {rankingLoading
                        ? 'Computing Ratings...'
                        : 'Calculate Bradley-Terry Ratings Now'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Leaderboard Card Container */}
                  <div className="bg-white rounded-2xl shadow-card overflow-hidden p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <h3 className="text-base font-semibold text-zinc-900">
                            Bradley-Terry Calibrated Leaderboard
                          </h3>
                          <span className="text-[10px] px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-semibold">
                            {ranking.totalPairwiseMatches} Pairwise Matches Solved
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          Projects ranked by calibrated latent skill parameter &lambda; from
                          automated head-to-head simulations.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-semibold border-b border-zinc-200">
                          <tr>
                            <th className="py-3 px-4">Rank</th>
                            <th className="py-3 px-4">Team</th>
                            <th className="py-3 px-4">Latent Skill</th>
                            <th className="py-3 px-4">Win Rate</th>
                            <th className="py-3 px-4">Calibrated Score</th>
                            <th className="py-3 px-4">Confidence</th>
                            <th className="py-3 px-4">Audit Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {ranking.leaderboard.map((entry) => {
                            const isExpanded = !!expandedSubmissions[entry.submissionId];
                            const why = entry.whyAmIExplanation;
                            const rel = entry.relativeAnalysis;
                            const grading = entry.relativeGrading;

                            return (
                              <React.Fragment key={entry.submissionId}>
                                <tr className="hover:bg-zinc-50/60 transition-colors">
                                  <td className="py-3.5 px-4 font-bold text-base">
                                    {entry.rank === 1 && (
                                      <span className="text-amber-500 flex items-center gap-1">
                                        🥇 #1
                                      </span>
                                    )}
                                    {entry.rank === 2 && (
                                      <span className="text-zinc-600 flex items-center gap-1">
                                        🥈 #2
                                      </span>
                                    )}
                                    {entry.rank === 3 && (
                                      <span className="text-amber-700 flex items-center gap-1">
                                        🥉 #3
                                      </span>
                                    )}
                                    {entry.rank > 3 && (
                                      <span className="text-zinc-400 font-normal">
                                        #{entry.rank}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="font-bold text-zinc-900 block text-sm">
                                      {entry.teamName}
                                    </span>
                                    <span className="text-[11px] text-zinc-400 font-mono">
                                      {entry.submissionId}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-blue-600 font-black text-sm">
                                    {Number(entry.latentSkillScore).toFixed(2)}
                                  </td>
                                  <td className="py-3.5 px-4 text-zinc-700 font-medium">
                                    {(entry.winRate * 100).toFixed(1)}%
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="text-zinc-900 font-bold text-sm block">
                                      {(entry.absoluteScore / 10).toFixed(2)} / 10
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-mono">
                                      {entry.absoluteScore} / 100
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                      {why?.confidenceScore || 92}%
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    {entry.discrepancyAnomalyFlag ? (
                                      <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-semibold flex items-center gap-1 w-fit">
                                        <AlertTriangle className="w-3 h-3" /> DISCREPANCY
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold flex items-center gap-1 w-fit">
                                        <CheckCircle2 className="w-3 h-3" /> Normal
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => toggleExpanded(entry.submissionId)}
                                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Toggle comparative details"
                                      >
                                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Why #{entry.rank}?</span>
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setInspectSubmissionId(entry.submissionId);
                                          setDetailInitialTab('SCORECARD');
                                        }}
                                        className="px-3 py-1 bg-white hover:bg-zinc-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                                      >
                                        Scorecard
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Expandable Relative Analysis Drawer */}
                                {isExpanded && (
                                  <tr className="bg-zinc-50/70 border-b border-zinc-200">
                                    <td colSpan={8} className="p-5">
                                      <div className="space-y-4 max-w-5xl">
                                        {/* §18 "Why Am I #X?" Transparent Explanation Card */}
                                        {why && (
                                          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2 flex-wrap border-b border-zinc-100 pb-2.5">
                                              <div className="flex items-center gap-2">
                                                <HelpCircle className="w-4 h-4 text-amber-500" />
                                                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                                                  Why Am I #{entry.rank}? (Relative Engineering
                                                  Explanation)
                                                </span>
                                              </div>
                                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                                Confidence: {why.confidenceScore}% &bull;
                                                Calibrated: {(why.score / 10).toFixed(2)}/10
                                              </span>
                                            </div>
                                            <p className="text-xs text-zinc-700 font-medium leading-relaxed bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                                              {why.whyThisRankHeadline}
                                            </p>

                                            {/* Ranked Below Previous */}
                                            {why.whyRankedAboveBelow?.rankedBelowPrevious && (
                                              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                                                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                                                  <span>
                                                    What #{entry.rank - 1} (
                                                    {
                                                      why.whyRankedAboveBelow.rankedBelowPrevious
                                                        .targetTeamName
                                                    }
                                                    ) Did Better:
                                                  </span>
                                                </div>
                                                <p className="text-xs text-zinc-700">
                                                  {
                                                    why.whyRankedAboveBelow.rankedBelowPrevious
                                                      .reason
                                                  }
                                                </p>
                                                {why.whyRankedAboveBelow.rankedBelowPrevious
                                                  .keyDeficits.length > 0 && (
                                                  <div>
                                                    <span className="text-[10px] uppercase font-bold text-rose-700 block mb-1">
                                                      Concrete Deficits in Your Codebase:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                      {why.whyRankedAboveBelow.rankedBelowPrevious.keyDeficits.map(
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
                                                {why.whyRankedAboveBelow.rankedBelowPrevious
                                                  .higherRankedAdvantages.length > 0 && (
                                                  <div className="pt-1">
                                                    <span className="text-[10px] uppercase font-bold text-zinc-600 block mb-1">
                                                      Their Competitive Advantages:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                      {why.whyRankedAboveBelow.rankedBelowPrevious.higherRankedAdvantages.map(
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
                                            {why.whyRankedAboveBelow?.rankedAboveNext && (
                                              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                                                  <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                                                  <span>
                                                    Competitive Lead over #{entry.rank + 1} (
                                                    {
                                                      why.whyRankedAboveBelow.rankedAboveNext
                                                        .targetTeamName
                                                    }
                                                    ):
                                                  </span>
                                                </div>
                                                <p className="text-xs text-zinc-700">
                                                  {why.whyRankedAboveBelow.rankedAboveNext.reason}
                                                </p>
                                                {why.whyRankedAboveBelow.rankedAboveNext
                                                  .keyAdvantages.length > 0 && (
                                                  <div className="flex flex-wrap gap-1.5">
                                                    {why.whyRankedAboveBelow.rankedAboveNext.keyAdvantages.map(
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

                                            {/* Comparison with Champion (#1) */}
                                            {why.comparisonWithChampion && entry.rank > 1 && (
                                              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                                                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                                  <div className="flex items-center gap-1.5">
                                                    <Trophy className="w-4 h-4 text-amber-500" />
                                                    <span>
                                                      Comparison with Champion (
                                                      {why.comparisonWithChampion.championTeamName})
                                                    </span>
                                                  </div>
                                                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                                    Champion Score:{' '}
                                                    {(
                                                      why.comparisonWithChampion.championScore / 10
                                                    ).toFixed(2)}
                                                    /10
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1">
                                                    <span className="text-[10px] font-bold uppercase text-amber-800 block">
                                                      Where Champion Excelled:
                                                    </span>
                                                    <ul className="space-y-1 text-zinc-700 text-[11px]">
                                                      {why.comparisonWithChampion.championKeyStrengths.map(
                                                        (s, idx) => (
                                                          <li
                                                            key={idx}
                                                            className="flex items-start gap-1.5"
                                                          >
                                                            <span className="text-amber-600 font-bold">
                                                              &bull;
                                                            </span>
                                                            <span>{s}</span>
                                                          </li>
                                                        )
                                                      )}
                                                    </ul>
                                                  </div>
                                                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1">
                                                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                                                      Your Counter-Advantages:
                                                    </span>
                                                    <ul className="space-y-1 text-zinc-700 text-[11px]">
                                                      {why.comparisonWithChampion.yourAdvantagesOverChampion.map(
                                                        (s, idx) => (
                                                          <li
                                                            key={idx}
                                                            className="flex items-start gap-1.5"
                                                          >
                                                            <span className="text-emerald-600 font-bold">
                                                              &check;
                                                            </span>
                                                            <span>{s}</span>
                                                          </li>
                                                        )
                                                      )}
                                                    </ul>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* High Impact Improvements (§19) */}
                                            {why.highestImpactImprovements &&
                                              why.highestImpactImprovements.length > 0 && (
                                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                                                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                                    <span>
                                                      Highest-Impact Improvement Roadmap (§19)
                                                    </span>
                                                  </div>
                                                  <div className="grid grid-cols-1 gap-2">
                                                    {why.highestImpactImprovements.map(
                                                      (imp, idx) => (
                                                        <div
                                                          key={idx}
                                                          className="p-2.5 bg-white border border-blue-200 rounded-lg text-xs space-y-1 shadow-sm"
                                                        >
                                                          <div className="flex items-center justify-between">
                                                            <span className="font-semibold text-zinc-900">
                                                              Priority #{idx + 1}
                                                            </span>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                                              High Score Impact
                                                            </span>
                                                          </div>
                                                          <p className="text-zinc-700 leading-snug">
                                                            {imp}
                                                          </p>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                        )}
                                        {/* Rank Reason & Cohort Placement */}
                                        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm space-y-2">
                                          <div className="flex flex-wrap items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                              <Award className="w-4 h-4 text-blue-600" />
                                              <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                                                Rank Evaluation Summary
                                              </span>
                                            </div>
                                            {grading && (
                                              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                                {grading.tierLabel} • {grading.percentile}th
                                                Percentile
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-zinc-700 font-medium">
                                            {entry.rankReason}
                                          </p>
                                          {grading && (
                                            <p className="text-xs text-zinc-500 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                                              {grading.whyTheseMarks}
                                            </p>
                                          )}
                                        </div>

                                        {entry.headToHead && (
                                          <HeadToHeadCard h={entry.headToHead} rank={entry.rank} />
                                        )}

                                        {/* Compared to Above (What to Improve to Rank Up) */}
                                        {rel?.comparedToAbove && (
                                          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm space-y-3">
                                            <div className="flex items-center gap-2">
                                              <ArrowUpRight className="w-4 h-4 text-rose-600" />
                                              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                                                What to Improve (Compared to Rank #
                                                {rel.comparedToAbove.targetRank} –{' '}
                                                {rel.comparedToAbove.targetTeamName})
                                              </h4>
                                              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 ml-auto">
                                                {rel.comparedToAbove.scoreDifference} pts Gap
                                              </span>
                                            </div>
                                            <p className="text-xs text-zinc-700">
                                              {rel.comparedToAbove.summary}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                              {rel.comparedToAbove.criteriaDeltas.map((delta) => (
                                                <div
                                                  key={delta.criterionId}
                                                  className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-1"
                                                >
                                                  <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-zinc-800">
                                                      {delta.criterionName}
                                                    </span>
                                                    <span className="text-rose-600 font-bold">
                                                      {delta.delta} pts
                                                    </span>
                                                  </div>
                                                  <p className="text-[11px] text-zinc-500 leading-snug">
                                                    {delta.feedback}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Compared to Below (Defending Rank) */}
                                        {rel?.comparedToBelow && (
                                          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm space-y-3">
                                            <div className="flex items-center gap-2">
                                              <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                                              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                                                Competitive Edge (Lead over Rank #
                                                {rel.comparedToBelow.targetRank} –{' '}
                                                {rel.comparedToBelow.targetTeamName})
                                              </h4>
                                              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 ml-auto">
                                                +{rel.comparedToBelow.scoreDifference} pts Lead
                                              </span>
                                            </div>
                                            <p className="text-xs text-zinc-700">
                                              {rel.comparedToBelow.summary}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                              {rel.comparedToBelow.criteriaDeltas.map((delta) => (
                                                <div
                                                  key={delta.criterionId}
                                                  className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-1"
                                                >
                                                  <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-zinc-800">
                                                      {delta.criterionName}
                                                    </span>
                                                    <span className="text-emerald-700 font-bold">
                                                      +{delta.delta} pts
                                                    </span>
                                                  </div>
                                                  <p className="text-[11px] text-zinc-500 leading-snug">
                                                    {delta.feedback}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Path to 100% & Industry Recommendations (for #1 Rank or leaders) */}
                                        {rel?.selfImprovement && (
                                          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3">
                                            <div className="flex items-center gap-2">
                                              <Target className="w-4 h-4 text-blue-600" />
                                              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                                                {rel.selfImprovement.title} (Gap:{' '}
                                                {rel.selfImprovement.gapPoints} pts)
                                              </h4>
                                            </div>
                                            <p className="text-xs text-zinc-700">
                                              {rel.selfImprovement.summary}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                              {rel.selfImprovement.recommendations.map((rec) => (
                                                <div
                                                  key={rec.criterionId}
                                                  className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-1"
                                                >
                                                  <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-zinc-800">
                                                      {rec.criterionName}
                                                    </span>
                                                    <span className="text-blue-600 font-bold">
                                                      {rec.currentScore}/100
                                                    </span>
                                                  </div>
                                                  <p className="text-[11px] text-zinc-500 leading-snug">
                                                    {rec.actionableSteps}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: 9-Dimension Comparison Matrix & Close Boundary Detection (§22) */}
          {activeReportTab === 'MATRIX' && (
            <div className="space-y-6">
              {/* Close Boundary Alert Banner (§16 & §22) */}
              {comparisonMatrixData?.closeRankingBoundaries &&
                comparisonMatrixData.closeRankingBoundaries.length > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <Scale className="w-4 h-4 text-amber-600" />
                      <span>Ranking Boundary Detection Active (§16 / §22)</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Close neighboring candidates (&Delta; &le; 5.0 pts) triggered automated
                      pairwise tie-breaker evaluation across all 9 engineering dimensions.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {comparisonMatrixData.closeRankingBoundaries.map((b, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-amber-200 rounded-lg text-xs space-y-1.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-900">
                              {b.subAName} <span className="text-zinc-400 font-normal">vs</span>{' '}
                              {b.subBName}
                            </span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200">
                              &Delta; {b.scoreDelta.toFixed(2)} pts
                            </span>
                          </div>
                          <p className="text-zinc-600 text-[11px] leading-snug">
                            {b.boundaryReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 9-Dimension Comparison Matrix Table */}
              <div className="bg-white rounded-2xl shadow-card overflow-hidden p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Grid className="w-5 h-5 text-zinc-600" />
                      <h3 className="text-base font-bold text-zinc-900">
                        9-Dimension Engineering Comparison Matrix (§22)
                      </h3>
                      <span className="text-[10px] px-2.5 py-0.5 bg-zinc-50 text-zinc-800 border border-zinc-200 rounded-full font-semibold">
                        Side-by-Side Multi-Project Analysis
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Compare all projects across every core engineering dimension with automated
                      dimension winner indicators.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                    <button
                      onClick={handleExportEventCsv}
                      disabled={csvExporting || submissions.length === 0}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                      title="Export full leaderboard, positive points, issues, improvements & 9-dimension scores to CSV"
                    >
                      <Download
                        className={`w-3.5 h-3.5 text-white ${csvExporting ? 'animate-bounce' : ''}`}
                      />
                      <span>{csvExporting ? 'Exporting...' : 'Export CSV'}</span>
                    </button>
                    <button
                      onClick={() => setIsNotionModalOpen(true)}
                      disabled={submissions.length === 0}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                      title="Export complete executive report to Notion"
                    >
                      <span className="font-serif font-black text-xs">N</span>
                      <span>Notion Final</span>
                    </button>
                    <button
                      onClick={handleComputeRankingOnly}
                      disabled={rankingLoading || submissions.length === 0}
                      className="px-3.5 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 rounded-lg text-xs font-semibold border border-zinc-200 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Recalibrate Bradley-Terry relative rankings"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${rankingLoading ? 'animate-spin text-blue-600' : ''}`}
                      />
                      <span>{rankingLoading ? 'Recalibrating...' : 'Recalibrate'}</span>
                    </button>
                  </div>
                </div>

                {!comparisonMatrixData || comparisonMatrixData.comparisonMatrix.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    No comparison matrix generated yet. Run the pipeline on submissions to view
                    dimension breakdowns.
                  </div>
                ) : (
                  (() => {
                    // `absoluteScore` is the canonical 9-dimension weighted composite computed by
                    // the ranking service. Recalculating it in the browser used a separate weight
                    // map and allowed the matrix total to disagree with the persisted leaderboard.
                    const matrixColumns = (ranking?.leaderboard || []).map((entry) => ({
                      ...entry,
                      calculatedScore: entry.absoluteScore
                    }));

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-semibold border-b border-zinc-200">
                            <tr>
                              <th className="py-3 px-4 font-bold text-zinc-700 min-w-[200px]">
                                Engineering Dimension
                              </th>
                              {matrixColumns.map((entry, idx) => (
                                <th
                                  key={entry.submissionId}
                                  className="py-3 px-4 text-center min-w-[140px]"
                                >
                                  <div className="flex flex-col items-center">
                                    <span className="font-bold text-zinc-900 text-xs">
                                      {entry.teamName}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold font-mono mt-0.5 bg-zinc-200/70 text-zinc-700">
                                      #{idx + 1} &bull; {(entry.calculatedScore / 10).toFixed(1)}/10
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 font-sans">
                            {comparisonMatrixData.comparisonMatrix.map((dim) => {
                              const allScores = matrixColumns.map((entry) => {
                                const sc =
                                  dim.scores[entry.teamName] ?? dim.scores[entry.submissionId] ?? 0;
                                return sc;
                              });
                              const maxScore = Math.max(...allScores, 0);

                              return (
                                <tr
                                  key={dim.dimension}
                                  className="hover:bg-zinc-50/60 transition-colors"
                                >
                                  <td className="py-3.5 px-4 font-semibold text-zinc-900">
                                    <div className="flex items-center gap-1.5">
                                      <span>{dim.dimensionName}</span>
                                    </div>
                                  </td>
                                  {matrixColumns.map((entry) => {
                                    const rawScore =
                                      dim.scores[entry.teamName] ??
                                      dim.scores[entry.submissionId] ??
                                      0;
                                    const isWinner = rawScore > 0 && rawScore === maxScore;
                                    const scoreOutOf10 = (rawScore / 10).toFixed(1);

                                    return (
                                      <td
                                        key={entry.submissionId}
                                        className="py-3.5 px-4 text-center"
                                      >
                                        <div className="inline-flex flex-col items-center gap-0.5">
                                          <span
                                            className={`px-3 py-1 rounded-lg font-mono font-bold text-xs border ${
                                              rawScore >= 80
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : rawScore >= 60
                                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                          >
                                            {scoreOutOf10} / 10
                                          </span>
                                          {isWinner && (
                                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 mt-0.5">
                                              👑 Top
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                            {/* Overall Score Row */}
                            <tr className="bg-zinc-50 font-bold border-t-2 border-zinc-200">
                              <td className="py-4 px-4 text-zinc-900 font-bold uppercase text-[11px]">
                                Overall Calibrated Score
                              </td>
                              {matrixColumns.map((entry) => (
                                <td key={entry.submissionId} className="py-4 px-4 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-blue-600 font-mono">
                                      {(entry.calculatedScore / 10).toFixed(2)} / 10
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-normal mt-0.5">
                                      {entry.calculatedScore.toFixed(1)} / 100
                                    </span>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* VIEW B: Project Scorecards & Tool Citations */}
          {activeReportTab === 'SCORECARDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.length === 0 ? (
                <div className="col-span-2 bg-white rounded-2xl shadow-card p-4 sm:p-6 sm:p-12 text-center text-zinc-500 shadow-sm">
                  No submissions yet. Share the submission link above to collect candidate projects.
                </div>
              ) : (
                submissions.map((sub) => (
                  <div
                    key={sub._id}
                    className="bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl p-5 shadow-sm space-y-4 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-zinc-900">{sub.teamName}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">
                              {sub.teamId}
                            </span>
                          </div>
                          <a
                            href={sub.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-mono mt-1"
                          >
                            <span>{sub.repositoryUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Defense Status Badge */}
                        {!['EVALUATED', 'FAILED', 'FLAGGED_FOR_REVIEW'].includes(sub.status) ? (
                          <span className="text-[11px] px-2.5 py-1 bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-full font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />{' '}
                            {sub.status === 'SUBMITTED'
                              ? 'PENDING EVALUATION'
                              : sub.status === 'QUEUED'
                                ? 'QUEUED'
                                : 'EVALUATING…'}
                          </span>
                        ) : sub.flaggedForHumanReview ? (
                          <span className="text-[11px] px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> INJECTION FLAGGED
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> DEFENSE CLEAN
                          </span>
                        )}
                      </div>

                      {/* Scope & Links Details */}
                      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 font-mono">
                        {sub.liveSiteUrl && (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700">
                            Live: {sub.liveSiteUrl.replace(/^https?:\/\//, '')}
                          </span>
                        )}
                        {sub.apiSpecUrl && (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700">
                            API: OpenAPI Spec
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                          Status
                        </span>
                        <span className="text-xs font-bold text-blue-600 font-mono">
                          {sub.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingSubmission(sub)}
                          title="Edit Submission"
                          className="p-2 bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubmission(sub._id, sub.teamName)}
                          title="Delete Submission"
                          className="p-2 bg-white hover:bg-rose-50 text-zinc-600 hover:text-rose-600 border border-zinc-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {sub.status === 'SUBMITTED' ? (
                          <button
                            onClick={() => handleRunSinglePipeline(sub._id, sub.teamName)}
                            disabled={pipelineRunning}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
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
                              className="px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 rounded-lg text-xs font-semibold border border-zinc-200 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5 text-emerald-600" /> Replay
                            </button>
                            <button
                              onClick={() => {
                                setInspectSubmissionId(sub._id);
                                setDetailInitialTab('SCORECARD');
                              }}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              Inspect Report <ArrowRight className="w-3 h-3" />
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
            <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-zinc-900">
                    Verifiable Evaluation Replay Traces (§20)
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Every pipeline run produces a deterministic replay trace containing input
                  snapshots, activity logs, exact scoring justifications, and timing breakdown.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-4">Pipeline Status</th>
                      <th className="py-3 px-4">Replayable API Link</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {submissions.map((sub) => (
                      <tr key={sub._id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-sans font-semibold text-zinc-900">
                          <div>
                            <span className="text-sm">{sub.teamName}</span>
                            <span className="block text-[10px] text-zinc-400 font-mono">
                              {sub.teamId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">
                            {sub.status}
                          </span>
                        </td>
                        {sub.status === 'SUBMITTED' ? (
                          <>
                            <td className="py-3.5 px-4 text-zinc-400 italic text-[11px] font-sans">
                              Awaiting pipeline run
                            </td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              <button
                                onClick={() => handleRunSinglePipeline(sub._id, sub.teamName)}
                                disabled={pipelineRunning}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5 ml-auto cursor-pointer"
                              >
                                <Play className="w-3 h-3" /> Run Pipeline
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => {
                                  const replayUrl = `${window.location.origin}/api/review/submissions/${sub._id}/replay`;
                                  navigator.clipboard.writeText(replayUrl);
                                  alert(`Copied replay trace API link:\n${replayUrl}`);
                                }}
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                              >
                                <Copy className="w-3 h-3" /> Copy API Link
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              <button
                                onClick={() => {
                                  setInspectSubmissionId(sub._id);
                                  setDetailInitialTab('REPLAY');
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-zinc-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                                View Step Replay
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
        formFields={selectedEvent?.formFields}
        initialTab={detailInitialTab}
        onClose={() => setInspectSubmissionId(null)}
        onUpdated={() => {
          if (selectedEventId) loadSubmissions(selectedEventId);
        }}
      />

      <NotionExportModal
        isOpen={isNotionModalOpen}
        onClose={() => setIsNotionModalOpen(false)}
        type="event"
        id={selectedEventId || ''}
        title={selectedEvent?.name || 'Event Final Report'}
      />
    </div>
  );
};

export default ReviewDashboard;

/** AI judge's evidence-cited answer to "why is this team not one place higher?" */
const HeadToHeadCard: React.FC<{ h: HeadToHead; rank: number }> = ({ h, rank }) => (
  <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
        Why #{rank} is not #{rank - 1} ({h.vsTeam})
      </span>
      {!h.agreesWithRanking ? (
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Judge picked {h.winnerTeam}: close call, review manually
        </span>
      ) : h.positionConsistent === false ? (
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Judge was not consistent: close call, review manually
        </span>
      ) : h.positionConsistent ? (
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Verified both ways
        </span>
      ) : null}
    </div>
    <p className="text-xs text-zinc-700">{h.verdict}</p>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-1 pr-3 font-semibold">Area</th>
            <th className="py-1 pr-3 font-semibold">{h.winnerTeam}</th>
            <th className="py-1 font-semibold">{h.loserTeam}</th>
          </tr>
        </thead>
        <tbody>
          {h.decisiveFactors.map((f, i) => (
            <tr key={i} className="border-t border-zinc-100 align-top">
              <td className="py-1.5 pr-3 font-medium text-zinc-900 whitespace-nowrap">
                {f.area} <span className="text-[10px] text-zinc-400">{f.impact}</span>
              </td>
              <td className="py-1.5 pr-3 text-emerald-800">{f.winnerDid}</td>
              <td className="py-1.5 text-rose-800">{f.loserDid}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {h.whereLoserWasBetter.length > 0 && (
      <div>
        <p className="text-[11px] font-semibold text-zinc-600 uppercase">
          Where {h.loserTeam} was better
        </p>
        <ul className="list-disc pl-4 text-xs text-zinc-700">
          {h.whereLoserWasBetter.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    )}
    <div>
      <p className="text-[11px] font-semibold text-zinc-600 uppercase">
        What {h.loserTeam} needs to overtake
      </p>
      <ul className="list-disc pl-4 text-xs text-zinc-700">
        {h.loserToOvertake.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  </div>
);

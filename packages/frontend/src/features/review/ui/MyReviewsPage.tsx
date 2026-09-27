import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { PageHeader } from '../../../shared/layout/PageHeader';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { reviewApi, MySubmission } from '../api/reviewApi';

type Report = Awaited<ReturnType<typeof reviewApi.getEvaluationReport>>;

const STATUS: Record<
  string,
  { label: string; variant: 'gray' | 'blue' | 'green' | 'red' | 'amber' }
> = {
  SUBMITTED: { label: 'Waiting for evaluation', variant: 'gray' },
  QUEUED: { label: 'Queued', variant: 'blue' },
  DISCOVERING: { label: 'Evaluating', variant: 'blue' },
  SANITIZING: { label: 'Evaluating', variant: 'blue' },
  ANALYZING: { label: 'Evaluating', variant: 'blue' },
  SCORING: { label: 'Evaluating', variant: 'blue' },
  EVALUATED: { label: 'Evaluated', variant: 'green' },
  FLAGGED_FOR_REVIEW: { label: 'Under organiser review', variant: 'amber' },
  FAILED: { label: 'Evaluation failed, will be re-run', variant: 'red' }
};

const open = (s: MySubmission) =>
  s.event?.status === 'ACTIVE' &&
  (!s.event.submissionDeadline || Date.now() < new Date(s.event.submissionDeadline).getTime());

/** Student side: every project I submitted, its status, and my feedback once results are published. */
export const MyReviewsPage: React.FC = () => {
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () =>
    reviewApi
      .getMySubmissions()
      .then(setSubs)
      .catch(() => setError('Could not load your submissions.'));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project reviews"
        title="My project reviews"
        description="Your submissions, their evaluation status and your detailed feedback once the organiser publishes results."
        actions={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {subs && subs.length === 0 && (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No submissions yet"
          description="When your trainer shares a project event link, submit your repository there and it will show up here."
        />
      )}
      <div className="space-y-3">
        {subs?.map((s) => {
          const st = STATUS[s.status] || { label: s.status, variant: 'gray' as const };
          const isOpen = expanded === s._id;
          return (
            <div
              key={s._id}
              className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-zinc-200/70 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">{s.event?.name || 'Event'}</p>
                  <h2 className="text-base font-semibold text-zinc-900">{s.teamName}</h2>
                  <a
                    href={s.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 break-all font-mono text-xs text-blue-600 hover:underline"
                  >
                    {s.repositoryUrl.replace(/^https?:\/\//, '')}
                    {s.commitHash && ` @ ${s.commitHash.slice(0, 7)}`}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  {s.result && (
                    <Badge variant="dark">
                      {s.result.score} / 100 · #{s.result.rank}
                      {s.result.of ? ` of ${s.result.of}` : ''}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                {s.event?.submissionDeadline && (
                  <span>Deadline: {new Date(s.event.submissionDeadline).toLocaleString()}</span>
                )}
                {open(s) && s.event && (
                  <Link
                    to={`/review/submit/${s.event._id}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Update submission
                  </Link>
                )}
                {s.event?.resultsPublished ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : s._id)}
                    className="ml-auto inline-flex items-center gap-1 font-semibold text-zinc-800 hover:text-zinc-950"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'Hide feedback' : 'View feedback'}
                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="ml-auto">Feedback appears here once results are published.</span>
                )}
              </div>
              {isOpen && <Feedback submissionId={s._id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Feedback: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    reviewApi
      .getEvaluationReport(submissionId)
      .then(setReport)
      .catch(() => setError(true));
  }, [submissionId]);

  if (error) return <p className="mt-4 text-sm text-red-600">Could not load feedback.</p>;
  if (!report) return <p className="mt-4 text-sm text-zinc-500">Loading feedback…</p>;
  if (!report.published || !report.evaluation)
    return <p className="mt-4 text-sm text-zinc-500">Feedback is not available yet.</p>;

  const ev = report.evaluation;
  const h2h = report.ranking?.headToHead;
  const build = report.evidence?.buildEval;
  const live = report.evidence?.frontendEval;
  const section = 'mt-5 space-y-2';
  const heading = 'text-xs font-bold uppercase tracking-wide text-zinc-500';

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4 text-sm text-zinc-700">
      {ev.synthesisSummary && <p className="leading-relaxed">{ev.synthesisSummary}</p>}

      <div className={section}>
        <p className={heading}>Your scores</p>
        {ev.criterionScores.map((c) => {
          const strengths = c.evidenceCitations
            .filter((x) => x.startsWith('Strength: '))
            .map((x) => x.slice(10));
          const improve = c.evidenceCitations
            .filter((x) => x.startsWith('Improve: '))
            .map((x) => x.slice(9));
          const evidence = c.evidenceCitations.filter((x) => !/^(Strength|Improve): /.test(x));
          return (
            <div
              key={c.criterionId}
              className="rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200/70"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-zinc-900">{c.name}</span>
                <span className="font-mono font-semibold text-zinc-900">
                  {Math.round(c.rawScore)}/100
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200" aria-hidden>
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, c.rawScore)}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed">{c.justification}</p>
              {strengths.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-xs text-emerald-800">
                  {strengths.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
              {improve.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-xs text-amber-800">
                  {improve.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
              {evidence.length > 0 && (
                <p className="mt-1.5 font-mono text-[11px] text-zinc-500">
                  {evidence.slice(0, 4).join(' · ')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {ev.requirementCompliance.length > 0 && (
        <div className={section}>
          <p className={heading}>Requirements</p>
          {ev.requirementCompliance.map((r) => (
            <p key={r.requirementId} className="text-xs">
              <span
                className={
                  r.status === 'FULFILLED'
                    ? 'font-semibold text-emerald-700'
                    : r.status === 'PARTIAL'
                      ? 'font-semibold text-amber-700'
                      : 'font-semibold text-red-700'
                }
              >
                {r.status.replace('_', ' ')}
              </span>{' '}
              {r.title}: {r.evidenceSummary}
            </p>
          ))}
        </div>
      )}

      {build?.status === 'RAN' && build.steps.length > 0 && (
        <div className={section}>
          <p className={heading}>Build &amp; tests (run by the judge)</p>
          {build.steps.map((s, i) => (
            <p key={i} className="text-xs">
              <span
                className={
                  s.ok === null
                    ? 'text-zinc-500'
                    : s.ok
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-red-700'
                }
              >
                {s.ok === null ? 'NOT RUN' : s.ok ? 'PASSED' : 'FAILED'}
              </span>{' '}
              {s.name}
              {s.tests && ` · ${s.tests.passed} passed, ${s.tests.failed} failed`}
              {s.skipped && <span className="text-zinc-500"> · {s.skipped}</span>}
            </p>
          ))}
        </div>
      )}

      {live?.findings && live.findings.length > 0 && (
        <div className={section}>
          <p className={heading}>Your live site</p>
          {live.screenshots?.desktop && (
            <img
              src={live.screenshots.desktop}
              alt="Your live site as the judge saw it"
              className="w-full max-w-xl rounded-lg ring-1 ring-zinc-200"
            />
          )}
          <ul className="list-disc pl-4 text-xs">
            {live.findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {h2h && (!h2h.agreesWithRanking || h2h.positionConsistent === false) && (
        <p className={`${section} text-xs text-zinc-600`}>
          Your place relative to #{(report.ranking?.rank || 2) - 1} was a close call, so your
          organiser reviewed it directly.
        </p>
      )}
      {h2h && h2h.agreesWithRanking && h2h.positionConsistent !== false && (
        <div className={section}>
          <p className={heading}>
            Why you are #{report.ranking?.rank} and not #{(report.ranking?.rank || 2) - 1}
          </p>
          <p className="text-xs leading-relaxed">{h2h.verdict}</p>
          {h2h.whereLoserWasBetter.length > 0 && (
            <>
              <p className="text-xs font-semibold text-emerald-800">Where you were better</p>
              <ul className="list-disc pl-4 text-xs">
                {h2h.whereLoserWasBetter.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}
          <p className="text-xs font-semibold text-zinc-900">To move up</p>
          <ul className="list-disc pl-4 text-xs">
            {h2h.loserToOvertake.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {!!ev.highestImpactImprovements?.length && (
        <div className={section}>
          <p className={heading}>Highest-impact improvements</p>
          <ol className="list-decimal pl-4 text-xs">
            {ev.highestImpactImprovements.slice(0, 6).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default MyReviewsPage;

import React, { Suspense, lazy, useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Code2,
  FileText,
  History,
  ListChecks,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Terminal,
  Timer,
  Trophy,
  X
} from 'lucide-react';
import { Markdown } from '../../../../shared/ui/Markdown';
import { track } from '../../../../shared/lib/tracker';
import { Spinner } from '../../../../shared/ui/Spinner';
import { cn } from '../../../../shared/lib/cn';
import {
  CodeQuestionView,
  CompleteResult,
  contentApi,
  OutlineItem,
  RunResult
} from '../../api/contentApi';

const MonacoEditor = lazy(() => import('./MonacoEditor'));

type Submit = (code: string, language: string) => Promise<CompleteResult>;

const LABEL: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python3',
  cpp: 'C++',
  java: 'Java'
};

// full programs, for questions without a function signature (stdin -> stdout)
const PROGRAM_STARTERS: Record<string, string> = {
  javascript: 'function solve(input) {\n    \n}\n',
  python: 'import sys\n\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  java: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        \n    }\n}\n'
};

const difficultyTone = {
  easy: 'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-600 bg-amber-50',
  hard: 'text-red-600 bg-red-50'
} as const;

const statusTone = (s?: string) =>
  s === 'Accepted' ? 'text-emerald-600' : s ? 'text-red-600' : 'text-zinc-500';

const lines = (s: string) =>
  s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim());

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // drafts are a convenience only
    }
  }
};

export const CodingViewer: React.FC<{ item: OutlineItem; onSubmit: Submit }> = ({
  item,
  onSubmit
}) => {
  const { id: courseId = '' } = useParams();
  const q = useQuery({
    queryKey: ['code-question', item.refId],
    queryFn: () => contentApi.codeQuestion(item.refId, courseId)
  });
  if (q.isLoading) return <Spinner className="py-16" />;
  if (q.error || !q.data) {
    return (
      <p className="text-sm text-red-600">
        {(q.error as Error)?.message || 'Problem unavailable.'}
      </p>
    );
  }
  return <Workspace item={item} details={q.data} onSubmit={onSubmit} />;
};

// drag handle between two panes; reports the pointer position as a % of the container
const Splitter: React.FC<{
  direction: 'x' | 'y';
  container: React.RefObject<HTMLDivElement>;
  onChange: (pct: number) => void;
}> = ({ direction, container, onChange }) => (
  <div
    role="separator"
    aria-orientation={direction === 'x' ? 'vertical' : 'horizontal'}
    onPointerDown={(e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.userSelect = 'none';
    }}
    onPointerMove={(e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId) || !container.current) return;
      const r = container.current.getBoundingClientRect();
      const pct =
        direction === 'x'
          ? ((e.clientX - r.left) / r.width) * 100
          : ((e.clientY - r.top) / r.height) * 100;
      onChange(Math.min(78, Math.max(22, pct)));
    }}
    onPointerUp={() => {
      document.body.style.userSelect = '';
    }}
    className={cn(
      'group hidden shrink-0 items-center justify-center 2xl:flex',
      direction === 'x' ? 'w-2.5 cursor-col-resize' : 'h-2.5 cursor-row-resize'
    )}
  >
    <span
      className={cn(
        'rounded-full bg-zinc-200 transition group-hover:bg-zinc-400 group-active:bg-zinc-900',
        direction === 'x' ? 'h-8 w-1' : 'h-1 w-8'
      )}
    />
  </div>
);

const Workspace: React.FC<{ item: OutlineItem; details: CodeQuestionView; onSubmit: Submit }> = ({
  item,
  details,
  onSubmit
}) => {
  const { id: courseId = '' } = useParams();
  const qc = useQueryClient();
  const sig = details.signature;
  const languages = details.supportedLanguages.filter((l) => LABEL[l]);
  if (!languages.length) languages.push('javascript');

  const starterFor = (l: string) => (sig && details.starters?.[l]) || PROGRAM_STARTERS[l] || '';
  const draftKey = (l: string) => `knowhere:code:${item.id}:${sig ? 'fn' : 'prog'}:${l}`;
  const [language, setLanguage] = useState(
    () => storage.get(`knowhere:code:${item.id}:lang`) || languages[0]
  );
  const [code, setCode] = useState(() => storage.get(draftKey(language)) ?? starterFor(language));

  // test cases: one string per parameter (signature) or one raw input (program)
  const toFields = (input: string) => {
    if (!sig) return [input];
    const l = lines(input);
    return sig.params.map((_, k) => l[k] ?? '');
  };
  const [cases, setCases] = useState<string[][]>(() => {
    const all = [...details.examples, ...(details.sampleCases || [])].slice(0, 5);
    return (all.length ? all : [{ input: '' }]).map((e) => toFields(e.input));
  });
  const [caseIdx, setCaseIdx] = useState(0);
  const [panel, setPanel] = useState<'description' | 'submissions'>('description');
  const [consoleTab, setConsoleTab] = useState<'cases' | 'result'>('cases');
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<CompleteResult | null>(null);
  const [resultIdx, setResultIdx] = useState(0);

  const [split, setSplit] = useState(44);
  const [editorPct, setEditorPct] = useState(62);
  const outer = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);

  const submissions = useQuery({
    queryKey: ['code-submissions', details.questionId],
    queryFn: () => contentApi.submissions(details.questionId, courseId),
    enabled: panel === 'submissions'
  });

  const update = (v: string) => {
    setCode(v);
    storage.set(draftKey(language), v);
  };
  const switchLanguage = (l: string, withCode?: string) => {
    if (l !== language) track('CODE_LANGUAGE', courseId, item.id, { from: language, to: l });
    setLanguage(l);
    storage.set(`knowhere:code:${item.id}:lang`, l);
    const next = withCode ?? storage.get(draftKey(l)) ?? starterFor(l);
    setCode(next);
    if (withCode !== undefined) storage.set(draftKey(l), withCode);
  };

  const doRun = useCallback(async () => {
    if (busy) return;
    setBusy('run');
    setConsoleTab('result');
    setRunError(null);
    setVerdict(null);
    try {
      const inputs = cases.map((c) => c.join('\n'));
      const result = await contentApi.runCode(details.questionId, courseId, language, code, inputs);
      setRun(result);
      track('CODE_RUN', courseId, item.id, {
        language,
        passed: result.passed,
        total: result.total,
        error: result.error ? result.error.slice(0, 120) : undefined,
        custom: cases.length
      });
      setResultIdx(0);
    } catch (e) {
      setRun(null);
      setRunError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [busy, cases, code, courseId, details.questionId, item.id, language]);

  const doSubmit = useCallback(async () => {
    if (busy) return;
    setBusy('submit');
    setConsoleTab('result');
    setRunError(null);
    setRun(null);
    try {
      setVerdict(await onSubmit(code, language));
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ['code-submissions', details.questionId] });
    }
  }, [busy, code, details.questionId, language, onSubmit, qc]);

  const runStatus = run
    ? run.error
      ? /compil/i.test(run.error)
        ? 'Compile Error'
        : /time limit/i.test(run.error)
          ? 'Time Limit Exceeded'
          : 'Runtime Error'
      : run.cases.some((c) => c.error)
        ? 'Runtime Error'
        : run.cases.every((c) => c.passed !== false)
          ? 'Accepted'
          : 'Wrong Answer'
    : undefined;
  const shown = run?.cases[resultIdx];

  return (
    <div
      ref={outer}
      className="flex min-w-0 flex-col gap-4 2xl:h-[calc(100dvh-10rem)] 2xl:flex-row 2xl:gap-0"
      style={{ '--left': `${split}%`, '--top': `${editorPct}%` } as React.CSSProperties}
    >
      {/* ---------------- description / submissions */}
      <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white 2xl:min-h-0 2xl:w-[var(--left)] 2xl:shrink-0">
        <div className="flex items-center gap-1 border-b border-zinc-100 bg-zinc-50/60 px-2 py-1.5">
          {(
            [
              ['description', 'Description', FileText],
              ['submissions', 'Submissions', History]
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setPanel(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition',
                panel === key
                  ? 'bg-white font-medium text-zinc-900 shadow-card'
                  : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {panel === 'description' ? (
            <article className="space-y-5 px-5 py-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {item.title}
                </h1>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 font-medium capitalize',
                      difficultyTone[details.difficulty || 'easy']
                    )}
                  >
                    {details.difficulty || 'easy'}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600">
                    {item.maxScore} pts
                  </span>
                </div>
              </div>

              <div className="text-[15px] leading-relaxed text-zinc-700">
                <Markdown>{details.description || ''}</Markdown>
              </div>

              {!sig && details.inputFormat ? (
                <Block title="Input format">{details.inputFormat}</Block>
              ) : null}
              {!sig && details.outputFormat ? (
                <Block title="Output format">{details.outputFormat}</Block>
              ) : null}

              {details.examples.map((e, i) => (
                <div key={i}>
                  <p className="mb-2 text-[15px] font-semibold text-zinc-900">Example {i + 1}:</p>
                  <div className="space-y-1 border-l-2 border-zinc-200 pl-4 font-mono text-[13px] leading-6 text-zinc-700">
                    <p className="whitespace-pre-wrap break-words">
                      <b className="font-sans font-semibold text-zinc-900">Input: </b>
                      {sig
                        ? sig.params
                            .map((p, k) => `${p.name} = ${lines(e.input)[k] ?? ''}`)
                            .join(', ')
                        : `\n${e.input}`}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      <b className="font-sans font-semibold text-zinc-900">Output: </b>
                      {sig ? e.output : `\n${e.output}`}
                    </p>
                    {e.explanation ? (
                      <p className="whitespace-pre-wrap break-words font-sans">
                        <b className="font-semibold text-zinc-900">Explanation: </b>
                        {e.explanation}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

              {details.constraints.length ? (
                <div>
                  <p className="mb-2 text-[15px] font-semibold text-zinc-900">Constraints:</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-700">
                    {details.constraints.map((c) => (
                      <li key={c}>
                        <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[12.5px] text-zinc-800">
                          {c}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ) : submissions.isLoading ? (
            <Spinner className="py-16" />
          ) : submissions.data?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Language</th>
                  <th className="px-3 py-2.5 font-medium">Runtime</th>
                  <th className="px-5 py-2.5 text-right font-medium">Tests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {submissions.data.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => switchLanguage(s.language, s.code)}
                    className="cursor-pointer transition hover:bg-zinc-50"
                    title="Load this code into the editor"
                  >
                    <td className="px-5 py-3">
                      <p className={cn('font-medium', statusTone(s.status))}>{s.status}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(s.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {LABEL[s.language] || s.language}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-zinc-600">{s.runtimeMs} ms</td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-600">
                      {s.passed}/{s.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-16 text-center text-sm text-zinc-500">No submissions yet.</p>
          )}
        </div>
      </section>

      <Splitter direction="x" container={outer} onChange={setSplit} />

      {/* ---------------- code + console */}
      <div ref={right} className="flex min-w-0 flex-1 flex-col gap-4 2xl:gap-0">
        <section className="flex h-[460px] min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white 2xl:h-[var(--top)]">
          <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-zinc-900">
              <Code2 className="h-4 w-4" /> Code
            </span>
            <select
              value={language}
              onChange={(e) => switchLanguage(e.target.value)}
              aria-label="Language"
              className="h-8 rounded-lg bg-transparent px-2 text-sm text-zinc-700 outline-none transition hover:bg-zinc-100 focus:bg-zinc-100"
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {LABEL[l]}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                track('CODE_RESET', courseId, item.id, { language });
                update(starterFor(language));
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Reset to the starter code"
              title="Reset to the starter code"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={doRun}
                disabled={!!busy}
                title="Run (Ctrl + ')"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {busy === 'run' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run
              </button>
              <button
                onClick={doSubmit}
                disabled={!!busy}
                title="Submit (Ctrl + Enter)"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <Suspense fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
              <MonacoEditor
                value={code}
                onChange={update}
                language={language}
                onRun={doRun}
                onSubmit={doSubmit}
                onPaste={(chars) => track('CODE_PASTE', courseId, item.id, { chars, language })}
              />
            </Suspense>
          </div>
        </section>

        <Splitter direction="y" container={right} onChange={setEditorPct} />

        <section className="flex h-[320px] min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white 2xl:h-auto 2xl:flex-1">
          <div className="flex items-center gap-1 border-b border-zinc-100 bg-zinc-50/60 px-2 py-1.5">
            {(
              [
                ['cases', 'Testcase', ListChecks],
                ['result', 'Test Result', Terminal]
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setConsoleTab(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition',
                  consoleTab === key
                    ? 'bg-white font-medium text-zinc-900 shadow-card'
                    : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {consoleTab === 'cases' ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {cases.map((_, i) => (
                    <span key={i} className="group relative">
                      <button
                        onClick={() => setCaseIdx(i)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm transition',
                          caseIdx === i
                            ? 'bg-zinc-100 font-medium text-zinc-900'
                            : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                        )}
                      >
                        Case {i + 1}
                      </button>
                      {cases.length > 1 ? (
                        <button
                          onClick={() => {
                            setCases((c) => c.filter((_, j) => j !== i));
                            setCaseIdx((k) => Math.max(0, k >= i ? k - 1 : k));
                          }}
                          className="absolute -right-1 -top-1 hidden h-4 w-4 place-items-center rounded-full bg-zinc-200 text-zinc-600 hover:bg-zinc-300 group-hover:grid"
                          aria-label={`Remove case ${i + 1}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {cases.length < 10 ? (
                    <button
                      onClick={() => {
                        setCases((c) => [...c, [...c[caseIdx]]]);
                        setCaseIdx(cases.length);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label="Add a test case"
                      title="Add a test case"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 space-y-3">
                  {(sig ? sig.params.map((p) => p.name) : ['Input']).map((name, k) => (
                    <label key={`${caseIdx}-${k}`} className="block">
                      <span className="mb-1.5 block text-xs font-medium text-zinc-500">
                        {sig ? `${name} =` : name}
                      </span>
                      <textarea
                        value={cases[caseIdx]?.[k] ?? ''}
                        onChange={(e) =>
                          setCases((c) =>
                            c.map((row, i) =>
                              i === caseIdx
                                ? row.map((v, j) => (j === k ? e.target.value : v))
                                : row
                            )
                          )
                        }
                        rows={sig ? 1 : 3}
                        spellCheck={false}
                        className="block w-full resize-y rounded-xl bg-zinc-50 px-3 py-2.5 font-mono text-[13px] text-zinc-800 outline-none ring-1 ring-inset ring-zinc-200/70 transition focus:bg-white focus:ring-zinc-400"
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : busy ? (
              <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {busy === 'submit' ? 'Judging against the hidden tests…' : 'Running your code…'}
              </div>
            ) : runError ? (
              <p className="py-2 text-sm text-red-600">{runError}</p>
            ) : verdict?.judge ? (
              <div className="space-y-3 py-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3
                    className={cn(
                      'text-xl font-semibold',
                      statusTone(
                        verdict.judge.status ||
                          (verdict.judge.passed === verdict.judge.total
                            ? 'Accepted'
                            : 'Wrong Answer')
                      )
                    )}
                  >
                    {verdict.judge.status ||
                      (verdict.judge.passed === verdict.judge.total ? 'Accepted' : 'Wrong Answer')}
                  </h3>
                  <span className="text-sm text-zinc-500">
                    {verdict.judge.passed} / {verdict.judge.total} testcases passed
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <Stat icon={Timer} label="Runtime" value={`${verdict.judge.runtimeMs ?? 0} ms`} />
                  <Stat
                    icon={Trophy}
                    label="Score"
                    value={`${verdict.scoreAwarded} / ${verdict.itemMaxScore}`}
                  />
                </div>
                {verdict.judge.error && verdict.judge.passed !== verdict.judge.total ? (
                  <pre className="whitespace-pre-wrap break-words rounded-xl bg-red-50 p-3 font-mono text-xs text-red-700">
                    {verdict.judge.error}
                  </pre>
                ) : null}
              </div>
            ) : run ? (
              <div className="space-y-3 py-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className={cn('text-xl font-semibold', statusTone(runStatus))}>
                    {runStatus}
                  </h3>
                  <span className="text-sm text-zinc-500">Runtime: {run.runtimeMs} ms</span>
                </div>
                {run.error ? (
                  <pre className="whitespace-pre-wrap break-words rounded-xl bg-red-50 p-3 font-mono text-xs text-red-700">
                    {run.error}
                  </pre>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {run.cases.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => setResultIdx(i)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition',
                            resultIdx === i
                              ? 'bg-zinc-100 font-medium text-zinc-900'
                              : 'text-zinc-500 hover:bg-zinc-50'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              c.passed === false
                                ? 'bg-red-500'
                                : c.passed
                                  ? 'bg-emerald-500'
                                  : 'bg-zinc-300'
                            )}
                          />
                          Case {i + 1}
                        </button>
                      ))}
                    </div>
                    {shown ? (
                      <div className="space-y-3">
                        <IoField
                          label="Input"
                          value={
                            sig
                              ? sig.params
                                  .map((p, k) => `${p.name} = ${lines(shown.input)[k] ?? ''}`)
                                  .join('\n')
                              : shown.input
                          }
                        />
                        {shown.error ? (
                          <IoField label="Error" value={shown.error} tone="error" />
                        ) : (
                          <IoField label="Output" value={shown.output} />
                        )}
                        <IoField
                          label="Expected"
                          value={shown.expected ?? 'No expected output for this case'}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-zinc-500">
                You must run your code first.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="mb-1.5 text-[15px] font-semibold text-zinc-900">{title}:</p>
    <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{children}</p>
  </div>
);

const Stat: React.FC<{ label: string; value: string; icon: React.ElementType }> = ({
  label,
  value,
  icon: Icon
}) => (
  <div className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-inset ring-zinc-200/70">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-0.5 flex items-center gap-1.5 font-semibold tabular-nums text-zinc-900">
      <Icon className="h-4 w-4 text-zinc-400" /> {value}
    </p>
  </div>
);

const IoField: React.FC<{ label: string; value: string; tone?: 'error' }> = ({
  label,
  value,
  tone
}) => (
  <div>
    <p className="mb-1.5 text-xs font-medium text-zinc-500">{label}</p>
    <pre
      className={cn(
        'custom-scrollbar max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl px-3 py-2.5 font-mono text-[13px]',
        tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-zinc-50 text-zinc-800'
      )}
    >
      {value || ' '}
    </pre>
  </div>
);

import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, Play, RotateCcw, Send, XCircle } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import { Badge } from '../../../../shared/ui/Badge';
import { Markdown } from '../../../../shared/ui/Markdown';
import { cn } from '../../../../shared/lib/cn';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Spinner } from '../../../../shared/ui/Spinner';
import { CodeQuestionView, CompleteResult, contentApi, OutlineItem } from '../../api/contentApi';
import { JS_STARTER, RunResult, runJavaScript } from '../../lib/jsRunner';

const difficultyVariant = { easy: 'green', medium: 'amber', hard: 'red' } as const;

// Minimal code editor: monospace textarea with a line gutter and Tab indentation.
const CodeEditor: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange
}) => {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  return (
    <div className="flex h-[340px] overflow-hidden rounded-2xl bg-zinc-950 font-mono text-[13px] leading-6 ring-1 ring-zinc-800 sm:h-[420px]">
      <div
        ref={gutter}
        aria-hidden
        className="select-none overflow-hidden border-r border-white/5 px-2.5 py-3 text-right text-zinc-600 sm:px-3"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Code editor"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          const t = e.currentTarget;
          const { selectionStart: s, selectionEnd: end } = t;
          const next = value.slice(0, s) + '  ' + value.slice(end);
          onChange(next);
          requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
        }}
        className="min-w-0 flex-1 resize-none whitespace-pre bg-transparent px-3 py-3 text-zinc-100 caret-brand-400 outline-none"
      />
    </div>
  );
};

type Submit = (code: string, language: string) => Promise<CompleteResult>;

// JavaScript defines solve(input); the other languages are stdin -> stdout programs
const LANGUAGES: Record<string, { label: string; starter: string }> = {
  javascript: { label: 'JavaScript', starter: JS_STARTER },
  python: {
    label: 'Python',
    starter: `import sys

data = sys.stdin.read().split()
# your code here
print()
`
  },
  cpp: {
    label: 'C++',
    starter: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // your code here
    return 0;
}
`
  },
  java: {
    label: 'Java',
    starter: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        // your code here
    }
}
`
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
  return <CodingWorkspace item={item} details={q.data} onSubmit={onSubmit} />;
};

const CodingWorkspace: React.FC<{
  item: OutlineItem;
  details: CodeQuestionView;
  onSubmit: Submit;
}> = ({ item, details, onSubmit }) => {
  const { id: courseId = '' } = useParams();
  const languages = (details.supportedLanguages || []).filter((l) => LANGUAGES[l]);
  if (!languages.length) languages.push('javascript');
  const [language, setLanguage] = useState(languages[0]);
  const storageKey = `knowhere:code:${item.id}:${language}`;
  const starter = LANGUAGES[language].starter;
  const load = (key: string, fallback: string) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  };
  const [code, setCode] = useState(() => load(storageKey, starter));
  // each language keeps its own draft
  const switchLanguage = (l: string) => {
    setLanguage(l);
    setCode(load(`knowhere:code:${item.id}:${l}`, LANGUAGES[l].starter));
    setResults(null);
    setRunError(null);
  };
  const [runError, setRunError] = useState<string | null>(null);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<CompleteResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cases = useMemo(
    () => (details.examples || []).map((e) => ({ input: e.input, expected: e.output })),
    [details.examples]
  );

  const update = (v: string) => {
    setCode(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      // drafts are a convenience only
    }
  };

  // JavaScript runs in a browser worker; other languages run in the server's sandbox
  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      if (language === 'javascript') {
        setResults(await runJavaScript(code, cases));
      } else {
        const r = await contentApi.runCode(details.questionId, courseId, language, code);
        if (!r.cases.length && r.error) setRunError(r.error);
        setResults(
          r.cases.map((c) => ({
            input: c.input,
            expected: c.expected,
            actual: c.output,
            passed: c.passed,
            error: c.error,
            timeMs: 0,
            logs: []
          }))
        );
      }
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  // hidden tests only run on the server; the score comes back from the judge
  const submit = async () => {
    setRunning(true);
    setSubmitError(null);
    try {
      setVerdict(await onSubmit(code, language));
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const passedCount = results?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={difficultyVariant[details.difficulty || 'easy']} dot>
            {details.difficulty}
          </Badge>
          <Badge variant="gray">{item.maxScore} pts</Badge>
        </div>
        <Markdown>{details.description || ''}</Markdown>

        {details.inputFormat || details.outputFormat ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/70">
              <p className="eyebrow">Input</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-zinc-700">
                {details.inputFormat}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/70">
              <p className="eyebrow">Output</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-zinc-700">
                {details.outputFormat}
              </p>
            </div>
          </div>
        ) : null}

        {details.constraints?.length ? (
          <div>
            <p className="eyebrow mb-2">Constraints</p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-[13px] text-zinc-600">
              {details.constraints.map((c) => (
                <li key={c} className="break-words">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(details.examples || []).map((e, i) => (
          <div key={i} className="overflow-hidden rounded-2xl ring-1 ring-inset ring-zinc-200">
            <p className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-500">
              Example {i + 1}
            </p>
            <div className="grid grid-cols-1 gap-px bg-zinc-100 sm:grid-cols-2">
              <pre className="overflow-x-auto bg-white p-3 font-mono text-[13px] text-zinc-800">
                {e.input}
              </pre>
              <pre className="overflow-x-auto bg-white p-3 font-mono text-[13px] text-zinc-800">
                {e.output}
              </pre>
            </div>
            {e.explanation ? (
              <p className="bg-white px-4 py-2.5 text-sm text-zinc-500">{e.explanation}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="min-w-0 space-y-3 xl:sticky xl:top-6 xl:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            value={language}
            onChange={(e) => switchLanguage(e.target.value)}
            aria-label="Language"
            className="h-8 rounded-lg bg-zinc-100 px-2 font-mono text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGES[l].label}
              </option>
            ))}
          </select>
          <button
            onClick={() => update(starter)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
        <CodeEditor value={code} onChange={update} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={run} isLoading={running} disabled={!cases.length}>
            {!running ? <Play className="h-4 w-4" /> : null} Run examples
          </Button>
          <Button onClick={submit} disabled={running}>
            <Send className="h-4 w-4" /> Submit
          </Button>
        </div>

        {runError ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-red-50 p-3 font-mono text-xs text-red-700 ring-1 ring-inset ring-red-200">
            {runError}
          </pre>
        ) : null}

        {verdict?.judge ? (
          <div
            role="status"
            className={cn(
              'rounded-2xl px-4 py-3 text-sm ring-1 ring-inset',
              verdict.judge.passed === verdict.judge.total
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : verdict.judge.passed
                  ? 'bg-amber-50 text-amber-800 ring-amber-200'
                  : 'bg-red-50 text-red-700 ring-red-200'
            )}
          >
            <p className="font-medium">
              {verdict.judge.passed}/{verdict.judge.total} hidden tests passed ·{' '}
              {verdict.scoreAwarded}/{verdict.itemMaxScore} pts
            </p>
            {verdict.judge.error ? (
              <p className="mt-1 break-words text-xs">{verdict.judge.error}</p>
            ) : null}
          </div>
        ) : null}
        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Run checks the public examples; Submit grades your code on the server against the hidden
            tests.{' '}
            {language === 'javascript' ? (
              <>
                Define <code className="font-mono text-zinc-700">solve(input)</code> and return the
                output as a string.
              </>
            ) : (
              <>Read the input from stdin and print the answer to stdout.</>
            )}
          </span>
        </p>

        {results ? (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <div
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium',
                passedCount === results.length
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-zinc-50 text-zinc-800'
              )}
            >
              {passedCount === results.length ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              {passedCount}/{results.length} examples passed
            </div>
            <ul className="divide-y divide-zinc-100">
              {results.map((r, i) => (
                <li key={i} className="space-y-1.5 px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        r.passed ? 'bg-emerald-500' : 'bg-red-500'
                      )}
                    />
                    <span className="font-medium text-zinc-800">Example {i + 1}</span>
                    {r.timeMs ? (
                      <span className="ml-auto tabular-nums text-zinc-400">{r.timeMs}ms</span>
                    ) : null}
                  </div>
                  {!r.passed ? (
                    <div className="grid gap-1 font-mono">
                      {r.error ? <p className="break-words text-red-600">{r.error}</p> : null}
                      <p className="break-all text-zinc-500">expected: {r.expected}</p>
                      <p className="break-all text-zinc-500">received: {r.actual || '∅'}</p>
                    </div>
                  ) : null}
                  {r.logs.length ? (
                    <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-2 font-mono text-zinc-600">
                      {r.logs.join('\n')}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

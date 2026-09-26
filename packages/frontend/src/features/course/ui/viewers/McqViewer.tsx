import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import { Spinner } from '../../../../shared/ui/Spinner';
import { cn } from '../../../../shared/lib/cn';
import { contentApi, OutlineItem } from '../../api/contentApi';

// The server never reveals the right option; a correct answer comes back with its explanation.
export const McqViewer: React.FC<{ item: OutlineItem; onCorrect: () => void }> = ({
  item,
  onCorrect
}) => {
  const { id: courseId = '' } = useParams();
  const [selected, setSelected] = useState<string | null>(null);
  const mcq = useQuery({
    queryKey: ['mcq', item.refId],
    queryFn: () => contentApi.mcq(item.refId, courseId)
  });

  const check = useMutation({
    mutationFn: () => contentApi.checkMcq(item.refId, selected!, courseId),
    onSuccess: (r) => r.isCorrect && onCorrect()
  });
  const result = check.data;

  if (mcq.isLoading) return <Spinner className="py-16" />;
  if (mcq.error || !mcq.data) {
    return (
      <p className="text-sm text-red-600">{(mcq.error as Error)?.message || 'Quiz unavailable.'}</p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-balance text-lg font-medium leading-snug text-zinc-900 sm:text-xl">
        {mcq.data.question}
      </p>
      <Attachments ids={mcq.data.questionResourceIds} courseId={courseId} />

      <div className="space-y-2.5" role="radiogroup" aria-label="Answers">
        {mcq.data.options.map((o, i) => {
          const isSel = selected === o.id;
          const right = result?.isCorrect && isSel;
          const wrong = result && !result.isCorrect && isSel;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={isSel}
              disabled={Boolean(result)}
              onClick={() => setSelected(o.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl p-3.5 text-left ring-1 ring-inset transition sm:p-4',
                right
                  ? 'bg-emerald-50 ring-2 ring-emerald-500'
                  : wrong
                    ? 'bg-red-50 ring-2 ring-red-400'
                    : isSel
                      ? 'bg-brand-50/70 ring-2 ring-brand-500'
                      : 'bg-white ring-zinc-200 hover:ring-zinc-300',
                result && !isSel && 'opacity-60'
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold',
                  right
                    ? 'bg-emerald-500 text-white'
                    : wrong
                      ? 'bg-red-500 text-white'
                      : isSel
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-100 text-zinc-500'
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 flex-1 break-words pt-0.5 text-[15px] text-zinc-800">
                {o.text}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-2xl p-4 ring-1 ring-inset',
              result.isCorrect ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200'
            )}
          >
            <p
              className={cn(
                'flex items-center gap-2 font-medium',
                result.isCorrect ? 'text-emerald-800' : 'text-red-800'
              )}
            >
              {result.isCorrect ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {result.isCorrect
                ? `Correct! +${item.maxScore} pts`
                : 'Not quite — give it another go.'}
            </p>
            {result.explanation ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{result.explanation}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {check.error ? (
        <p className="text-sm text-red-600">{(check.error as Error).message}</p>
      ) : null}

      {result && !result.isCorrect ? (
        <Button
          variant="outline"
          onClick={() => {
            check.reset();
            setSelected(null);
          }}
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      ) : !result ? (
        <Button disabled={!selected} isLoading={check.isPending} onClick={() => check.mutate()}>
          Check answer
        </Button>
      ) : null}
    </div>
  );
};

// images attached to the question render inline, other files as download links
const Attachments: React.FC<{ ids: string[]; courseId: string }> = ({ ids, courseId }) => {
  const files = useQuery({
    queryKey: ['mcq-attachments', ids],
    queryFn: () => Promise.all(ids.map((id) => contentApi.resource(id, courseId))),
    enabled: ids.length > 0,
    staleTime: 4 * 60_000
  });
  if (!ids.length || !files.data) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {files.data.map((f) =>
        f.mimeType.startsWith('image/') ? (
          <img
            key={f.resourceId}
            src={f.downloadUrl}
            alt={f.fileName}
            className="max-h-64 max-w-full rounded-xl shadow-card"
          />
        ) : (
          <a
            key={f.resourceId}
            href={f.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-brand-700 hover:bg-zinc-200"
          >
            {f.fileName}
          </a>
        )
      )}
    </div>
  );
};

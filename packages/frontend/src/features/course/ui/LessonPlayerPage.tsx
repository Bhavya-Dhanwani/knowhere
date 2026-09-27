import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListTree,
  Lock,
  Undo2,
  X
} from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { cn } from '../../../shared/lib/cn';
import { flattenItems } from '../api/contentApi';
import { useCompleteItem, useCourseStructure } from '../hooks/useCourseContent';
import { CourseOutline } from './CourseOutline';
import { ITEM_META } from './itemMeta';
import { ResourceViewer, VideoViewer } from './viewers/MediaViewers';
import { McqViewer } from './viewers/McqViewer';
import { CodingViewer } from './viewers/CodingViewer';
import { useDwell } from '../../../shared/lib/tracker';

export const LessonPlayerPage: React.FC = () => {
  const { id: courseId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const [outlineOpen, setOutlineOpen] = useState(false);

  const structure = useCourseStructure(courseId);
  useDwell(courseId, itemId);
  const complete = useCompleteItem(courseId);

  const flat = flattenItems(structure.data);
  const index = flat.findIndex((f) => f.item.id === itemId);
  const current = flat[index];
  const prev = index > 0 ? flat[index - 1] : undefined;
  const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : undefined;

  // the lesson (submodule) around the current item, and its neighbours
  const lessons = flat.reduce<{ id: string; title: string; first: string }[]>(
    (acc, f) =>
      acc.some((l) => l.id === f.lesson.id)
        ? acc
        : [...acc, { id: f.lesson.id, title: f.lesson.title, first: f.item.id }],
    []
  );
  const li = lessons.findIndex((l) => l.id === current?.lesson.id);
  const lessonItems = current?.lesson.items || [];
  const count = (t: string) => {
    const of = lessonItems.filter((i) => i.type === t);
    return `${of.filter((i) => i.completed).length}/${of.length}`;
  };
  const lessonScore = lessonItems.reduce((s, i) => s + i.scoreEarned, 0);
  const lessonMax = lessonItems.reduce((s, i) => s + i.maxScore, 0);
  const lessonPct = lessonItems.length
    ? (lessonItems.filter((i) => i.completed).length / lessonItems.length) * 100
    : 0;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setOutlineOpen(false);
  }, [itemId]);

  const go = (target?: { item: { id: string } } | { id: string }) => {
    if (!target) return;
    const id = 'item' in target ? target.item.id : target.id;
    navigate(`/course/${courseId}/learn/${id}`);
  };
  const markDone = () => complete.mutate({ itemId });

  if (structure.error) {
    return (
      <div className="page py-10">
        <EmptyState
          title="Couldn't load this course"
          description={(structure.error as Error).message}
        />
      </div>
    );
  }

  const meta = current ? ITEM_META[current.item.type] : null;
  const isDone = current?.item.completed;
  const selfPaced = current && (current.item.type === 'resource' || current.item.type === 'video');

  return (
    <div className="mx-auto max-w-[1880px] px-3 pb-24 pt-5 sm:px-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* lesson panel */}
        <aside className="hidden min-w-0 space-y-4 xl:sticky xl:top-20 xl:block xl:self-start">
          <Link
            to={`/course/${courseId}`}
            className="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 text-sm font-medium text-zinc-900 transition hover:border-zinc-300"
          >
            Go back <Undo2 className="h-4 w-4 text-zinc-500" />
          </Link>

          <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
            <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-3 py-3">
              <button
                disabled={li <= 0}
                onClick={() => go(lessons[li - 1] && { id: lessons[li - 1].first })}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 disabled:opacity-40"
                aria-label="Previous lesson"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-0 flex-1 truncate text-center text-[15px] font-medium text-zinc-900">
                {current?.lesson.title || '…'}
              </p>
              <button
                disabled={li < 0 || li >= lessons.length - 1}
                onClick={() => go(lessons[li + 1] && { id: lessons[li + 1].first })}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 disabled:opacity-40"
                aria-label="Next lesson"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="m-3 rounded-xl border border-zinc-200/80 p-4">
              <p className="text-center text-sm font-medium text-zinc-900">
                {Math.round(lessonPct)}% complete
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-zinc-900"
                  style={{ width: `${lessonPct}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-4 text-center text-xs text-zinc-500">
                {[
                  ['Video', count('video')],
                  ['Problem', count('code-question')],
                  ['MCQs', count('mcq')],
                  ['Score', `${lessonScore}/${lessonMax}`]
                ].map(([label, value]) => (
                  <span key={label}>
                    {label}
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-900">
                      {value}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <ul className="custom-scrollbar max-h-[calc(100dvh-26rem)] overflow-y-auto px-2 pb-2">
              {structure.isLoading ? (
                <Skeleton className="m-2 h-40" />
              ) : (
                lessonItems.map((it) => {
                  const M = ITEM_META[it.type];
                  const active = it.id === itemId;
                  return (
                    <li key={it.id}>
                      <Link
                        to={`/course/${courseId}/learn/${it.id}`}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                          active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'
                        )}
                      >
                        {it.completed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-900" />
                        ) : (
                          <M.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{it.title}</span>
                        {it.maxScore ? (
                          <span className="shrink-0 font-mono text-xs text-zinc-400">
                            {it.scoreEarned}/{it.maxScore}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </aside>

        {/* content: coding questions bring their own problem / code / tests panels */}
        {current?.item.type === 'code-question' && !current.module.schedule?.locked ? (
          <div className="min-w-0">
            <CodingViewer
              key={itemId}
              item={current.item}
              onSubmit={(code, language) => complete.mutateAsync({ itemId, code, language })}
            />
          </div>
        ) : (
          <main className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
            <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <Link
                to={`/course/${courseId}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 xl:hidden"
                aria-label="Course overview"
              >
                <Undo2 className="h-4 w-4" />
              </Link>
              {meta ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                  <meta.icon className="h-4 w-4" /> {meta.label}
                </span>
              ) : null}
              <span className="ml-auto flex items-center gap-2">
                {isDone ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-zinc-600">
                    Completed <CheckCircle2 className="h-4 w-4 text-zinc-900" />
                  </span>
                ) : null}
                <button
                  onClick={() => setOutlineOpen(true)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 xl:hidden"
                  aria-label="Open course outline"
                >
                  <ListTree className="h-[18px] w-[18px]" />
                </button>
              </span>
            </div>

            <div className="px-4 py-6 sm:px-8 sm:py-8">
              {structure.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-72" />
                </div>
              ) : !current ? (
                <EmptyState title="This item isn't part of the course" />
              ) : current.module.schedule?.locked ? (
                <EmptyState
                  icon={<Lock />}
                  title="This module hasn't opened for you yet"
                  description={`It opens on ${new Date(current.module.schedule.startsAt).toLocaleString()}.`}
                />
              ) : (
                <motion.article
                  key={itemId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <header>
                    <h1 className="text-balance break-words text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                      {current.item.title}
                    </h1>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {current.module.title}
                      {current.module.schedule
                        ? ` · due ${new Date(current.module.schedule.deadline).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
                        : ''}
                    </p>
                  </header>

                  {current.item.type === 'video' ? <VideoViewer item={current.item} /> : null}
                  {current.item.type === 'resource' ? <ResourceViewer item={current.item} /> : null}
                  {current.item.type === 'mcq' ? (
                    <McqViewer key={itemId} item={current.item} onCorrect={() => markDone()} />
                  ) : null}

                  {complete.error ? (
                    <p className="text-sm text-red-600">{(complete.error as Error).message}</p>
                  ) : null}

                  {selfPaced && !isDone ? (
                    <Button
                      variant="outline"
                      isLoading={complete.isPending}
                      onClick={() => markDone()}
                    >
                      <Check className="h-4 w-4" /> Mark complete
                    </Button>
                  ) : null}
                </motion.article>
              )}
            </div>
          </main>
        )}
      </div>

      {/* bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/70 bg-white/90 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-3 px-4">
          <button
            disabled={!prev}
            onClick={() => go(prev)}
            className="grid h-10 w-11 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="flex h-10 flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm tabular-nums text-zinc-700">
            {index >= 0 ? `Item ${index + 1}/${flat.length}` : '…'}
          </span>
          {next ? (
            <button
              onClick={() => {
                if (selfPaced && !isDone) markDone();
                go(next);
              }}
              className="grid h-10 w-11 place-items-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <Button onClick={() => navigate(`/course/${courseId}`)}>Finish</Button>
          )}
        </div>
      </nav>

      {/* outline drawer (below xl) */}
      <AnimatePresence>
        {outlineOpen && structure.data ? (
          <div className="fixed inset-0 z-50 xl:hidden">
            <motion.div
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOutlineOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 right-0 flex w-[min(22rem,92vw)] flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 p-4">
                <p className="min-w-0 truncate text-sm font-semibold">
                  {structure.data.course.title}
                </p>
                <button
                  onClick={() => setOutlineOpen(false)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                  aria-label="Close outline"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="custom-scrollbar flex-1 overflow-y-auto p-2 pb-safe">
                <CourseOutline
                  courseId={courseId}
                  modules={structure.data.modules}
                  activeItemId={itemId}
                  compact
                  onNavigate={() => setOutlineOpen(false)}
                />
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

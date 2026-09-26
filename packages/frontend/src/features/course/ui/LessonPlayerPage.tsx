import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ListTree, Lock, X } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { cn } from '../../../shared/lib/cn';
import { flattenItems } from '../api/contentApi';
import { useCompleteItem, useCourseStructure } from '../hooks/useCourseContent';
import { CourseOutline } from './CourseOutline';
import { ITEM_META } from './itemMeta';
import { ResourceViewer, VideoViewer } from './viewers/MediaViewers';
import { McqViewer } from './viewers/McqViewer';
import { CodingViewer } from './viewers/CodingViewer';

export const LessonPlayerPage: React.FC = () => {
  const { id: courseId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const [outlineOpen, setOutlineOpen] = useState(false);

  const structure = useCourseStructure(courseId);
  const complete = useCompleteItem(courseId);

  const flat = flattenItems(structure.data);
  const index = flat.findIndex((f) => f.item.id === itemId);
  const current = flat[index];
  const prev = index > 0 ? flat[index - 1] : undefined;
  const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : undefined;
  const stats = structure.data?.stats;
  const pct = stats?.itemCount ? (stats.completedCount / stats.itemCount) * 100 : 0;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setOutlineOpen(false);
  }, [itemId]);

  const go = (target?: { item: { id: string } }) =>
    target && navigate(`/course/${courseId}/learn/${target.item.id}`);
  const markDone = () => complete.mutate({ itemId });

  const outline = structure.data ? (
    <CourseOutline
      courseId={courseId}
      modules={structure.data.modules}
      activeItemId={itemId}
      compact
      onNavigate={() => setOutlineOpen(false)}
    />
  ) : null;

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
    <div className="flex min-h-shell">
      {/* desktop outline */}
      <aside className="sticky top-0 hidden h-[100dvh] w-80 shrink-0 flex-col border-r border-zinc-200/70 bg-white/60 xl:flex">
        <div className="border-b border-zinc-100 p-4">
          <Link
            to={`/course/${courseId}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Course overview
          </Link>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900">
            {structure.data?.course.title}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={pct} height="sm" />
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">{Math.round(pct)}%</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {outline || <Skeleton className="m-2 h-40" />}
        </div>
      </aside>

      {/* mobile outline drawer */}
      <AnimatePresence>
        {outlineOpen ? (
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
                  {structure.data?.course.title}
                </p>
                <button
                  onClick={() => setOutlineOpen(false)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                  aria-label="Close outline"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 pb-safe">{outline}</div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="min-w-0 flex-1">
        {/* top bar */}
        <div className="sticky top-[var(--shell-top)] z-20 border-b border-zinc-200/70 bg-canvas/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:px-6">
            <Link
              to={`/course/${courseId}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 xl:hidden"
              aria-label="Course overview"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <p className="min-w-0 flex-1 truncate text-sm text-zinc-500">
              {current ? (
                <>
                  <span className="hidden sm:inline">{current.module.title} · </span>
                  {current.lesson.title}
                </>
              ) : null}
            </p>
            <span className="hidden text-xs tabular-nums text-zinc-400 xs:inline">
              {index + 1}/{flat.length}
            </span>
            <button
              onClick={() => setOutlineOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-600 hover:bg-zinc-100 xl:hidden"
              aria-label="Open course outline"
            >
              <ListTree className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              <header>
                {meta ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                      meta.tint
                    )}
                  >
                    <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                  </span>
                ) : null}
                <h1 className="mt-3 text-balance break-words text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  {current.item.title}
                </h1>
                {current.module.schedule ? (
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {current.module.title} is due{' '}
                    {new Date(current.module.schedule.deadline).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                ) : null}
              </header>

              {current.item.type === 'video' ? <VideoViewer item={current.item} /> : null}
              {current.item.type === 'resource' ? <ResourceViewer item={current.item} /> : null}
              {current.item.type === 'mcq' ? (
                <McqViewer key={itemId} item={current.item} onCorrect={() => markDone()} />
              ) : null}
              {current.item.type === 'code-question' ? (
                <CodingViewer
                  key={itemId}
                  item={current.item}
                  onSubmit={(code, language) => complete.mutateAsync({ itemId, code, language })}
                />
              ) : null}

              {complete.error ? (
                <p className="text-sm text-red-600">{(complete.error as Error).message}</p>
              ) : null}

              {/* footer navigation */}
              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200/70 pt-6 sm:flex-row sm:items-center">
                <Button
                  variant="ghost"
                  disabled={!prev}
                  onClick={() => go(prev)}
                  className="justify-start"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="truncate">{prev ? 'Previous' : 'Start of course'}</span>
                </Button>
                <div className="flex flex-col gap-2 xs:flex-row sm:ml-auto">
                  {selfPaced ? (
                    <Button
                      variant={isDone ? 'secondary' : 'outline'}
                      disabled={isDone}
                      isLoading={complete.isPending}
                      onClick={() => markDone()}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : null}
                      {isDone ? 'Completed' : 'Mark complete'}
                    </Button>
                  ) : isDone ? (
                    <span className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-4 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <Check className="h-4 w-4" /> {current?.item.scoreEarned}/
                      {current?.item.maxScore} pts
                    </span>
                  ) : null}
                  {next ? (
                    <Button
                      onClick={() => {
                        if (selfPaced && !isDone) markDone();
                        go(next);
                      }}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => navigate(`/course/${courseId}`)}>Finish</Button>
                  )}
                </div>
              </div>
            </motion.article>
          )}
        </main>
      </div>
    </div>
  );
};

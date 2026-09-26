import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  CalendarClock,
  Eye,
  Library,
  Pencil,
  Plus,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { RootState } from '../../../../app/store';
import { roleOf } from '../../../../shared/lib/roles';
import { cn } from '../../../../shared/lib/cn';
import { lmsApi, CourseStatus } from '../../../../shared/api/lms';
import { Button } from '../../../../shared/ui/Button';
import { Badge } from '../../../../shared/ui/Badge';
import { Modal } from '../../../../shared/ui/Modal';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { Dropdown } from '../../../../shared/ui/Dropdown';
import { FormError } from '../../../auth/ui/AuthControls';
import { contentApi } from '../../../course/api/contentApi';
import { structureKey, useCourseStructure } from '../../../course/hooks/useCourseContent';
import { ITEM_META } from '../../../course/ui/itemMeta';
import { CourseMembersModal } from '../CourseMembersModal';
import { OrderedPicker } from '../library/pickers';
import { libraryKey } from '../library/LibraryDialogs';

// Click-to-rename text. Enter or blur saves, Escape cancels.
const InlineEdit: React.FC<{
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}> = ({ value, onSave, className, inputClassName, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };

  return editing ? (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn(
        'w-full min-w-0 rounded-lg bg-white px-2 py-1 ring-2 ring-brand-500 focus:outline-none',
        inputClassName
      )}
    />
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename"
      className={cn(
        'group/ie -mx-2 flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition hover:bg-zinc-100',
        className
      )}
    >
      <span className="min-w-0 truncate">{value || placeholder}</span>
      <Pencil className="h-3 w-3 shrink-0 text-zinc-300 opacity-0 transition group-hover/ie:opacity-100" />
    </button>
  );
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

export const CourseEditorPage: React.FC = () => {
  const { courseId = '' } = useParams();
  const user = useSelector((s: RootState) => s.auth.user);
  const isAdmin = roleOf(user) === 'admin';
  const qc = useQueryClient();
  const { data, isLoading, error } = useCourseStructure(courseId);
  const [membersOpen, setMembersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rescheduling, setRescheduling] = useState<{
    id: string;
    title: string;
    order: number;
  } | null>(null);
  const navigate = useNavigate();
  const refresh = () => qc.invalidateQueries({ queryKey: structureKey(courseId) });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => contentApi.reorderModules(courseId, ids),
    onSuccess: refresh
  });
  const detach = useMutation({
    mutationFn: (moduleId: string) => contentApi.removeModule(courseId, moduleId),
    onSuccess: refresh
  });
  const destroy = useMutation({
    mutationFn: () => contentApi.deleteCourse(courseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      navigate(isAdmin ? '/admin/courses' : '/dashboard', { replace: true });
    }
  });

  const update = useMutation({
    mutationFn: (patch: Partial<{ title: string; description: string; status: CourseStatus }>) =>
      lmsApi.updateCourse(courseId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: structureKey(courseId) });
      qc.invalidateQueries({ queryKey: ['courses'] });
    }
  });

  if (isLoading) {
    return (
      <div className="page space-y-4 py-8">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="page py-10">
        <EmptyState title="Couldn't open the editor" description={(error as Error)?.message} />
      </div>
    );
  }

  const { course, modules, stats } = data;

  return (
    <div className="page space-y-6 py-6 sm:py-8">
      <Link
        to={isAdmin ? '/admin/courses' : '/dashboard'}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> {isAdmin ? 'All courses' : 'Dashboard'}
      </Link>

      <section className="rounded-3xl bg-white p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">Course editor</p>
            <InlineEdit
              value={course.title}
              onSave={(title) => update.mutate({ title })}
              className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
              inputClassName="text-xl font-semibold sm:text-2xl"
            />
            <InlineEdit
              value={course.description}
              placeholder="Add a short description…"
              onSave={(description) => update.mutate({ description })}
              className={cn('mt-1 text-sm', course.description ? 'text-zinc-500' : 'text-zinc-400')}
              inputClassName="text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="gray">{stats.moduleCount} modules</Badge>
              <Badge variant="gray">{stats.lessonCount} submodules</Badge>
              <Badge variant="gray">{stats.itemCount} items</Badge>
              <Badge variant="gray">{stats.maxScore} pts</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              value={course.status}
              onChange={(status) => update.mutate({ status: status as CourseStatus })}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' }
              ]}
              containerClassName="w-36"
              className="h-10"
            />
            {isAdmin ? (
              <Button variant="outline" onClick={() => setMembersOpen(true)}>
                <Users className="h-4 w-4" /> Members
              </Button>
            ) : null}
            <Link to={`/course/${course.id}`}>
              <Button variant="outline">
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              isLoading={destroy.isPending}
              onClick={() =>
                window.confirm(
                  `Delete "${course.title}"? Learner progress for this course is removed too. Library content stays.`
                ) && destroy.mutate()
              }
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </section>

      <FormError
        message={(update.error || reorder.error || detach.error || destroy.error)?.message}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Modules</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/library">
            <Button variant="outline" size="sm">
              <Library className="h-3.5 w-3.5" /> Content library
            </Button>
          </Link>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add module
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          icon={<Boxes />}
          title="No modules yet"
          description="Build modules in the content library (files & questions → submodules → modules), then attach them here."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add module
            </Button>
          }
        />
      ) : (
        <ol className="space-y-3">
          {modules.map((m, i) => {
            const future = new Date(m.releaseAt) > new Date();
            return (
              <li key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
                <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink font-mono text-xs text-white">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-900">
                    {m.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRescheduling({ id: m.id, title: m.title, order: i + 1 })}
                    title="Change when this module opens"
                  >
                    <Badge size="sm" variant={future ? 'amber' : 'green'} dot>
                      <CalendarClock className="h-3 w-3" />{' '}
                      {future ? `opens ${fmt(m.releaseAt)}` : 'released'}
                    </Badge>
                  </button>
                  <Badge size="sm" variant="blue">
                    {m.durationDays}d window · {m.progressRequirement}%
                  </Badge>
                  <div className="ml-auto flex items-center gap-0.5">
                    {[
                      { dir: -1, icon: ArrowUp, label: 'Move up' },
                      { dir: 1, icon: ArrowDown, label: 'Move down' }
                    ].map(({ dir, icon: Icon, label }) => (
                      <button
                        key={label}
                        type="button"
                        disabled={reorder.isPending || !modules[i + dir]}
                        onClick={() => {
                          const ids = modules.map((x) => x.id);
                          [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
                          reorder.mutate(ids);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label={`${label}: ${m.title}`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={detach.isPending}
                      onClick={() =>
                        window.confirm(
                          `Remove "${m.title}" from this course? The module stays in your library.`
                        ) && detach.mutate(m.id)
                      }
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${m.title} from course`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ul className="space-y-1 p-2 sm:p-3">
                  {m.lessons.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-xl bg-zinc-50/80 px-3 py-2 ring-1 ring-inset ring-zinc-200/70"
                    >
                      <p className="truncate text-sm font-medium text-zinc-800">{l.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {l.items.map((it) => {
                          const M = ITEM_META[it.type];
                          return (
                            <span
                              key={it.id}
                              className={cn(
                                'inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] ring-1 ring-inset',
                                M.tint
                              )}
                            >
                              <M.icon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{it.title}</span>
                            </span>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

      <AddModuleDialog
        open={adding || Boolean(rescheduling)}
        onClose={() => {
          setAdding(false);
          setRescheduling(null);
        }}
        courseId={course.id}
        attached={modules.map((m) => m.id)}
        reschedule={rescheduling}
      />
      {isAdmin ? (
        <CourseMembersModal
          course={membersOpen ? course : null}
          onClose={() => setMembersOpen(false)}
        />
      ) : null}
    </div>
  );
};

// POST /course/add-module — release now, or schedule when the module unlocks.
// Re-posting an attached module (same order) reschedules it.
const AddModuleDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  courseId: string;
  attached: string[];
  reschedule: { id: string; title: string; order: number } | null;
}> = ({ open, onClose, courseId, attached, reschedule }) => {
  const qc = useQueryClient();
  const lib = useQuery({ queryKey: libraryKey, queryFn: contentApi.library, enabled: open });
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [releaseAt, setReleaseAt] = useState('');

  const save = useMutation({
    mutationFn: () =>
      contentApi.addModule(
        courseId,
        reschedule?.id || picked[0],
        when === 'later' && releaseAt ? new Date(releaseAt).toISOString() : undefined,
        reschedule?.order
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: structureKey(courseId) });
      setPicked([]);
      setWhen('now');
      setReleaseAt('');
      onClose();
    }
  });

  const options = (lib.data?.modules || [])
    .filter((m) => !attached.includes(m._id))
    .map((m) => ({
      id: m._id,
      label: m.title,
      sublabel: `${m.submoduleCount} submodules · ${m.durationDays}d window`
    }));

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={reschedule ? `Reschedule “${reschedule.title}”` : 'Add module to course'}
      maxWidth="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={(!reschedule && !picked.length) || (when === 'later' && !releaseAt)}
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            {reschedule ? 'Save schedule' : 'Add module'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError message={save.error instanceof Error ? save.error.message : null} />
        <div className={reschedule ? 'hidden' : undefined}>
          <p className="mb-1.5 text-[13px] font-medium text-zinc-700">Module</p>
          {lib.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <OrderedPicker
              options={options}
              value={picked}
              onChange={(ids) => setPicked(ids.slice(-1))}
              empty="No unattached modules. Create one in the content library."
            />
          )}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-zinc-700">Release</legend>
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            {(['now', 'later'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWhen(w)}
                aria-pressed={when === w}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition',
                  when === w
                    ? 'bg-brand-50/60 ring-2 ring-brand-500'
                    : 'ring-zinc-200 hover:ring-zinc-300'
                )}
              >
                <span className="block text-sm font-medium text-zinc-900">
                  {w === 'now' ? 'Now' : 'Schedule'}
                </span>
                <span className="block text-xs text-zinc-500">
                  {w === 'now' ? 'Unlocks immediately' : 'Pick when it unlocks'}
                </span>
              </button>
            ))}
          </div>
          {when === 'later' ? (
            <input
              type="datetime-local"
              value={releaseAt}
              onChange={(e) => setReleaseAt(e.target.value)}
              className="mt-2 h-10 w-full rounded-xl bg-white px-3 text-sm shadow-xs ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : null}
        </fieldset>
      </div>
    </Modal>
  );
};

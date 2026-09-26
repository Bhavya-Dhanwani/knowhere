import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Code2, FileText, Layers, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../../shared/layout/PageHeader';
import { Button } from '../../../../shared/ui/Button';
import { Badge } from '../../../../shared/ui/Badge';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { timeAgo } from '../../../../shared/lib/format';
import { contentApi, LibraryType } from '../../../course/api/contentApi';
import {
  CodeQuestionDialog,
  McqDialog,
  ModuleDialog,
  SubmoduleDialog,
  RenameResourceDialog,
  UploadResourceDialog,
  libraryKey
} from './LibraryDialogs';

type Tab = 'resources' | 'mcqs' | 'code' | 'submodules' | 'modules';

const API_TYPE: Record<Tab, LibraryType> = {
  resources: 'resource',
  mcqs: 'mcq',
  code: 'code-question',
  submodules: 'submodule',
  modules: 'module'
};

const TABS: { id: Tab; label: string; icon: React.ReactNode; action: string; step: string }[] = [
  {
    id: 'resources',
    label: 'Files',
    icon: <FileText className="h-3.5 w-3.5" />,
    action: 'Upload',
    step: 'Upload videos, PDFs and files'
  },
  {
    id: 'mcqs',
    label: 'MCQs',
    icon: <ListChecks className="h-3.5 w-3.5" />,
    action: 'New MCQ',
    step: 'Write multiple-choice questions'
  },
  {
    id: 'code',
    label: 'Coding',
    icon: <Code2 className="h-3.5 w-3.5" />,
    action: 'New question',
    step: 'Add LeetCode-style problems'
  },
  {
    id: 'submodules',
    label: 'Submodules',
    icon: <Layers className="h-3.5 w-3.5" />,
    action: 'New submodule',
    step: 'Bundle items into lessons'
  },
  {
    id: 'modules',
    label: 'Modules',
    icon: <Boxes className="h-3.5 w-3.5" />,
    action: 'New module',
    step: 'Group lessons with a deadline window'
  }
];

const statusVariant = (s: string) =>
  s === 'READY' ? 'green' : s === 'FAILED' ? 'red' : s === 'PENDING_UPLOAD' ? 'gray' : 'amber';

const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900';

const Row: React.FC<{
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ title, sub, right, onEdit, onDelete }) => (
  <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
    <div className="min-w-0 flex-1 basis-40">
      <p className="truncate text-sm font-medium text-zinc-900">{title}</p>
      {sub ? <div className="mt-0.5 truncate text-xs text-zinc-500">{sub}</div> : null}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {right}
      <button onClick={onEdit} className={iconBtn} aria-label={`Edit ${title}`}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}
        aria-label={`Delete ${title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  </li>
);

// Bottom-up authoring: files & questions -> submodules -> modules. Courses pick modules.
export const ContentLibraryPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('resources');
  const [dialog, setDialog] = useState<Tab | null>(null);
  const [edit, setEdit] = useState<{ tab: Tab; id: string; name: string } | null>(null);
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: ({ tab, id }: { tab: Tab; id: string; name: string }) =>
      contentApi.remove(API_TYPE[tab], id),
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryKey })
  });
  // `name` is only used for the confirm prompt
  const actions = (id: string, name: string) => ({
    onEdit: () => setEdit({ tab, id, name }),
    onDelete: () => {
      if (window.confirm(`Delete "${name}"? This cannot be undone.`))
        remove.mutate({ tab, id, name });
    }
  });
  const closeDialogs = () => {
    setDialog(null);
    setEdit(null);
  };
  const isOpen = (t: Tab) => dialog === t || edit?.tab === t;
  const editId = (t: Tab) => (edit?.tab === t ? edit.id : null);
  const lib = useQuery({
    queryKey: libraryKey,
    queryFn: contentApi.library,
    refetchInterval: 15_000
  });
  const d = lib.data;
  const current = TABS.find((t) => t.id === tab)!;

  const count: Record<Tab, number> = {
    resources: d?.resources.length || 0,
    mcqs: d?.mcqs.length || 0,
    code: d?.codeQuestions.length || 0,
    submodules: d?.submodules.length || 0,
    modules: d?.modules.length || 0
  };

  const list = (() => {
    if (!d) return null;
    switch (tab) {
      case 'resources':
        return d.resources.map((r) => (
          <Row
            key={r._id}
            {...actions(r._id, r.fileName)}
            title={r.fileName}
            sub={`${r.resourceType} · ${timeAgo(r.createdAt)}`}
            right={
              <>
                {r.drmStatus ? (
                  <Badge size="sm" variant="gray">
                    {r.drmStatus.replace('DRM_', 'DRM ').toLowerCase()}
                  </Badge>
                ) : null}
                <Badge size="sm" variant={statusVariant(r.status)} dot>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Badge>
              </>
            }
          />
        ));
      case 'mcqs':
        return d.mcqs.map((q) => (
          <Row key={q._id} {...actions(q._id, q.question)} title={q.question} sub={q.difficulty} />
        ));
      case 'code':
        return d.codeQuestions.map((q) => (
          <Row
            key={q._id}
            {...actions(q._id, q.title)}
            title={q.title}
            sub={q.difficulty}
            right={
              q.testCaseGenerationStatus === 'FAILED' ? (
                <Badge size="sm" variant="amber">
                  AI tests failed
                </Badge>
              ) : q.testCaseGenerationStatus === 'COMPLETED' ? (
                <Badge size="sm" variant="green">
                  AI tests
                </Badge>
              ) : null
            }
          />
        ));
      case 'submodules':
        return d.submodules.map((s) => (
          <Row
            key={s._id}
            {...actions(s._id, s.title)}
            title={s.title}
            sub={`${s.itemCount} item${s.itemCount === 1 ? '' : 's'}${s.description ? ` · ${s.description}` : ''}`}
          />
        ));
      case 'modules':
        return d.modules.map((m) => (
          <Row
            key={m._id}
            {...actions(m._id, m.title)}
            title={m.title}
            sub={`${m.submoduleCount} submodule${m.submoduleCount === 1 ? '' : 's'} · ${m.progressRequirement}% to stay on schedule`}
            right={
              <Badge size="sm" variant="blue">
                {m.durationDays}d window
              </Badge>
            }
          />
        ));
    }
  })();

  return (
    <div className="page space-y-6 py-6 sm:py-8">
      <PageHeader
        eyebrow="Authoring"
        title="Content library"
        description="Build bottom-up: upload files and write questions, bundle them into submodules, group those into modules, then attach modules to a course."
        actions={
          <Button onClick={() => setDialog(tab)}>
            <Plus className="h-4 w-4" /> {current.action}
          </Button>
        }
      />

      <ol className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t, i) => (
          <li key={t.id} className="shrink-0">
            <button
              onClick={() => {
                setTab(t.id);
                remove.reset();
              }}
              className={`flex min-w-[150px] flex-col items-start rounded-2xl p-3 text-left transition ${
                tab === t.id
                  ? 'bg-ink text-white shadow-lift'
                  : 'bg-white text-zinc-800 shadow-card hover:shadow-lift'
              }`}
            >
              <span className="font-mono text-[11px] text-zinc-400">Step {i + 1}</span>
              <span className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {t.icon} {t.label}
                <span className="tabular-nums text-zinc-400">{count[t.id]}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <p className="text-sm text-zinc-500">{current.step}</p>
        {remove.error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200"
          >
            {remove.error.message}
          </p>
        ) : null}
        {lib.error ? (
          <EmptyState
            title="Couldn't load the library"
            description={(lib.error as Error).message}
          />
        ) : lib.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : list && list.length ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white shadow-card">
            {list}
          </ul>
        ) : (
          <EmptyState
            title={`No ${current.label.toLowerCase()} yet`}
            description={current.step + '.'}
            action={
              <Button onClick={() => setDialog(tab)}>
                <Plus className="h-4 w-4" /> {current.action}
              </Button>
            }
          />
        )}
      </section>

      <UploadResourceDialog open={dialog === 'resources'} onClose={closeDialogs} />
      <RenameResourceDialog
        open={edit?.tab === 'resources'}
        onClose={closeDialogs}
        editId={editId('resources')}
        currentName={edit?.name || ''}
      />
      <McqDialog
        open={isOpen('mcqs')}
        onClose={closeDialogs}
        editId={editId('mcqs')}
        resources={d?.resources || []}
      />
      <CodeQuestionDialog open={isOpen('code')} onClose={closeDialogs} editId={editId('code')} />
      <SubmoduleDialog
        open={isOpen('submodules')}
        onClose={closeDialogs}
        editId={editId('submodules')}
        library={d}
      />
      <ModuleDialog
        open={isOpen('modules')}
        onClose={closeDialogs}
        editId={editId('modules')}
        library={d}
      />
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck } from 'lucide-react';
import { lmsApi } from '../../../shared/api/lms';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { FormError } from '../../auth/ui/AuthControls';
import { cn } from '../../../shared/lib/cn';

// Staff (admin panel, trainer panel, course editor): issue certificates to many learners at once.
// Learners who finished every item are preselected; staff may add others (e.g. offline sessions).
export const IssueCertificatesDialog: React.FC<{
  course: { id: string; title: string } | null;
  onClose: () => void;
}> = ({ course, onClose }) => {
  const qc = useQueryClient();
  const key = ['course-certificates', course?.id];
  const q = useQuery({
    queryKey: key,
    queryFn: () => lmsApi.courseCertificates(course!.id),
    enabled: !!course
  });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const learners = useMemo(() => q.data?.learners || [], [q.data]);
  // no certificate yet, and a name to print on one
  const open = learners.filter((l) => !l.certificate && l.name);
  const finished = open.filter((l) => l.complete);
  // default selection: everyone who finished and has no certificate yet
  useEffect(() => {
    setPicked(new Set(finished.map((l) => l.userId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const issue = useMutation({
    mutationFn: () => lmsApi.issueCertificates(course!.id, [...picked]),
    onSuccess: () => qc.invalidateQueries({ queryKey: key })
  });
  useEffect(() => issue.reset(), [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = learners.filter((l) =>
    (l.name || l.userId).toLowerCase().includes(search.trim().toLowerCase())
  );
  const unfinishedPicked = open.filter((l) => picked.has(l.userId) && !l.complete).length;
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const names = new Map(learners.map((l) => [l.userId, l.name || 'A learner']));

  return (
    <Modal
      isOpen={!!course}
      onClose={onClose}
      title="Issue certificates"
      description={course?.title}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={!picked.size || !q.data?.hasSigner}
            isLoading={issue.isPending}
            onClick={() => issue.mutate()}
          >
            Issue {picked.size || ''} certificate{picked.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <FormError message={((q.error || issue.error) as Error)?.message || null} />
          {q.data && !q.data.hasSigner ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This course has no certificate signature yet.{' '}
                <Link to={`/admin/course/${course?.id}`} className="font-medium underline">
                  Add it in the course editor
                </Link>{' '}
                first.
              </span>
            </p>
          ) : null}
          {issue.data ? (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
              <p className="font-medium">
                Issued {issue.data.issued.length} certificate
                {issue.data.issued.length === 1 ? '' : 's'}. Learners see them on the course page.
              </p>
              {issue.data.skipped.length ? (
                <ul className="mt-1 list-disc pl-5 text-emerald-800">
                  {issue.data.skipped.map((s) => (
                    <li key={s.userId}>
                      {names.get(s.userId) || s.userId}: {s.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Input
                label="Search learners"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPicked(new Set(finished.map((l) => l.userId)))}
            >
              Finished ({finished.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPicked(new Set(open.map((l) => l.userId)))}
            >
              Everyone without one ({open.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
              Clear
            </Button>
          </div>

          {unfinishedPicked ? (
            <p className="text-xs text-amber-700">
              {unfinishedPicked} selected learner{unfinishedPicked === 1 ? ' has' : 's have'} not
              finished every item; they will still get a certificate.
            </p>
          ) : null}

          <div className="custom-scrollbar max-h-[50vh] overflow-y-auto rounded-xl ring-1 ring-inset ring-zinc-200">
            {shown.length ? (
              <ul className="divide-y divide-zinc-100">
                {shown.map((l) => (
                  <li key={l.userId}>
                    <label
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-sm',
                        l.certificate || !l.name
                          ? 'cursor-default'
                          : 'cursor-pointer hover:bg-zinc-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-zinc-900"
                        disabled={!!l.certificate || !l.name}
                        checked={!!l.certificate || picked.has(l.userId)}
                        onChange={() => toggle(l.userId)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-zinc-900">
                          {l.name || (
                            <span className="text-zinc-400">
                              No name on profile: they must add one before a certificate can be
                              issued
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {l.completedItems}/{l.totalItems} items · {l.percentage}% score
                        </span>
                      </span>
                      {l.certificate ? (
                        <Link
                          to={`/verify/${l.certificate.code}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                        >
                          <BadgeCheck className="h-4 w-4" /> Issued
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            l.complete ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                          )}
                        >
                          {l.complete ? 'Finished' : 'In progress'}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-zinc-500">
                {learners.length ? 'No learner matches.' : 'No learners are enrolled yet.'}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

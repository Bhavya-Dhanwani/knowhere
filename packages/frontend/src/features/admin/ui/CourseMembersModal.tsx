import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, UserPlus } from 'lucide-react';
import { Modal } from '../../../shared/ui/Modal';
import { Input } from '../../../shared/ui/Input';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { Dropdown } from '../../../shared/ui/Dropdown';
import { IconButton } from '../../../shared/ui/IconButton';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { FormError } from '../../auth/ui/AuthControls';
import { BackendRole, Course, lmsApi } from '../../../shared/api/lms';

const roleOptions = [
  { value: 'trainee', label: 'Student' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'admin', label: 'Course admin' }
];

export const CourseMembersModal: React.FC<{ course: Course | null; onClose: () => void }> = ({
  course,
  onClose
}) => {
  const qc = useQueryClient();
  const courseId = course?.id || '';
  const [query, setQuery] = useState('');
  const [newRole, setNewRole] = useState<BackendRole>('trainee');

  const members = useQuery({
    queryKey: ['members', courseId],
    queryFn: () => lmsApi.listMembers(courseId),
    enabled: Boolean(courseId)
  });
  const users = useQuery({
    queryKey: ['users', ''],
    queryFn: () => lmsApi.listUsers(),
    enabled: Boolean(courseId)
  });

  const byId = useMemo(
    () => new Map((users.data?.users || []).map((u) => [u.id, u])),
    [users.data]
  );
  const memberIds = new Set((members.data || []).map((m) => m.userId));
  const candidates = (users.data?.users || [])
    .filter((u) => !memberIds.has(u.id))
    .filter((u) => {
      const q = query.trim().toLowerCase();
      return q && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    })
    .slice(0, 5);

  const refresh = () => qc.invalidateQueries({ queryKey: ['members', courseId] });
  const assign = useMutation({
    mutationFn: (userId: string) => lmsApi.assignMember(courseId, userId, newRole),
    onSuccess: () => {
      setQuery('');
      refresh();
    }
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: BackendRole }) =>
      lmsApi.updateMemberRole(courseId, userId, role),
    onSuccess: refresh
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => lmsApi.revokeMember(courseId, userId),
    onSuccess: refresh
  });

  const error = [assign.error, changeRole.error, revoke.error, members.error].find(Boolean) as
    Error | undefined;

  return (
    <Modal
      isOpen={Boolean(course)}
      onClose={onClose}
      title="Members"
      description={course?.title}
      maxWidth="xl"
    >
      <div className="space-y-5">
        <FormError message={error?.message} />

        <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200/70">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-zinc-700">
            <UserPlus className="h-4 w-4 text-zinc-400" /> Add people
          </p>
          <div className="flex flex-col gap-2 xs:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              icon={<Search className="h-4 w-4" />}
            />
            <Dropdown
              value={newRole}
              onChange={(v) => setNewRole(v as BackendRole)}
              options={roleOptions}
              containerClassName="xs:w-40"
              className="h-10"
            />
          </div>
          {candidates.length ? (
            <ul className="mt-2 space-y-1">
              {candidates.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl bg-white p-2 shadow-xs ring-1 ring-inset ring-zinc-200/70"
                >
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900">{u.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{u.email}</span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => assign.mutate(u.id)}
                    isLoading={assign.isPending && assign.variables === u.id}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          ) : query.trim() && !users.isLoading ? (
            <p className="mt-2 px-1 text-xs text-zinc-500">
              No matching people who aren't already members.
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700">
            Current members{' '}
            {members.data ? <span className="text-zinc-400">· {members.data.length}</span> : null}
          </p>
          {members.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : members.data?.length ? (
            <ul className="divide-y divide-zinc-100 rounded-2xl ring-1 ring-inset ring-zinc-200/70">
              {members.data.map((m) => {
                const u = byId.get(m.userId);
                const name = u?.name || `User ${m.userId.slice(-6)}`;
                return (
                  <li
                    key={m.userId}
                    className="flex flex-wrap items-center gap-3 p-2.5 sm:flex-nowrap"
                  >
                    <Avatar name={name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-900">{name}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {u?.email || m.userId}
                      </span>
                    </span>
                    <div className="flex w-full items-center gap-1.5 sm:w-auto">
                      <Dropdown
                        value={m.role}
                        onChange={(role) =>
                          changeRole.mutate({ userId: m.userId, role: role as BackendRole })
                        }
                        options={roleOptions}
                        containerClassName="flex-1 sm:w-36 sm:flex-none"
                      />
                      <IconButton
                        label="Remove member"
                        icon={<Trash2 />}
                        className="text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => revoke.mutate(m.userId)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
              No members yet. Search above to enrol learners and trainers.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

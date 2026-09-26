import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Hash, Lock, Megaphone, Trash2, Volume2 } from 'lucide-react';
import { Modal } from '../../../shared/ui/Modal';
import { Input } from '../../../shared/ui/Input';
import { Button } from '../../../shared/ui/Button';
import { Avatar } from '../../../shared/ui/Avatar';
import { cn } from '../../../shared/lib/cn';
import { FormError } from '../../auth/ui/AuthControls';
import { Channel, ChannelKind, communityApi, Member } from '../api/communityApi';

const KINDS: { id: ChannelKind; label: string; icon: typeof Hash; hint: string }[] = [
  { id: 'text', label: 'Text', icon: Hash, hint: 'Messages, files and threads' },
  { id: 'announcement', label: 'Announcements', icon: Megaphone, hint: 'Only moderators post' },
  { id: 'voice', label: 'Voice', icon: Volume2, hint: 'Talk live with audio' }
];

// create (channel = null) or edit a channel; moderators only
export const ChannelDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  courseId: string;
  channel: Channel | null;
  members: Member[];
  onSaved: () => void;
}> = ({ open, onClose, courseId, channel, members, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ChannelKind>('text');
  const [priv, setPriv] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(channel?.name || '');
    setDescription(channel?.description || '');
    setKind(channel?.kind || 'text');
    setPriv(channel?.visibility === 'private');
    setMemberIds(channel?.members.map((m) => m.userId) || []);
  }, [open, channel]);

  const save = useMutation({
    mutationFn: async () => {
      if (!channel) {
        await communityApi.createChannel(courseId, {
          name,
          description,
          kind,
          visibility: priv ? 'private' : 'public',
          memberIds: priv ? memberIds : []
        });
        return;
      }
      await communityApi.updateChannel(channel._id, {
        name,
        description,
        visibility: priv ? 'private' : 'public'
      });
      if (priv) {
        const before = new Set(channel.members.map((m) => m.userId));
        for (const id of memberIds)
          if (!before.has(id)) await communityApi.addChannelMember(channel._id, id);
        for (const id of before)
          if (!memberIds.includes(id)) await communityApi.removeChannelMember(channel._id, id);
      }
    },
    onSuccess: () => {
      onSaved();
      onClose();
    }
  });

  const remove = useMutation({
    mutationFn: () => communityApi.deleteChannel(channel!._id),
    onSuccess: () => {
      onSaved();
      onClose();
    }
  });

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={channel ? `Edit #${channel.name}` : 'Create channel'}
      maxWidth="lg"
      footer={
        <>
          {channel ? (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 sm:mr-auto"
              isLoading={remove.isPending}
              onClick={() =>
                window.confirm(
                  `Delete #${channel.name}? Its messages will no longer be visible.`
                ) && remove.mutate()
              }
            >
              <Trash2 className="h-4 w-4" /> Delete channel
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={name.trim().length < 2}
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            {channel ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError message={(save.error || remove.error)?.message} />
        {!channel ? (
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-3">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={cn(
                  'rounded-xl p-3 text-left ring-1 ring-inset transition',
                  kind === k.id
                    ? 'bg-brand-50/60 ring-2 ring-brand-500'
                    : 'ring-zinc-200 hover:ring-zinc-300'
                )}
              >
                <k.icon className="h-4 w-4 text-zinc-500" />
                <span className="mt-2 block text-sm font-medium text-zinc-900">{k.label}</span>
                <span className="block text-xs text-zinc-500">{k.hint}</span>
              </button>
            ))}
          </div>
        ) : null}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. project-help"
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this channel for?"
        />
        <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset ring-zinc-200">
          <input
            type="checkbox"
            checked={priv}
            onChange={(e) => setPriv(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
              <Lock className="h-3.5 w-3.5" /> Private channel
            </span>
            <span className="text-xs text-zinc-500">
              Only chosen members (and moderators) can see it.
            </span>
          </span>
        </label>
        {priv ? (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-zinc-700">
              Members · {memberIds.length}
            </p>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-1.5 ring-1 ring-inset ring-zinc-200/70">
              {members.map((m) => {
                const on = memberIds.includes(m.userId);
                return (
                  <li key={m.userId}>
                    <button
                      type="button"
                      onClick={() =>
                        setMemberIds((ids) =>
                          on ? ids.filter((x) => x !== m.userId) : [...ids, m.userId]
                        )
                      }
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition',
                        on ? 'bg-white shadow-card' : 'hover:bg-white/70'
                      )}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={on}
                        className="h-4 w-4 accent-brand-600"
                        tabIndex={-1}
                      />
                      <Avatar name={m.name} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                      <span className="text-xs text-zinc-400">
                        {m.role === 'trainee' ? 'student' : m.role}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

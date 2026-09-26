import React, { useState } from 'react';
import {
  Check,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  Pin,
  SmilePlus,
  Trash2,
  X
} from 'lucide-react';
import { Avatar } from '../../../shared/ui/Avatar';
import { cn } from '../../../shared/lib/cn';
import { communityApi, Message } from '../api/communityApi';
import { AttachmentView, fmtTime, MessageText } from './bits';

const QUICK = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];

interface Props {
  message: Message;
  meId: string;
  meName: string;
  moderator: boolean;
  memberNames: string[];
  compact?: boolean; // same sender as previous message
  onReply?: (m: Message) => void;
  inThread?: boolean;
  onError: (msg: string) => void;
}

export const MessageItem: React.FC<Props> = ({
  message: m,
  meId,
  meName,
  moderator,
  memberNames,
  compact,
  onReply,
  inThread,
  onError
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const [menu, setMenu] = useState(false);
  const mine = m.sender.userId === meId;
  const staff = m.sender.role === 'admin' || m.sender.role === 'trainer';

  const run = (p: Promise<unknown>) => p.catch((e: Error) => onError(e.message));

  return (
    <div
      className={cn(
        'group relative flex gap-3 rounded-xl px-2 py-1 transition hover:bg-zinc-50 sm:px-3',
        !compact && 'mt-3',
        m.mentions.includes(meId) && 'bg-amber-50/60 hover:bg-amber-50',
        m.isPinned && 'ring-1 ring-inset ring-amber-200'
      )}
    >
      <div className="w-9 shrink-0">
        {compact ? null : <Avatar name={m.sender.name} size="md" />}
      </div>
      <div className="min-w-0 flex-1">
        {!compact ? (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-zinc-900">{m.sender.name}</span>
            {staff ? (
              <span className="rounded bg-brand-50 px-1 text-[10px] font-medium uppercase text-brand-700">
                {m.sender.role === 'admin' ? 'admin' : 'trainer'}
              </span>
            ) : null}
            <span className="text-xs text-zinc-400">{fmtTime(m.createdAt)}</span>
            {m.isPinned ? <Pin className="h-3 w-3 text-amber-500" /> : null}
          </p>
        ) : null}

        {editing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false);
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  run(communityApi.editMessage(m._id, draft)).then(() => setEditing(false));
                }
              }}
              className="w-full rounded-xl bg-white px-3 py-2 text-sm ring-2 ring-brand-500 focus:outline-none"
            />
            <div className="flex gap-2 text-xs">
              <button
                onClick={() =>
                  run(communityApi.editMessage(m._id, draft)).then(() => setEditing(false))
                }
                className="inline-flex items-center gap-1 font-medium text-brand-700"
              >
                <Check className="h-3.5 w-3.5" /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 text-zinc-500"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : m.content ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-800">
            <MessageText text={m.content} names={memberNames} me={meName} />
            {m.isEdited ? <span className="ml-1 text-[11px] text-zinc-400">(edited)</span> : null}
          </p>
        ) : null}

        {m.attachments.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {m.attachments.map((a) => (
              <AttachmentView key={a.url} a={a} />
            ))}
          </div>
        ) : null}

        {m.reactions.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => run(communityApi.react(m._id, r.emoji))}
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs ring-1 ring-inset transition',
                  r.users.includes(meId)
                    ? 'bg-brand-50 text-brand-800 ring-brand-300'
                    : 'bg-white text-zinc-600 ring-zinc-200 hover:ring-zinc-300'
                )}
              >
                {r.emoji} <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {!inThread && m.replyCount > 0 ? (
          <button
            onClick={() => onReply?.(m)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            <MessageSquareReply className="h-3.5 w-3.5" /> {m.replyCount}{' '}
            {m.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        ) : null}
      </div>

      {/* actions: hover on desktop, the ••• button on touch */}
      {!editing ? (
        <div
          className={cn(
            'absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-xl bg-white p-0.5 shadow-lift transition',
            menu
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
          )}
        >
          {QUICK.slice(0, 3).map((e) => (
            <button
              key={e}
              onClick={() => run(communityApi.react(m._id, e))}
              className="grid h-7 w-7 place-items-center rounded-lg text-sm hover:bg-zinc-100"
              aria-label={`React ${e}`}
            >
              {e}
            </button>
          ))}
          <details className="relative">
            <summary
              className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              aria-label="More reactions"
            >
              <SmilePlus className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 top-8 flex gap-0.5 rounded-xl bg-white p-1 shadow-lift">
              {QUICK.slice(3).map((e) => (
                <button
                  key={e}
                  onClick={() => run(communityApi.react(m._id, e))}
                  className="grid h-7 w-7 place-items-center rounded-lg text-sm hover:bg-zinc-100"
                >
                  {e}
                </button>
              ))}
            </div>
          </details>
          {!inThread && onReply ? (
            <button
              onClick={() => onReply(m)}
              className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              aria-label="Reply in thread"
            >
              <MessageSquareReply className="h-4 w-4" />
            </button>
          ) : null}
          {mine && m.content ? (
            <button
              onClick={() => {
                setDraft(m.content);
                setEditing(true);
                setMenu(false);
              }}
              className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              aria-label="Edit message"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {moderator ? (
            <button
              onClick={() => run(communityApi.pin(m._id))}
              className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              aria-label={m.isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="h-4 w-4" />
            </button>
          ) : null}
          {mine || moderator ? (
            <button
              onClick={() =>
                window.confirm('Delete this message?') && run(communityApi.deleteMessage(m._id))
              }
              className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Delete message"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        onClick={() => setMenu((v) => !v)}
        className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-lg text-zinc-400 hover:bg-zinc-100 sm:hidden"
        aria-label="Message actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
};

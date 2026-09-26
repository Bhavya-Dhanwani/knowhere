import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Lock, Megaphone, X } from 'lucide-react';
import { Spinner } from '../../../shared/ui/Spinner';
import { Access, Channel, communityApi, Member, Message } from '../api/communityApi';
import { getSocket, request } from '../api/socket';
import { Composer } from './Composer';
import { MessageItem } from './MessageItem';

interface Common {
  courseId: string;
  access: Access;
  members: Member[];
  me: { id: string; name: string };
  onError: (msg: string) => void;
}

const sameGroup = (a: Message | undefined, b: Message) =>
  a &&
  a.sender.userId === b.sender.userId &&
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() < 5 * 60_000;

// keeps a message list in sync with socket events for one channel
function useLiveMessages(roomId: string, key: unknown[], accept: (m: Message) => boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    const s = getSocket();
    const upsert = (m: Message) =>
      qc.setQueryData<Message[]>(key, (list) => {
        if (!list || m.roomId !== roomId) return list;
        const i = list.findIndex((x) => x._id === m._id);
        if (i >= 0) return list.map((x) => (x._id === m._id ? m : x));
        return accept(m) ? [...list, m] : list;
      });
    const updated = (m: Message) =>
      qc.setQueryData<Message[]>(key, (list) => list?.map((x) => (x._id === m._id ? m : x)));
    const removed = (e: { messageId: string; roomId: string }) =>
      qc.setQueryData<Message[]>(key, (list) => list?.filter((x) => x._id !== e.messageId));
    s.on('message:new', upsert);
    s.on('message:updated', updated);
    s.on('message:deleted', removed);
    return () => {
      s.off('message:new', upsert);
      s.off('message:updated', updated);
      s.off('message:deleted', removed);
    };
  }, [qc, roomId, JSON.stringify(key)]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const ChannelView: React.FC<
  Common & { channel: Channel; onOpenThread: (m: Message) => void }
> = ({ channel, courseId, access, members, me, onError, onOpenThread }) => {
  const key = ['messages', channel._id];
  const q = useQuery({ queryKey: key, queryFn: () => communityApi.messages(channel._id) });
  const [older, setOlder] = useState<Message[]>([]);
  const [noMore, setNoMore] = useState(false);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useLiveMessages(channel._id, key, (m) => !m.replyTo);

  // join the channel's socket room, mark it read while it's open
  useEffect(() => {
    setOlder([]);
    setNoMore(false);
    request('channel:join', { roomId: channel._id }).catch((e) => onError(e.message));
    communityApi.markRead(channel._id).catch(() => undefined);
    const s = getSocket();
    const onNew = (m: Message) =>
      m.roomId === channel._id && communityApi.markRead(channel._id).catch(() => undefined);
    const onTyping = (e: { roomId: string; userId: string; userName: string; isTyping: boolean }) =>
      e.roomId === channel._id &&
      setTyping((t) => {
        const next = { ...t };
        if (e.isTyping) next[e.userId] = e.userName;
        else delete next[e.userId];
        return next;
      });
    s.on('message:new', onNew);
    s.on('user:typing', onTyping);
    return () => {
      s.off('message:new', onNew);
      s.off('user:typing', onTyping);
      request('channel:leave', { roomId: channel._id }).catch(() => undefined);
      setTyping({});
    };
  }, [channel._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = [...older, ...(q.data || [])];

  // stick to the bottom when new messages arrive, unless the user scrolled up
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [all.length]);

  const loadOlder = async () => {
    const first = all[0];
    if (!first) return;
    const el = scroller.current!;
    const h = el.scrollHeight;
    const page = await communityApi.messages(channel._id, first._id);
    if (page.length < 50) setNoMore(true);
    setOlder((o) => [...page, ...o]);
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - h));
  };

  const Icon =
    channel.visibility === 'private' ? Lock : channel.kind === 'announcement' ? Megaphone : Hash;
  const names = members.map((m) => m.name);
  const typers = Object.values(typing);
  const readOnly =
    channel.kind === 'announcement' && !access.moderator
      ? 'Only instructors can post announcements.'
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-4 sm:px-3"
      >
        {q.isLoading ? (
          <Spinner className="py-20" />
        ) : (
          <>
            {!noMore && all.length >= 50 ? (
              <div className="flex justify-center py-2">
                <button
                  onClick={loadOlder}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
                >
                  Load older messages
                </button>
              </div>
            ) : (
              <div className="px-3 pb-4 pt-6">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-lg font-semibold text-zinc-900">
                  Welcome to #{channel.name}
                </h3>
                <p className="text-sm text-zinc-500">
                  {channel.description || 'This is the start of the channel.'}
                </p>
              </div>
            )}
            {all.map((m, i) => (
              <MessageItem
                key={m._id}
                message={m}
                meId={me.id}
                meName={me.name}
                moderator={access.moderator}
                memberNames={names}
                compact={Boolean(sameGroup(all[i - 1], m))}
                onReply={onOpenThread}
                onError={onError}
              />
            ))}
          </>
        )}
      </div>
      <div className="shrink-0 px-2 pb-2 sm:px-4 sm:pb-4">
        <p className="h-5 truncate px-2 text-xs text-zinc-500">
          {typers.length
            ? `${typers.slice(0, 3).join(', ')} ${typers.length === 1 ? 'is' : 'are'} typing…`
            : ''}
        </p>
        <Composer
          courseId={courseId}
          roomId={channel._id}
          members={members.filter((m) => m.userId !== me.id)}
          placeholder={`Message #${channel.name}`}
          disabled={readOnly}
          onError={onError}
        />
      </div>
    </div>
  );
};

export const ThreadPanel: React.FC<
  Common & { root: Message; roomId: string; onClose: () => void }
> = ({ root, roomId, courseId, access, members, me, onError, onClose }) => {
  const key = ['thread', root._id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await communityApi.thread(root._id)).replies
  });
  const rootQ = useQuery({
    queryKey: ['thread-root', root._id],
    queryFn: async () => (await communityApi.thread(root._id)).root,
    initialData: root
  });
  useLiveMessages(roomId, key, (m) => m.replyTo?.messageId === root._id);
  const names = members.map((m) => m.name);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200/70 px-4">
        <p className="text-sm font-semibold text-zinc-900">Thread</p>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
          aria-label="Close thread"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2 sm:px-2">
        <MessageItem
          message={rootQ.data || root}
          meId={me.id}
          meName={me.name}
          moderator={access.moderator}
          memberNames={names}
          inThread
          onError={onError}
        />
        <p className="my-3 flex items-center gap-2 px-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" /> {q.data?.length || 0}{' '}
          {q.data?.length === 1 ? 'reply' : 'replies'} <span className="h-px flex-1 bg-zinc-200" />
        </p>
        {(q.data || []).map((m, i, list) => (
          <MessageItem
            key={m._id}
            message={m}
            meId={me.id}
            meName={me.name}
            moderator={access.moderator}
            memberNames={names}
            compact={Boolean(sameGroup(list[i - 1], m))}
            inThread
            onError={onError}
          />
        ))}
      </div>
      <div className="shrink-0 p-2 sm:p-3">
        <Composer
          courseId={courseId}
          roomId={roomId}
          replyToId={root._id}
          members={members.filter((m) => m.userId !== me.id)}
          placeholder="Reply in thread…"
          onError={onError}
        />
      </div>
    </div>
  );
};

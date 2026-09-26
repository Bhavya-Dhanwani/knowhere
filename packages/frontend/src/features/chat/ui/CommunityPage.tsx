import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Hash,
  Lock,
  Megaphone,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  Volume2,
  X
} from 'lucide-react';
import { RootState } from '../../../app/store';
import { lmsApi } from '../../../shared/api/lms';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui/Avatar';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Spinner } from '../../../shared/ui/Spinner';
import { Channel, communityApi, Member, Message } from '../api/communityApi';
import { getSocket, request } from '../api/socket';
import { ChannelView, ThreadPanel } from './ChannelView';
import { ChannelDialog } from './ChannelDialog';
import { VoiceParticipant, VoiceRoom } from './VoiceRoom';
import { fmtTime } from './bits';

type Panel = 'members' | 'search' | 'thread' | null;

const channelIcon = (c: Channel) =>
  c.kind === 'voice'
    ? Volume2
    : c.kind === 'announcement'
      ? Megaphone
      : c.visibility === 'private'
        ? Lock
        : Hash;

export const CommunityPage: React.FC = () => {
  const { id: courseId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const user = useSelector((s: RootState) => s.auth.user);
  const me = { id: user?.id || '', name: user?.name || '' };

  const course = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => lmsApi.getCourse(courseId)
  });
  const community = useQuery({
    queryKey: ['community', courseId],
    queryFn: () => communityApi.community(courseId)
  });
  const members = useQuery({
    queryKey: ['community-members', courseId],
    queryFn: () => communityApi.members(courseId),
    enabled: community.isSuccess
  });

  const [online, setOnline] = useState<string[]>([]);
  const [voice, setVoice] = useState<Record<string, VoiceParticipant[]>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [thread, setThread] = useState<Message | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState<{ channel: Channel | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);

  const channels = community.data?.channels || [];
  const activeId =
    params.get('c') || channels.find((c) => c.kind === 'text')?._id || channels[0]?._id;
  const active = channels.find((c) => c._id === activeId);

  useEffect(() => {
    if (community.data) setOnline(community.data.onlineUserIds);
  }, [community.data]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  // community-wide realtime: presence, unread activity, channel changes, voice rosters
  useEffect(() => {
    const s = getSocket();
    const join = () => request('community:join', { courseId }).catch((e) => setError(e.message));
    join();
    s.on('connect', join);
    const onPresence = (e: { courseId: string; onlineUserIds: string[] }) =>
      e.courseId === courseId && setOnline(e.onlineUserIds);
    const onActivity = (e: {
      courseId: string;
      roomId: string;
      senderId: string;
      isReply: boolean;
    }) => {
      if (e.courseId !== courseId || e.senderId === me.id || e.isReply) return;
      qc.setQueryData<typeof community.data>(
        ['community', courseId],
        (d) =>
          d && {
            ...d,
            channels: d.channels.map((c) =>
              c._id === e.roomId && c._id !== activeRef.current ? { ...c, unread: c.unread + 1 } : c
            )
          }
      );
    };
    const onChanged = (e: { courseId: string }) =>
      e.courseId === courseId && qc.invalidateQueries({ queryKey: ['community', courseId] });
    const onVoice = (e: { roomId: string; participants: VoiceParticipant[] }) =>
      setVoice((v) => ({ ...v, [e.roomId]: e.participants }));
    s.on('presence', onPresence);
    s.on('channel:activity', onActivity);
    s.on('channel:changed', onChanged);
    s.on('voice:participants', onVoice);
    return () => {
      s.off('connect', join);
      s.off('presence', onPresence);
      s.off('channel:activity', onActivity);
      s.off('channel:changed', onChanged);
      s.off('voice:participants', onVoice);
      request('community:leave', { courseId }).catch(() => undefined);
    };
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRef = React.useRef(activeId);
  activeRef.current = activeId;

  const open = (c: Channel) => {
    setParams({ c: c._id }, { replace: true });
    setDrawer(false);
    setThread(null);
    if (panel === 'thread') setPanel(null);
    qc.setQueryData<typeof community.data>(
      ['community', courseId],
      (d) =>
        d && { ...d, channels: d.channels.map((x) => (x._id === c._id ? { ...x, unread: 0 } : x)) }
    );
  };

  const memberList = useMemo(
    () => (members.data || []).map((m) => ({ ...m, online: online.includes(m.userId) })),
    [members.data, online]
  );

  if (community.error) {
    return (
      <div className="page py-10">
        <EmptyState
          icon={<Lock />}
          title="You can't open this community"
          description={(community.error as Error).message}
          action={
            <Link to="/chat" className="text-sm font-medium text-brand-700">
              Back to communities
            </Link>
          }
        />
      </div>
    );
  }
  if (community.isLoading || !community.data) return <Spinner className="py-24" />;

  const access = community.data.access;
  const groups: [string, Channel[]][] = [
    ['Text channels', channels.filter((c) => c.kind !== 'voice')],
    ['Voice', channels.filter((c) => c.kind === 'voice')]
  ];

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zinc-200/70 p-3">
        <Link
          to="/chat"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Communities
        </Link>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">
          {course.data?.title || 'Course community'}
        </p>
        <p className="text-xs text-zinc-500">
          {online.length} online · {access.moderator ? 'moderator' : 'member'}
        </p>
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
        {groups.map(([title, list]) => (
          <div key={title}>
            <div className="flex items-center justify-between px-2 pb-1">
              <p className="eyebrow">{title}</p>
              {access.moderator && title === 'Text channels' ? (
                <button
                  onClick={() => setDialog({ channel: null })}
                  className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
                  aria-label="Create channel"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <ul className="space-y-0.5">
              {list.map((c) => {
                const Icon = channelIcon(c);
                const current = c._id === activeId;
                const unread = current ? 0 : c.unread; // the open channel is being read
                const inVoice = voice[c._id] || [];
                return (
                  <li key={c._id}>
                    <div
                      className={cn(
                        'group flex items-center rounded-lg transition',
                        current ? 'bg-white shadow-card' : 'hover:bg-zinc-200/50'
                      )}
                    >
                      <button
                        onClick={() => open(c)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            current ? 'text-brand-600' : 'text-zinc-400'
                          )}
                        />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            unread
                              ? 'font-semibold text-zinc-900'
                              : current
                                ? 'text-zinc-900'
                                : 'text-zinc-600'
                          )}
                        >
                          {c.name}
                        </span>
                        {unread ? (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        ) : null}
                      </button>
                      {access.moderator ? (
                        <button
                          onClick={() => setDialog({ channel: c })}
                          className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-400 opacity-0 transition hover:text-zinc-700 group-hover:opacity-100"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    {inVoice.length ? (
                      <ul className="ml-7 mt-0.5 space-y-0.5">
                        {inVoice.map((p) => (
                          <li
                            key={p.socketId}
                            className="flex items-center gap-1.5 text-xs text-zinc-500"
                          >
                            <Avatar name={p.name} size="xs" />{' '}
                            <span className="truncate">{p.name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  const side =
    panel === 'thread' && thread && active ? (
      <ThreadPanel
        root={thread}
        roomId={active._id}
        courseId={courseId}
        access={access}
        members={memberList}
        me={me}
        onError={setError}
        onClose={() => setPanel(null)}
      />
    ) : panel === 'members' ? (
      <MembersPanel members={memberList} onClose={() => setPanel(null)} onOpen={setProfile} />
    ) : panel === 'search' ? (
      <SearchPanel
        courseId={courseId}
        channels={channels}
        onClose={() => setPanel(null)}
        onPick={(roomId) => {
          const c = channels.find((x) => x._id === roomId);
          if (c) open(c);
        }}
      />
    ) : null;

  return (
    <div className="flex h-shell min-h-0 bg-canvas">
      {/* channels: sidebar on desktop, drawer on phones */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200/70 bg-zinc-50/70 md:block">
        {sidebar}
      </aside>
      <AnimatePresence>
        {drawer ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              className="absolute inset-0 bg-zinc-950/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 left-0 w-[min(18rem,86vw)] bg-zinc-50 shadow-2xl"
            >
              {sidebar}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200/70 bg-white/70 px-2 backdrop-blur sm:px-4">
          <button
            onClick={() => setDrawer(true)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 md:hidden"
            aria-label="Channels"
          >
            <Menu className="h-4 w-4" />
          </button>
          {active ? (
            <>
              {React.createElement(channelIcon(active), {
                className: 'h-4 w-4 shrink-0 text-zinc-400'
              })}
              <p className="min-w-0 truncate text-sm font-semibold text-zinc-900">{active.name}</p>
              <p className="hidden min-w-0 truncate text-xs text-zinc-500 lg:block">
                {active.description}
              </p>
            </>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              onClick={() => setPanel(panel === 'search' ? null : 'search')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg hover:bg-zinc-100',
                panel === 'search' ? 'text-brand-600' : 'text-zinc-500'
              )}
              aria-label="Search messages"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPanel(panel === 'members' ? null : 'members')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg hover:bg-zinc-100',
                panel === 'members' ? 'text-brand-600' : 'text-zinc-500'
              )}
              aria-label="Members"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            {!active ? (
              <EmptyState title="No channels yet" className="m-4" />
            ) : active.kind === 'voice' ? (
              <VoiceRoom
                channel={active}
                participants={voice[active._id] || []}
                onError={setError}
              />
            ) : (
              <ChannelView
                key={active._id}
                channel={active}
                courseId={courseId}
                access={access}
                members={memberList}
                me={me}
                onError={setError}
                onOpenThread={(m) => {
                  setThread(m);
                  setPanel('thread');
                }}
              />
            )}
          </div>
          {side ? (
            <aside className="absolute inset-0 z-20 flex flex-col bg-white lg:static lg:w-80 lg:shrink-0 lg:border-l lg:border-zinc-200/70">
              {side}
            </aside>
          ) : null}
        </div>
      </main>

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-sm rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lift"
            role="alert"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ChannelDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        courseId={courseId}
        channel={dialog?.channel || null}
        members={memberList.filter((m) => m.userId !== me.id)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['community', courseId] })}
      />
      <ProfileCard member={profile} onClose={() => setProfile(null)} />
    </div>
  );
};

const PanelHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200/70 px-4">
    <p className="text-sm font-semibold text-zinc-900">{title}</p>
    <button
      onClick={onClose}
      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
      aria-label="Close panel"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

const roleLabel = { admin: 'Course admins', trainer: 'Trainers', trainee: 'Students' } as const;

const MembersPanel: React.FC<{
  members: Member[];
  onClose: () => void;
  onOpen: (m: Member) => void;
}> = ({ members, onClose, onOpen }) => (
  <>
    <PanelHeader title={`Members · ${members.length}`} onClose={onClose} />
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
      {(['admin', 'trainer', 'trainee'] as const).map((role) => {
        const list = members
          .filter((m) => m.role === role)
          .sort((a, b) => Number(b.online) - Number(a.online));
        if (!list.length) return null;
        return (
          <div key={role}>
            <p className="eyebrow px-2 pb-1">
              {roleLabel[role]} · {list.length}
            </p>
            {list.map((m) => (
              <button
                key={m.userId}
                onClick={() => onOpen(m)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-100"
              >
                <span className="relative">
                  <Avatar name={m.name} size="sm" />
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                      m.online ? 'bg-emerald-500' : 'bg-zinc-300'
                    )}
                  />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    m.online ? 'text-zinc-900' : 'text-zinc-500'
                  )}
                >
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  </>
);

const ProfileCard: React.FC<{ member: Member | null; onClose: () => void }> = ({
  member,
  onClose
}) => (
  <AnimatePresence>
    {member ? (
      <div className="fixed inset-0 z-[80] grid place-items-center p-4">
        <motion.div
          className="absolute inset-0 bg-zinc-950/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="relative w-full max-w-xs overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <div className="h-16 bg-gradient-to-r from-brand-500 to-fuchsia-500" />
          <div className="-mt-8 p-5 pt-0">
            <Avatar name={member.name} size="xl" className="ring-4 ring-white" />
            <p className="mt-2 text-lg font-semibold text-zinc-900">{member.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  member.online ? 'bg-emerald-500' : 'bg-zinc-300'
                )}
              />
              {member.online ? 'Online' : 'Offline'} ·{' '}
              {member.role === 'trainee'
                ? 'Student'
                : member.role === 'admin'
                  ? 'Course admin'
                  : 'Trainer'}
            </p>
            {member.bio ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{member.bio}</p>
            ) : null}
          </div>
        </motion.div>
      </div>
    ) : null}
  </AnimatePresence>
);

const SearchPanel: React.FC<{
  courseId: string;
  channels: Channel[];
  onClose: () => void;
  onPick: (roomId: string) => void;
}> = ({ courseId, channels, onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const res = useQuery({
    queryKey: ['community-search', courseId, term],
    queryFn: () => communityApi.search(courseId, term),
    enabled: term.length >= 2
  });
  const nameOf = (id: string) => channels.find((c) => c._id === id)?.name || 'channel';

  return (
    <>
      <PanelHeader title="Search" onClose={onClose} />
      <form
        className="border-b border-zinc-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search messages…"
          className="h-10 w-full rounded-xl bg-zinc-100 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {res.isFetching ? <Spinner className="py-8" /> : null}
        {res.data?.length === 0 ? (
          <p className="p-4 text-center text-sm text-zinc-500">No messages found.</p>
        ) : null}
        {(res.data || []).map((m) => (
          <button
            key={m._id}
            onClick={() => onPick(m.roomId)}
            className="block w-full rounded-xl p-3 text-left hover:bg-zinc-50"
          >
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Hash className="h-3 w-3" /> {nameOf(m.roomId)} · {fmtTime(m.createdAt)}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{m.sender.name}</p>
            <p className="line-clamp-3 text-sm text-zinc-600">{m.content}</p>
          </button>
        ))}
      </div>
    </>
  );
};

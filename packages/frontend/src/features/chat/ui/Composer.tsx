import React, { useMemo, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui/Avatar';
import { Attachment, communityApi, Member } from '../api/communityApi';
import { getSocket, request } from '../api/socket';

interface Props {
  courseId: string;
  roomId: string;
  placeholder: string;
  members: Member[];
  replyToId?: string;
  disabled?: string; // reason the composer is read-only
  onError: (msg: string) => void;
}

// Enter sends, Shift+Enter adds a line. Typing "@" opens member suggestions.
export const Composer: React.FC<Props> = ({
  courseId,
  roomId,
  placeholder,
  members,
  replyToId,
  disabled,
  onError
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentioned, setMentioned] = useState<Member[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number>();

  const suggestions = useMemo(
    () =>
      query === null
        ? []
        : members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
    [members, query]
  );

  const typing = (isTyping: boolean) => getSocket().emit('message:typing', { roomId, isTyping });

  const onChange = (v: string) => {
    setText(v);
    const upto = v.slice(0, ref.current?.selectionStart ?? v.length);
    const match = upto.match(/(?:^|\s)@([\w ]{0,30})$/);
    setQuery(match ? match[1] : null);
    setCursor(0);
    typing(true);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => typing(false), 2500);
  };

  const pick = (m: Member) => {
    const el = ref.current!;
    const pos = el.selectionStart;
    const before = text.slice(0, pos).replace(/@([\w ]{0,30})$/, `@${m.name} `);
    setText(before + text.slice(pos));
    setMentioned((prev) => (prev.some((p) => p.userId === m.userId) ? prev : [...prev, m]));
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const send = async () => {
    if (sending || uploading || (!text.trim() && !files.length)) return;
    setSending(true);
    try {
      await request('message:send', {
        roomId,
        content: text,
        attachments: files,
        replyToId,
        mentions: mentioned.filter((m) => text.includes(`@${m.name}`)).map((m) => m.userId)
      });
      setText('');
      setFiles([]);
      setMentioned([]);
      typing(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, 5)) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB.`);
        const a = await communityApi.upload(courseId, f);
        setFiles((prev) => [...prev, a]);
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (disabled) {
    return (
      <p className="rounded-xl bg-zinc-100 px-4 py-3 text-center text-sm text-zinc-500">
        {disabled}
      </p>
    );
  }

  return (
    <div className="relative">
      {suggestions.length ? (
        <ul className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-white p-1 shadow-lift">
          {suggestions.map((m, i) => (
            <li key={m.userId}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
                  i === cursor ? 'bg-zinc-100' : ''
                )}
              >
                <Avatar name={m.name} size="xs" />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-xs text-zinc-400">
                  {m.role === 'trainee' ? 'student' : m.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-2xl bg-white shadow-card focus-within:ring-2 focus-within:ring-brand-500">
        {files.length ? (
          <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 p-2">
            {files.map((f) => (
              <span
                key={f.url}
                className="inline-flex max-w-[200px] items-center gap-1 rounded-lg bg-zinc-100 py-1 pl-2 pr-1 text-xs text-zinc-700"
              >
                <span className="truncate">{f.name}</span>
                <button
                  onClick={() => setFiles((p) => p.filter((x) => x.url !== f.url))}
                  aria-label="Remove attachment"
                  className="grid h-4 w-4 place-items-center rounded hover:bg-zinc-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-1 p-1.5">
          <label
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100"
            aria-label="Attach files"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => upload(e.target.files)}
            />
          </label>
          <textarea
            ref={ref}
            value={text}
            rows={1}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                setCursor(
                  (c) =>
                    (c + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length
                );
              } else if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) {
                e.preventDefault();
                pick(suggestions[cursor]);
              } else if (e.key === 'Escape') setQuery(null);
              else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-40 min-h-[36px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-zinc-400"
            style={{ height: `${Math.min(160, 36 + (text.split('\n').length - 1) * 22)}px` }}
          />
          <button
            onClick={send}
            disabled={sending || uploading || (!text.trim() && !files.length)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-white transition hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

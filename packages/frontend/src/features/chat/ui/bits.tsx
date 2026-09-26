import React, { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { Attachment, communityApi } from '../api/communityApi';

export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
};

export const fmtSize = (n = 0) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

// community files need the bearer token, so they are fetched and shown as blob URLs
function useBlobUrl(url: string) {
  const [blob, setBlob] = useState<string | null>(null);
  useEffect(() => {
    let created: string | null = null;
    let cancelled = false;
    communityApi
      .fileBlobUrl(url)
      .then((u) => {
        created = u;
        if (!cancelled) setBlob(u);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);
  return blob;
}

export const AttachmentView: React.FC<{ a: Attachment }> = ({ a }) => {
  const blob = useBlobUrl(a.url);
  if (a.type === 'image') {
    return blob ? (
      <a href={blob} target="_blank" rel="noreferrer" className="block">
        <img
          src={blob}
          alt={a.name}
          className="max-h-72 max-w-full rounded-xl ring-1 ring-zinc-200"
        />
      </a>
    ) : (
      <div className="h-40 w-56 max-w-full animate-pulse rounded-xl bg-zinc-100" />
    );
  }
  if (a.type === 'video' && blob) {
    return <video src={blob} controls className="max-h-72 max-w-full rounded-xl" />;
  }
  return (
    <a
      href={blob || undefined}
      download={a.name}
      className="flex max-w-xs items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-zinc-200 transition hover:ring-zinc-300"
    >
      <FileText className="h-5 w-5 shrink-0 text-sky-600" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-900">{a.name}</span>
        <span className="block text-xs text-zinc-500">{fmtSize(a.sizeBytes)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 text-zinc-400" />
    </a>
  );
};

// renders "@Name" tokens for mentioned members as highlighted chips
export const MessageText: React.FC<{ text: string; names: string[]; me?: string }> = ({
  text,
  names,
  me
}) => {
  if (!names.length) return <>{text}</>;
  const escaped = [...names]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@') && names.includes(p.slice(1)) ? (
          <span
            key={i}
            className={`rounded px-0.5 font-medium ${p.slice(1) === me ? 'bg-amber-100 text-amber-900' : 'bg-brand-50 text-brand-700'}`}
          >
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
};

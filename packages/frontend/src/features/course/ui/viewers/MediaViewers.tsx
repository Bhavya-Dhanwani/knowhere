import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type HlsType from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { Spinner } from '../../../../shared/ui/Spinner';
import { Button } from '../../../../shared/ui/Button';
import { useParams } from 'react-router';
import { contentApi, OutlineItem } from '../../api/contentApi';
import { RootState, store } from '../../../../app/store';

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-lift">
    {children}
  </div>
);

// Encrypted videos play as AES-128 HLS through hls.js: our API serves the playlist and the key
// (bearer token attached), segments come from short-lived signed storage URLs. Videos still
// being packaged fall back to the authenticated byte stream.
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
const sameOrigin = (url: string) =>
  new URL(url, window.location.href).origin === window.location.origin;

export const VideoViewer: React.FC<{ item: OutlineItem }> = ({ item }) => {
  const { id: courseId = '' } = useParams();
  const email = useSelector((s: RootState) => s.auth.user?.email) || '';
  const encrypted = item.meta.drmStatus === 'DRM_READY';
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    const el = video.current;
    if (!el) return;

    if (encrypted) {
      // hls.js (~500KB) is only fetched when an encrypted video actually plays
      let hls: HlsType | null = null;
      let cancelled = false;
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError(
            'This browser cannot play encrypted video. Try a recent Chrome, Edge, Firefox or Safari.'
          );
          return;
        }
        const player = new Hls({
          // our API needs the bearer token; segment links carry their own signed token and
          // redirect to storage, so they go out without it
          xhrSetup: (xhr, u) => {
            const token = store.getState().auth.accessToken;
            if (token && sameOrigin(u) && !u.includes('/seg/')) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          }
        });
        hls = player;
        player.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          const status = (data.response as { code?: number } | undefined)?.code;
          setError(
            status === 403
              ? 'You do not have access to this video.'
              : status === 401
                ? 'Your session expired. Reload the video.'
                : 'Playback failed. Reload the video.'
          );
          player.destroy();
        });
        player.loadSource(
          `${apiBase}/course/video/${item.refId}/hls.m3u8?courseId=${encodeURIComponent(courseId)}`
        );
        player.attachMedia(el);
      });
      return () => {
        cancelled = true;
        hls?.destroy();
      };
    }

    // not packaged yet: stream the original upload through a short-lived signed URL
    let cancelled = false;
    setUrl(null);
    contentApi
      .videoSource(item.refId, courseId)
      .then((u) => !cancelled && setUrl(u))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [item.refId, courseId, encrypted, attempt]);

  return (
    <Frame>
      <video
        ref={video}
        src={encrypted ? undefined : url || undefined}
        controls
        controlsList="nodownload"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 h-full w-full"
      />
      {email ? <Watermark text={email} /> : null}
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-zinc-950/90 p-6 text-center text-sm text-zinc-300">
          <div>
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
            <p className="mt-2">{error}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Reload video
            </Button>
          </div>
        </div>
      ) : !encrypted && !url ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Spinner />
        </div>
      ) : null}
    </Frame>
  );
};

// the viewer's email drifts across the frame so a screen recording names its source
const Watermark: React.FC<{ text: string }> = ({ text }) => {
  const [pos, setPos] = useState({ x: 8, y: 10 });
  useEffect(() => {
    const t = window.setInterval(
      () => setPos({ x: 4 + Math.random() * 60, y: 6 + Math.random() * 70 }),
      12_000
    );
    return () => window.clearInterval(t);
  }, []);
  return (
    <span
      aria-hidden
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      className="pointer-events-none absolute select-none whitespace-nowrap text-[10px] font-medium text-white/35 transition-all duration-[2000ms] sm:text-xs"
    >
      {text}
    </span>
  );
};

// PDFs and images render inline; other files (docx, xlsx…) are offered as a download.
export const ResourceViewer: React.FC<{ item: OutlineItem }> = ({ item }) => {
  const { id: courseId = '' } = useParams();
  const q = useQuery({
    queryKey: ['resource', item.refId],
    queryFn: () => contentApi.resource(item.refId, courseId),
    staleTime: 4 * 60_000 // download URLs live 5 minutes
  });

  if (q.isLoading) return <Spinner className="py-16" />;
  if (q.error || !q.data) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
        {(q.error as Error)?.message || 'This file is not available yet.'}
      </p>
    );
  }

  const r = q.data;
  const isPdf = r.mimeType === 'application/pdf' || r.resourceType === 'pdf';
  const isImage = r.mimeType.startsWith('image/') || r.resourceType === 'image';

  return (
    <div className="space-y-4">
      {isPdf ? (
        <iframe
          src={r.downloadUrl}
          title={r.fileName}
          className="h-[70vh] w-full rounded-2xl bg-white shadow-card"
        />
      ) : isImage ? (
        <img
          src={r.downloadUrl}
          alt={r.fileName}
          className="mx-auto max-h-[70vh] rounded-2xl shadow-card"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-card">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600">
            <FileText className="h-5 w-5" />
          </span>
          <p className="break-all text-sm font-medium text-zinc-900">{r.fileName}</p>
          <p className="text-xs text-zinc-500">{r.mimeType}</p>
        </div>
      )}
      <a href={r.downloadUrl} target="_blank" rel="noreferrer" download={r.fileName}>
        <Button variant="outline">
          <Download className="h-4 w-4" /> Download
        </Button>
      </a>
    </div>
  );
};

import { useEffect } from 'react';
import { store } from '../../app/store';

// Learner-behaviour tracker: events are batched and sent every 10s, and when the tab hides or
// closes (keepalive), to /course/coach/activity. The server keeps them only for courses the
// learner belongs to; the AI coach reads them back as a behaviour profile.
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

interface TrackEvent {
  type: string;
  courseId: string;
  itemId?: string;
  data: Record<string, unknown>;
  at: string;
}

let queue: TrackEvent[] = [];
let timer: number | undefined;

export function track(
  type: string,
  courseId: string | undefined,
  itemId?: string,
  data: Record<string, unknown> = {}
) {
  if (!courseId) return;
  queue.push({
    type,
    courseId,
    itemId,
    // the learner's local hour: when they study, in their own day
    data: { ...data, localHour: new Date().getHours() },
    at: new Date().toISOString()
  });
  if (queue.length >= 50) flush();
  else if (!timer) timer = window.setTimeout(flush, 10_000);
}

export function flush() {
  window.clearTimeout(timer);
  timer = undefined;
  const token = store.getState().auth.accessToken;
  while (queue.length) {
    const events = queue.splice(0, 100);
    if (!token) continue;
    fetch(`${apiBase}/course/coach/activity`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events })
    }).catch(() => {
      // tracking never gets in the learner's way
    });
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

// Records opening an item and the time it is actually on screen (tab visible), in chunks of
// at most a minute so a closed tab still counts.
// ponytail: visible = studying; add idle detection if left-open tabs skew the numbers
export function useDwell(courseId?: string, itemId?: string) {
  useEffect(() => {
    if (!courseId || !itemId) return;
    track('ITEM_VIEW', courseId, itemId);
    let active = 0;
    let since = document.visibilityState === 'visible' ? Date.now() : 0;
    const stop = () => {
      if (since) active += Date.now() - since;
      since = 0;
    };
    const emit = () => {
      stop();
      if (active >= 1000) track('ITEM_DWELL', courseId, itemId, { activeMs: active });
      active = 0;
      if (document.visibilityState === 'visible') since = Date.now();
    };
    const onVisibility = () =>
      document.visibilityState === 'visible' ? (since = since || Date.now()) : stop();
    const onHide = () => {
      emit();
      flush();
    };
    const tick = window.setInterval(emit, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      emit();
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    };
  }, [courseId, itemId]);
}

// Video behaviour: watched ranges (coverage, rewatching), seeks (skips / rewinds), pauses,
// playback speed and completion. Returns a cleanup for the element's listeners.
export function trackVideo(el: HTMLVideoElement, courseId: string, itemId: string) {
  let start: number | null = null;
  let last = 0;
  let ranges: [number, number][] = [];
  const r = (n: number) => Math.round(n * 10) / 10;
  const close = (end = el.currentTime) => {
    if (start !== null && end > start + 0.5) ranges.push([r(start), r(end)]);
    start = null;
  };
  const sendWatch = () => {
    const playing = start !== null;
    close();
    if (ranges.length) {
      track('VIDEO_WATCH', courseId, itemId, {
        ranges,
        rate: el.playbackRate,
        duration: r(el.duration || 0)
      });
      ranges = [];
    }
    if (playing && !el.paused) start = el.currentTime;
  };
  const handlers: [string, () => void][] = [
    ['play', () => (start = el.currentTime)],
    ['timeupdate', () => !el.seeking && (last = el.currentTime)],
    [
      'seeking',
      () => {
        close(last);
        if (Math.abs(el.currentTime - last) > 1) {
          track('VIDEO_SEEK', courseId, itemId, {
            from: r(last),
            to: r(el.currentTime),
            duration: r(el.duration || 0)
          });
        }
        last = el.currentTime;
        if (!el.paused) start = el.currentTime;
      }
    ],
    [
      'pause',
      () => {
        if (el.ended || el.seeking) return;
        sendWatch();
        track('VIDEO_PAUSE', courseId, itemId, {
          at: r(el.currentTime),
          duration: r(el.duration || 0)
        });
      }
    ],
    [
      'ratechange',
      () => {
        sendWatch();
        track('VIDEO_RATE', courseId, itemId, { rate: el.playbackRate });
      }
    ],
    [
      'ended',
      () => {
        sendWatch();
        track('VIDEO_ENDED', courseId, itemId, { duration: r(el.duration || 0) });
      }
    ]
  ];
  handlers.forEach(([e, h]) => el.addEventListener(e, h));
  const tick = window.setInterval(sendWatch, 15_000);
  return () => {
    sendWatch();
    window.clearInterval(tick);
    handlers.forEach(([e, h]) => el.removeEventListener(e, h));
  };
}

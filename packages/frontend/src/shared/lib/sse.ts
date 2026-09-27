import { store } from '../../app/store';
import { refreshOnce } from './axiosClient';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface StreamHandlers {
  onMeta?: (meta: unknown) => void;
  onToken: (text: string) => void;
  // a key failed mid-answer on the server: drop what was shown, the answer starts over
  onRestart?: () => void;
}

// POSTs to a Server-Sent Events endpoint and feeds the events to the handlers. EventSource can't
// POST or send a bearer token, so this reads the stream with fetch. Resolves when the reply ends.
export async function postStream(
  path: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const send = (token: string | null) =>
    fetch(`${baseURL}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });

  let res = await send(store.getState().auth.accessToken);
  if (res.status === 401) res = await send(await refreshOnce());
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || `The AI request failed (${res.status}).`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.*)$/m.exec(frame)?.[1];
      const data = JSON.parse(/^data: (.*)$/m.exec(frame)?.[1] || '{}');
      if (event === 'token') handlers.onToken(data.t);
      else if (event === 'restart') handlers.onRestart?.();
      else if (event === 'meta') handlers.onMeta?.(data);
      else if (event === 'error') throw new Error(data.message);
      else if (event === 'done') return;
    }
  }
}

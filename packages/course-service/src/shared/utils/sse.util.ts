import { Request, Response } from 'express';
import logger from '../config/logger.config.js';

// Server-Sent Events over a POST response: `meta` (optional), `token` per chunk, `restart` when
// a key failed mid-answer (drop the partial text), then `done` or `error`. Stops generating as
// soon as the client disconnects.
export async function streamSSE(
  req: Request,
  res: Response,
  events: AsyncIterable<{ type: 'token'; text: string } | { type: 'restart' }>,
  meta?: unknown
) {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx and ingress-nginx would otherwise buffer the whole reply
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  let closed = false;
  req.on('close', () => (closed = true));
  if (meta !== undefined) send('meta', meta);
  try {
    for await (const e of events) {
      if (closed) break;
      if (e.type === 'token') send('token', { t: e.text });
      else send('restart', {});
    }
    if (!closed) send('done', {});
  } catch (error) {
    logger.error({ err: error }, 'SSE stream failed');
    if (!closed) send('error', { message: 'The AI is unavailable right now. Try again shortly.' });
  } finally {
    res.end();
  }
}

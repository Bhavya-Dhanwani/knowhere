import { io, Socket } from 'socket.io-client';
import { store } from '../../../app/store';

// One Socket.IO connection per tab, shared by the community UI and notifications.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({
    path: '/socket.io',
    // read the token on every (re)connect so a refreshed token is picked up
    auth: (cb) => cb({ token: store.getState().auth.accessToken }),
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}

export interface Ack {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

// emit with an acknowledgement, rejecting on server-side errors
export function request<T extends Ack = Ack>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    getSocket()
      .timeout(8000)
      .emit(event, payload, (err: Error | null, res: T) => {
        if (err) reject(new Error('The server did not respond. Check your connection.'));
        else if (!res?.ok) reject(new Error(res?.error || 'Request failed'));
        else resolve(res);
      });
  });
}

import React, { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { Headphones, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { cn } from '../../../shared/lib/cn';
import { Channel, communityApi } from '../api/communityApi';
import { getSocket, request } from '../api/socket';

export interface VoiceParticipant {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
}

// Voice runs through LiveKit (an SFU): each speaker uploads one stream and the server fans it
// out, so rooms scale past a handful of people. The chat socket only keeps the sidebar roster.
export const VoiceRoom: React.FC<{
  channel: Channel;
  participants: VoiceParticipant[];
  onError: (msg: string) => void;
}> = ({ channel, participants, onError }) => {
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement>(null);

  const leave = async () => {
    const r = room.current;
    room.current = null;
    setJoined(false);
    setSpeaking(new Set());
    if (r) await r.disconnect();
    if (audio.current) audio.current.innerHTML = '';
    await request('voice:leave', {}).catch(() => undefined);
  };

  useEffect(() => () => void leave(), [channel._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    setJoining(true);
    try {
      // livekit-client is only fetched when someone actually joins a voice channel
      const [{ url, token }, { Room: LiveKitRoom, RoomEvent, Track }] = await Promise.all([
        communityApi.voiceToken(channel._id),
        import('livekit-client')
      ]);
      const r = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
      r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        el.dataset.identity = participant.identity;
        audio.current?.appendChild(el);
      });
      r.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
      // a participant that drops without unpublishing still leaves an element behind
      r.on(RoomEvent.ParticipantDisconnected, (participant) =>
        audio.current
          ?.querySelectorAll(`[data-identity="${CSS.escape(participant.identity)}"]`)
          .forEach((el) => el.remove())
      );
      r.on(RoomEvent.ActiveSpeakersChanged, (list) =>
        setSpeaking(new Set(list.map((p) => p.identity)))
      );
      r.on(RoomEvent.Disconnected, () => {
        if (room.current === r) void leave();
      });
      await r.connect(url, token);
      room.current = r;
      await r.localParticipant.setMicrophoneEnabled(true);
      await request('voice:join', { roomId: channel._id });
      setMuted(false);
      setJoined(true);
    } catch (e) {
      await room.current?.disconnect();
      room.current = null;
      onError(
        e instanceof DOMException || /permission|NotAllowed/i.test(String(e))
          ? 'Microphone access was blocked.'
          : (e as Error).message
      );
    } finally {
      setJoining(false);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    await room.current?.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
    getSocket().emit('voice:mute', { muted: next });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600">
        <Volume2 className="h-7 w-7" />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-zinc-900">{channel.name}</h3>
        <p className="text-sm text-zinc-500">{channel.description || 'Voice channel'}</p>
      </div>

      <ul className="flex max-w-lg flex-wrap justify-center gap-3">
        {participants.length ? (
          participants.map((p) => (
            <li key={p.socketId} className="flex w-24 flex-col items-center gap-1.5">
              <span
                className={cn(
                  'relative rounded-full transition',
                  speaking.has(p.userId) && !p.muted && 'ring-4 ring-emerald-400 ring-offset-2'
                )}
              >
                <Avatar name={p.name} size="lg" />
                {p.muted ? (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white ring-2 ring-white">
                    <MicOff className="h-3 w-3" />
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-xs text-zinc-700">{p.name}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-zinc-500">Nobody is here yet.</li>
        )}
      </ul>

      {joined ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={toggleMute}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{' '}
            {muted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="danger" onClick={leave}>
            <PhoneOff className="h-4 w-4" /> Leave
          </Button>
        </div>
      ) : (
        <Button onClick={join} isLoading={joining}>
          <Headphones className="h-4 w-4" /> Join voice
        </Button>
      )}
      <div ref={audio} className="hidden" />
    </div>
  );
};

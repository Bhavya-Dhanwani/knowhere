import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import s3Service from './s3.service.js';
import env from '../shared/config/env.config.js';
import { mediaSigningSecret } from '@lms/shared';

export const hlsPrefix = (resourceId: string) => `hls/${resourceId}/`;

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(env.FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)));
    child.on('error', (e) => reject(new Error(`ffmpeg is not available: ${e.message}`)));
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`))
    );
  });
}

// Transcodes an uploaded video into AES-128 encrypted HLS (6s segments) and stores the
// playlist + segments in S3. The key never goes to S3: it is returned for the database and
// only handed to viewers who pass the course access check.
export async function packageHls(resourceId: string, sourceKey: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hls-'));
  try {
    const source = await s3Service.getObjectStream(sourceKey);
    if (!source) throw new Error('Source video is missing from storage.');
    const input = path.join(dir, 'source');
    await pipeline(source.stream, createWriteStream(input));

    const key = randomBytes(16);
    const iv = randomBytes(16).toString('hex');
    await writeFile(path.join(dir, 'enc.key'), key);
    // key URI is a placeholder: the playlist endpoint points it at the authenticated key route
    await writeFile(path.join(dir, 'keyinfo'), `key\n${path.join(dir, 'enc.key')}\n${iv}\n`);

    await ffmpeg([
      '-y',
      '-i',
      input,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-f',
      'hls',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_key_info_file',
      path.join(dir, 'keyinfo'),
      '-hls_segment_filename',
      path.join(dir, 'seg%04d.ts'),
      path.join(dir, 'index.m3u8')
    ]);

    const outputs = (await readdir(dir)).filter((f) => f === 'index.m3u8' || f.endsWith('.ts'));
    for (const f of outputs) {
      await s3Service.putObject(
        hlsPrefix(resourceId) + f,
        await readFile(path.join(dir, f)),
        f.endsWith('.ts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl'
      );
    }
    return {
      playlistKey: `${hlsPrefix(resourceId)}index.m3u8`,
      key: key.toString('hex'),
      iv,
      segments: outputs.length - 1
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Segment links carry an HMAC token (resource + file + expiry) instead of a storage signature.
// The segment route checks it without touching the database and redirects to a fresh 60s signed
// URL, so a long lecture never outlives its links. Segments are useless without the key anyway.
const SEGMENT_TTL_SEC = 24 * 3600;
const segmentKey = () =>
  createHash('sha256').update(`hls-segments:${mediaSigningSecret()}`).digest();
const sign = (resourceId: string, file: string, exp: number) =>
  createHmac('sha256', segmentKey()).update(`${resourceId}:${file}:${exp}`).digest('base64url');

export function segmentToken(resourceId: string, file: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SEGMENT_TTL_SEC;
  return `${exp}.${sign(resourceId, file, exp)}`;
}

export function verifySegmentToken(
  resourceId: string,
  file: string,
  token: string,
  now = Date.now()
) {
  const [expRaw, mac] = String(token).split('.');
  const exp = Number(expRaw);
  if (!exp || !mac || exp < now / 1000) return false;
  const expected = Buffer.from(sign(resourceId, file, exp));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const SEGMENT_FILE = /^seg\d{4}\.ts$/;

// Rewrites a stored playlist for one viewer: the key URI goes to the authenticated key endpoint
// and each segment to the token-checked redirect route (both relative to the playlist URL).
export async function viewerPlaylist(resourceId: string, keyUrl: string) {
  const stored = await s3Service.getObjectStream(`${hlsPrefix(resourceId)}index.m3u8`);
  if (!stored) return null;
  const chunks: Buffer[] = [];
  for await (const c of stored.stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks)
    .toString('utf8')
    .split('\n')
    .map((line) => {
      if (line.startsWith('#EXT-X-KEY')) return line.replace(/URI="[^"]*"/, `URI="${keyUrl}"`);
      if (!line || line.startsWith('#')) return line;
      const file = line.trim();
      return `seg/${file}?t=${segmentToken(resourceId, file)}`;
    })
    .join('\n');
}

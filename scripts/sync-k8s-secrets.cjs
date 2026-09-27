// Copies the voice (LiveKit) and Mistral values from the local .env files into k8s/secrets.yml,
// so the cluster's chat-service signs voice tokens with the same secret as the LiveKit that
// browsers reach at ws://localhost:7880. Prints lengths only, never values.
//   node scripts/sync-k8s-secrets.cjs && skaffold run
// (not `kubectl apply -k k8s`: that resets every deployment to the untagged, stale images)
const fs = require('fs');
const env = (f) =>
  Object.fromEntries(
    fs
      .readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')])
  );
const chat = env('packages/chat-service/.env');
const course = env('packages/course-service/.env');
const review = fs.existsSync('packages/project-review-service/.env')
  ? env('packages/project-review-service/.env')
  : {};
const keys = [
  ...new Set(
    [
      ...(course.MISTRAL_API_KEYS || '').split(/[,;]/),
      ...Object.entries(course)
        .filter(([k]) => /^MISTRAL_API_KEY_?\d*$/.test(k))
        .map(([, v]) => v)
    ]
      .map((s) => s.trim())
      .filter(Boolean)
  )
];

let s = fs.readFileSync('k8s/secrets.yml', 'utf8');
const eol = s.includes('\r\n') ? '\r' : '';
const set = (k, v) => {
  const re = new RegExp(`^(  ${k}:).*$`, 'm');
  if (!re.test(s)) throw new Error(`${k} not found in k8s/secrets.yml`);
  s = s.replace(re, (_, a) => `${a} '${v}'${eol}`);
};
set('MISTRAL_API_KEYS', keys.join(','));
set('GITHUB_TOKEN', review.GITHUB_TOKEN || '');
set('LIVEKIT_API_KEY', chat.LIVEKIT_API_KEY);
set('LIVEKIT_API_SECRET', chat.LIVEKIT_API_SECRET);
set('LIVEKIT_URL', chat.LIVEKIT_URL);
fs.writeFileSync('k8s/secrets.yml', s);
console.log(
  `mistral keys: ${keys.length} | github token: ${review.GITHUB_TOKEN ? 'set' : 'none'} | livekit key: ${chat.LIVEKIT_API_KEY} | url: ${chat.LIVEKIT_URL} | secret length: ${chat.LIVEKIT_API_SECRET.length}`
);

# Knowhere LMS

A cohort-based learning platform: structured courses with scheduled modules, quizzes and
auto-graded coding problems, encrypted video, a Discord-style community per course with voice,
and AI-assisted project reviews. Responsive down to 280px.

## What's inside

| Package                                            | Port       | Responsibility                                                                                            |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `frontend`                                         | 3100 (dev) | React 18 + Vite app for students, trainers and admins                                                     |
| `auth-service`                                     | 5000       | Sign-up/login, Google OAuth, sessions, platform roles; issues RS256 access tokens; serves `/openapi.json` |
| `user-service`                                     | 5001       | Profiles, course memberships (enrollment), competencies                                                   |
| `course-service`                                   | 5002       | Courses and bottom-up authoring, schedules and deadlines, progress, encrypted HLS video, judging          |
| `mcq-service` / `media-service` / `coding-service` | 5003–5005  | Standalone question bank, media and coding problems                                                       |
| `project-review-service`                           | 5006       | AI project review events, evaluation, rankings and exports                                                |
| `chat-service`                                     | 5007       | Course communities over Socket.IO + Redis: channels, threads, files, notifications, voice tokens          |
| `judge-runner`                                     | 5010       | Sandboxed Python / C++ / Java runner (bubblewrap per run)                                                 |
| `shared`                                           | –          | Errors, auth middleware, RS256 keys, membership client, judge                                             |

Infrastructure: MongoDB, Redis, S3 (MinIO locally), ffmpeg, LiveKit (voice SFU).

### How the main pieces work

- **Courses are built bottom-up.** Files and questions go into submodules, submodules go into
  modules, and modules are attached to a course with a release date. Each learner gets a
  deadline window per module. A late joiner catches up on their own clock.
- **Access is enforced on the server.** Every content read checks enrollment, publication and
  the learner's module schedule. People who aren't enrolled only see a locked syllabus.
- **Coding questions are judged on the server.**
  - JavaScript (`solve(input)`) runs in an in-process sandbox: a vm context with no host APIs,
    Node's permission model, and hard kills.
  - Python, C++ and Java run in `judge-runner`. Every compile and every test case gets a fresh
    bubblewrap sandbox: no network, read-only system, runs as `nobody`, rlimits.
  - Hidden-test verdicts never echo program output.
  - AI test generation needs a trainer's reference solution. The model proposes inputs, and
    the reference produces the expected outputs.
- **Video is encrypted.** Uploads are transcoded to AES-128 HLS with a per-video key.
  - The key comes from an authenticated endpoint and is logged per viewer.
  - Segments are served through HMAC-signed redirects.
  - A viewer watermark drifts over the player.
- **Communities.** Each course gets general, announcements, course-discussion and study-room
  channels, plus any channels moderators add. Features include threads, reactions, mentions,
  typing indicators, presence, unread counts, file sharing, search, notifications and
  moderator tools. Voice runs through LiveKit, and the roster is shared across chat pods via
  the Redis adapter.
- **Tokens.**
  - Access tokens are RS256. Only auth-service holds the private key, so no other service can
    mint a user token.
  - Service-to-service calls use scoped, audience-bound, 60s service tokens that only
    user-service's membership and profile routes accept.

## Run it locally

Requirements: Node 22, pnpm, Docker, ffmpeg.

```bash
pnpm install

# infrastructure (first time: `docker run` — see below; afterwards `docker start ...`)
docker run -d --name knowhere-mongo -p 27017:27017 mongo:7
docker run -d --name knowhere-redis -p 6379:6379 redis:7-alpine
docker run -d --name knowhere-minio -p 9100:9000 -p 9101:9001 \
  -e MINIO_ROOT_USER=knowhere -e MINIO_ROOT_PASSWORD=knowhere-secret minio/minio server /data --console-address :9001
docker build -f packages/judge-runner/Dockerfile -t judge-runner .
docker run -d --name knowhere-judge -p 5010:5010 --cap-drop ALL --security-opt no-new-privileges \
  --security-opt seccomp=unconfined --security-opt apparmor=unconfined judge-runner
docker run -d --name knowhere-livekit -p 7880:7880 -p 7881:7881 -p 3478:3478/udp \
  -p 50000-50020:50000-50020/udp -e LIVEKIT_CONFIG="port: 7880
rtc: {tcp_port: 7881, port_range_start: 50000, port_range_end: 50020, node_ip: 127.0.0.1}
turn: {enabled: true, udp_port: 3478}
keys: {knowhere: $LIVEKIT_API_SECRET}" livekit/livekit-server

# services (dev keys for tokens are built in) and the app
pnpm -r --parallel --filter "./packages/*-service" run dev
pnpm --filter @lms/frontend exec vite --port 3100

pnpm seed   # realistic demo data: users, 3 courses, questions, video, communities
```

Copy each package's `.env.example` to `.env`. Point `course-service` at MinIO with
`S3_ENDPOINT=http://localhost:9100`. Give `chat-service` the same LiveKit key and secret.

Seeded accounts (password `Password123!`):

| Email                       | Role                                      |
| --------------------------- | ----------------------------------------- |
| `admin@example.com`         | platform admin                            |
| `trainer@example.com`       | trainer, admin of Distributed Systems     |
| `arjun.verma@example.com`   | trainer, admin of Modern React            |
| `student@example.com`       | student in both courses                   |
| `elena.rostova@example.com` | late joiner (shows the catch-up schedule) |

## Checks

```bash
pnpm typecheck
pnpm test                               # every service's Jest suite
node packages/judge-runner/check.mjs    # sandbox walls: network, writes, loops, memory, fork bombs
pnpm docs:api                           # regenerate the API reference from the real routers
```

The API reference lives at `/docs` in the app and `/openapi.json` on the API. It's generated from the running
routers, so it cannot drift from the code.

## Deploy (Kubernetes)

Manifests are in `k8s/` (`kubectl apply -k k8s`). Before the first deploy:

1. Run `pnpm keys` and put the output in the `jwt-keys` secret in `k8s/secrets.yml`. That file
   is gitignored, so never commit it.
2. Set `LIVEKIT_URL` in the `livekit` secret to your public `wss://` voice address. Terminate
   TLS in front of LiveKit's port 7880.
3. Make sure nodes allow LiveKit's host ports: 7881/tcp, 3478/udp and 50000–60000/udp.
4. On clusters older than 1.30, replace the judge's `appArmorProfile` field with the AppArmor
   annotation.

With `NODE_ENV=production`, every service refuses to start without real keys.

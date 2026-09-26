/* eslint-disable no-console */
// Seeds every database with a realistic, internally consistent demo:
// users & roles (auth), profiles & enrolments (user), a full course library with real
// files in S3 (course), learner progress, and a Discord-style community per course (chat).
//
// It imports the services' own mongoose models, so documents always match the live schemas.
// Run:  pnpm seed          (defaults to mongodb://localhost:27017 and course-service/.env for S3)
//       MONGO_BASE_URI=mongodb+srv://... pnpm seed   (a shared cluster)
import 'dotenv/config';
import zlib from 'node:zlib';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import User from '../../auth-service/src/shared/models/user.model.js';
import UserProfile from '../../user-service/src/shared/models/userProfile.model.js';
import CourseMembership from '../../user-service/src/shared/models/courseMembership.model.js';
import Competency from '../../user-service/src/shared/models/competency.model.js';
import Course from '../src/shared/models/course.model.js';
import Module from '../src/shared/models/module.model.js';
import Submodule from '../src/shared/models/submodule.model.js';
import Resource from '../src/shared/models/resource.model.js';
import Mcq from '../src/shared/models/mcq.model.js';
import McqAttempt from '../src/shared/models/mcqAttempt.model.js';
import CodeQuestion from '../src/shared/models/codeQuestion.model.js';
import CourseProgress from '../src/shared/models/courseProgress.model.js';
import drmWorkerService from '../src/services/drmWorker.service.js';
import ChatRoom from '../../chat-service/src/shared/models/room.model.js';
import ChatMessage from '../../chat-service/src/shared/models/message.model.js';
import ReadState from '../../chat-service/src/shared/models/readState.model.js';
import Notification from '../../chat-service/src/shared/models/notification.model.js';

const BASE = (process.env.MONGO_BASE_URI || 'mongodb://localhost:27017').replace(/\/$/, '');
const PASSWORD = 'Password123!';
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const { ObjectId } = mongoose.Types;

async function useDb(name: string, work: () => Promise<void>) {
  const uri = BASE.includes('?') ? BASE.replace('?', `/${name}?`) : `${BASE}/${name}`;
  await mongoose.connect(uri);
  console.log(`\n→ ${name}`);
  try {
    await work();
  } finally {
    await mongoose.disconnect();
  }
}

// ------------------------------------------------------------------ S3 files
const bucket = process.env.S3_RAW_BUCKET || 'lms-raw-media';
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

async function upload(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );
}

// a real, minimal PDF with a title and paragraphs (Helvetica, one page)
function makePdf(title: string, lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const text = [
    'BT /F1 22 Tf 56 770 Td',
    `(${esc(title)}) Tj`,
    '/F1 12 Tf 0 -34 Td 16 TL',
    ...lines.map((l) => `(${esc(l)}) '`),
    'ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

// a real PNG: a simple bar-chart style diagram
function makePng(width: number, height: number, bars: number[]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 3 + 1) + 1 + x * 3;
      const bar = Math.floor((x / width) * bars.length);
      const inBar = x % Math.floor(width / bars.length) > 12 && height - y < bars[bar] * height;
      const [r, g, b] = inBar ? [106, 72, 234] : [245, 245, 250];
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

async function sampleVideo(): Promise<Buffer | null> {
  try {
    const res = await fetch('https://www.w3schools.com/html/mov_bbb.mp4');
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ coding problems
// hidden test cases come from reference solutions, so every expected output is correct
let seed = 42;
const rand = (min: number, max: number) => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return min + (seed % (max - min + 1));
};
const cases = (count: number, gen: () => string, solve: (input: string) => string) =>
  Array.from({ length: count }, () => {
    const input = gen();
    return { input, expectedOutput: solve(input), isHidden: true };
  });

const PROBLEMS = {
  sum: {
    title: 'Sum of numbers',
    description:
      'Read `n` followed by `n` integers and print their **sum**.\n\nWatch out for negative numbers and large values.',
    constraints: ['1 ≤ n ≤ 10^5', '-10^9 ≤ a_i ≤ 10^9'],
    inputFormat: 'First line: n. Second line: n space-separated integers.',
    outputFormat: 'A single integer — the sum.',
    examples: [
      { input: '3\n1 2 3', output: '6', explanation: '1 + 2 + 3 = 6' },
      { input: '2\n-5 5', output: '0' }
    ],
    difficulty: 'easy' as const,
    solve: (inp: string) => {
      const [, line] = inp.split('\n');
      return String(line.split(' ').reduce((s, x) => s + BigInt(x), 0n));
    },
    gen: () => {
      const n = rand(1, 30);
      return `${n}\n${Array.from({ length: n }, () => rand(-1e6, 1e6)).join(' ')}`;
    }
  },
  majority: {
    title: 'Majority vote',
    description:
      'A cluster of `n` nodes voted for a leader. Print the candidate id that received **more than half** of the votes, or `-1` if nobody has a majority.',
    constraints: ['1 ≤ n ≤ 10^5', '0 ≤ vote ≤ 10^9'],
    inputFormat: 'First line: n. Second line: n votes (candidate ids).',
    outputFormat: 'The majority candidate id, or -1.',
    examples: [
      { input: '5\n2 2 1 2 3', output: '2' },
      { input: '4\n1 2 1 2', output: '-1', explanation: 'A tie is not a majority.' }
    ],
    difficulty: 'medium' as const,
    solve: (inp: string) => {
      const votes = inp.split('\n')[1].split(' ');
      const counts = new Map<string, number>();
      for (const v of votes) counts.set(v, (counts.get(v) || 0) + 1);
      for (const [v, c] of counts) if (c * 2 > votes.length) return v;
      return '-1';
    },
    gen: () => {
      const n = rand(1, 25);
      const pool = rand(1, 4);
      return `${n}\n${Array.from({ length: n }, () => rand(1, pool)).join(' ')}`;
    }
  },
  longest: {
    title: 'Longest word',
    description:
      'Given a sentence, print the **longest word**. If several words tie, print the one that appears first.',
    constraints: ['1 ≤ length ≤ 10^4', 'Words are separated by single spaces'],
    inputFormat: 'A single line of lowercase words.',
    outputFormat: 'The longest word.',
    examples: [
      { input: 'react renders components', output: 'components' },
      { input: 'hooks are neat', output: 'hooks' }
    ],
    difficulty: 'easy' as const,
    solve: (inp: string) =>
      inp
        .trim()
        .split(' ')
        .reduce((best, w) => (w.length > best.length ? w : best), ''),
    gen: () => {
      const words = [
        'state',
        'props',
        'effect',
        'memo',
        'suspense',
        'portal',
        'context',
        'ref',
        'reducer',
        'fiber'
      ];
      return Array.from({ length: rand(1, 8) }, () => words[rand(0, words.length - 1)]).join(' ');
    }
  },
  twoSum: {
    title: 'Two sum indices',
    description:
      'Given `n` integers and a `target`, print the **0-based indices** `i j` (i < j) of the first pair that adds up to the target, scanning left to right. Print `-1` if there is none.',
    constraints: ['2 ≤ n ≤ 10^5', '-10^9 ≤ a_i, target ≤ 10^9'],
    inputFormat: 'First line: n target. Second line: n integers.',
    outputFormat: 'Two indices separated by a space, or -1.',
    examples: [
      { input: '4 9\n2 7 11 15', output: '0 1' },
      { input: '3 10\n1 2 3', output: '-1' }
    ],
    difficulty: 'medium' as const,
    solve: (inp: string) => {
      const [head, line] = inp.split('\n');
      const target = Number(head.split(' ')[1]);
      const nums = line.split(' ').map(Number);
      const seen = new Map<number, number>();
      for (let j = 0; j < nums.length; j++) {
        if (seen.has(target - nums[j])) return `${seen.get(target - nums[j])} ${j}`;
        if (!seen.has(nums[j])) seen.set(nums[j], j);
      }
      return '-1';
    },
    gen: () => {
      const n = rand(2, 12);
      return `${n} ${rand(-20, 40)}\n${Array.from({ length: n }, () => rand(-10, 25)).join(' ')}`;
    }
  }
};

// ------------------------------------------------------------------ people
const PEOPLE = [
  {
    key: 'admin',
    name: 'David Miller',
    email: 'admin@example.com',
    role: 'admin',
    bio: 'Platform administrator.'
  },
  {
    key: 'sarah',
    name: 'Sarah Connor',
    email: 'trainer@example.com',
    role: 'trainer',
    bio: 'Lead instructor — distributed systems, Kubernetes and system design.'
  },
  {
    key: 'arjun',
    name: 'Arjun Verma',
    email: 'arjun.verma@example.com',
    role: 'trainer',
    bio: 'Frontend architect. React, TypeScript and design systems.'
  },
  {
    key: 'alex',
    name: 'Alex Rivera',
    email: 'student@example.com',
    role: 'trainee',
    bio: 'Full-stack student into distributed systems.'
  },
  {
    key: 'sophia',
    name: 'Sophia Chen',
    email: 'sophia.chen@example.com',
    role: 'trainee',
    bio: 'Competitive programmer and backend enthusiast.'
  },
  {
    key: 'marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@example.com',
    role: 'trainee',
    bio: 'Frontend developer levelling up on the backend.'
  },
  {
    key: 'elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@example.com',
    role: 'trainee',
    bio: 'DevOps & cloud apprentice.'
  },
  {
    key: 'bhavya',
    name: 'Bhavya Dhanwani',
    email: 'dhanwanibhavya@example.com',
    role: 'trainee',
    bio: 'Software engineer building modern web apps.'
  }
] as const;
type PersonKey = (typeof PEOPLE)[number]['key'];

async function main() {
  const ids = {} as Record<PersonKey, string>;

  // ---------------------------------------------------------------- auth
  await useDb('authService', async () => {
    for (const p of PEOPLE) {
      let u = await User.findOne({ email: p.email });
      if (!u) u = new User({ email: p.email });
      Object.assign(u, {
        name: p.name,
        password: PASSWORD,
        providers: ['local'],
        isVerified: true,
        role: p.role
      });
      await u.save(); // pre-save hook hashes the password
      ids[p.key] = u._id.toString();
    }
    console.log(`  ${PEOPLE.length} users (password: ${PASSWORD})`);
  });

  // ---------------------------------------------------------------- files
  console.log('\n→ S3 files');
  const video = await sampleVideo();
  const files = [
    {
      key: 'fallacies',
      fileName: 'eight-fallacies-of-distributed-computing.pdf',
      type: 'pdf',
      mime: 'application/pdf',
      body: makePdf('The eight fallacies of distributed computing', [
        '1. The network is reliable.',
        '2. Latency is zero.',
        '3. Bandwidth is infinite.',
        '4. The network is secure.',
        '5. Topology does not change.',
        '6. There is one administrator.',
        '7. Transport cost is zero.',
        '8. The network is homogeneous.',
        '',
        'Every one of these assumptions eventually fails in production.',
        'Design for timeouts, retries, idempotency and partial failure.'
      ])
    },
    {
      key: 'raftDiagram',
      fileName: 'raft-election-timeline.png',
      type: 'image',
      mime: 'image/png',
      body: makePng(640, 360, [0.35, 0.6, 0.9, 0.55, 0.75])
    },
    {
      key: 'kafkaData',
      fileName: 'kafka-partition-lag.csv',
      type: 'resource',
      mime: 'text/csv',
      body: Buffer.from(
        'partition,leader,replicas,consumer_lag\n0,broker-1,3,12\n1,broker-2,3,0\n2,broker-3,3,4\n3,broker-1,3,57\n4,broker-2,3,1\n5,broker-3,3,9\n'
      )
    },
    {
      key: 'reactNotes',
      fileName: 'react-rendering-model.pdf',
      type: 'pdf',
      mime: 'application/pdf',
      body: makePdf('How React renders', [
        'Render: React calls your components to compute the next UI.',
        'Reconcile: it diffs the new tree against the previous one.',
        'Commit: it applies the minimal DOM changes.',
        '',
        'State updates are batched and scheduled by priority.',
        'Keys tell React which list items are the same across renders.',
        'Effects run after the commit, never during render.'
      ])
    },
    ...(video
      ? [
          {
            key: 'raftVideo',
            fileName: 'raft-consensus-explained.mp4',
            type: 'video',
            mime: 'video/mp4',
            body: video
          }
        ]
      : [])
  ];
  if (!video) console.log('  (sample video download failed — skipping video items)');

  const fileKeys = new Map<string, string>();
  for (const f of files) {
    const s3Key = `resources/${'seed'}/${f.fileName}`;
    await upload(s3Key, f.body, f.mime);
    fileKeys.set(f.key, s3Key);
  }
  console.log(`  uploaded ${files.length} files to s3://${bucket}`);

  // ---------------------------------------------------------------- courses
  const courseIds = { dist: new ObjectId(), react: new ObjectId(), dsa: new ObjectId() };
  const itemIds: Record<string, string> = {}; // content-entry id by name, for progress

  await useDb('courseService', async () => {
    await Promise.all([
      Course.deleteMany({}),
      Module.deleteMany({}),
      Submodule.deleteMany({}),
      Resource.deleteMany({}),
      Mcq.deleteMany({}),
      McqAttempt.deleteMany({}),
      CodeQuestion.deleteMany({}),
      CourseProgress.deleteMany({})
    ]);

    const res: Record<string, mongoose.Types.ObjectId> = {};
    for (const f of files) {
      const owner = f.key === 'reactNotes' ? ids.arjun : ids.sarah;
      const r = await Resource.create({
        fileName: f.fileName,
        mimeType: f.mime,
        fileSizeBytes: f.body.length,
        resourceType: f.type,
        ownerId: owner,
        s3Key: fileKeys.get(f.key),
        status: 'READY'
      });
      res[f.key] = r._id;
      // same pipeline as a real upload: encrypted HLS with a per-video key
      if (f.type === 'video') {
        await drmWorkerService.applyDrm(r._id.toString(), fileKeys.get(f.key)!);
        const packaged = await Resource.findById(r._id);
        console.log(
          `  video packaging: ${packaged?.drmStatus}${packaged?.failureReason ? ` (${packaged.failureReason})` : ''}`
        );
      }
    }

    const mcq = async (
      creator: string,
      question: string,
      options: string[],
      correct: number,
      explanation: string,
      difficulty = 'easy',
      questionResourceIds: mongoose.Types.ObjectId[] = []
    ) =>
      (
        await Mcq.create({
          question,
          options: options.map((text, i) => ({ id: `option_${i}`, text, resourceIds: [] })),
          correctOptionIndex: correct,
          explanation,
          difficulty,
          creatorId: creator,
          questionResourceIds,
          explanationResourceIds: [],
          tags: []
        })
      )._id;

    const q = {
      cap: await mcq(
        ids.sarah,
        'During a network partition, a CP system will…',
        [
          'Keep accepting writes on both sides',
          'Refuse some requests to stay consistent',
          'Silently drop data',
          'Switch to eventual consistency'
        ],
        1,
        'CP systems give up availability during a partition so every read sees the latest write.',
        'medium'
      ),
      linearizable: await mcq(
        ids.sarah,
        'Which guarantee makes a distributed register behave like a single copy?',
        ['Eventual consistency', 'Causal consistency', 'Linearizability', 'Read-your-writes'],
        2,
        'Linearizability orders every operation on a single timeline consistent with real time.',
        'medium'
      ),
      fallacy: await mcq(
        ids.sarah,
        'Which of these is one of the eight fallacies of distributed computing?',
        ['Latency is zero', 'CPUs are fast', 'Disks are cheap', 'JSON is verbose'],
        0,
        'Assuming zero latency leads to chatty designs that collapse under real network delays.'
      ),
      raft: await mcq(
        ids.sarah,
        'In Raft, when does a follower start an election?',
        [
          'Every 5 seconds',
          'When its election timeout passes without hearing from a leader',
          'When a client asks it to',
          'When its log is longer than the leader’s'
        ],
        1,
        'Randomised election timeouts make it likely that exactly one follower times out first.',
        'medium',
        [res.raftDiagram]
      ),
      quorum: await mcq(
        ids.sarah,
        'How many nodes must acknowledge a write in a 5-node Raft cluster before it is committed?',
        ['1', '2', '3', '5'],
        2,
        'A majority (⌊5/2⌋ + 1 = 3) must store the entry.'
      ),
      partitions: await mcq(
        ids.sarah,
        'What guarantees message order in Kafka?',
        ['The topic', 'The partition', 'The consumer group', 'The broker'],
        1,
        'Ordering is only guaranteed within a single partition.'
      ),
      groups: await mcq(
        ids.sarah,
        'In a consumer group, each partition is read by…',
        [
          'Every consumer',
          'Exactly one consumer in the group',
          'The group leader only',
          'A random consumer per message'
        ],
        1,
        'Partitions are assigned to one consumer per group, which is how Kafka scales reads.'
      ),
      tracing: await mcq(
        ids.sarah,
        'What ties the spans of one request together across services?',
        ['A log level', 'A trace id propagated in headers', 'The service name', 'A metrics label'],
        1,
        'Each hop forwards the trace id so spans can be stitched into one trace.'
      ),
      keys: await mcq(
        ids.arjun,
        'Why does React need `key` on list items?',
        [
          'For CSS styling',
          'To identify items across renders',
          'To sort the list',
          'For accessibility'
        ],
        1,
        'Stable keys let React match old and new items instead of re-creating them.'
      ),
      effects: await mcq(
        ids.arjun,
        'When does a `useEffect` callback run?',
        ['During render', 'Before the DOM updates', 'After the commit phase', 'Only on the server'],
        2,
        'Effects run after React has committed changes to the DOM.'
      ),
      narrowing: await mcq(
        ids.arjun,
        'Which TypeScript feature lets `if (typeof x === "string")` refine a union?',
        ['Generics', 'Type narrowing', 'Declaration merging', 'Enums'],
        1,
        'Control-flow analysis narrows union types inside the guarded branch.'
      ),
      hashing: await mcq(
        ids.sarah,
        'What is the average lookup time of a hash map?',
        ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        0,
        'Hashing jumps straight to a bucket; collisions are rare with a good hash.'
      )
    };

    const code = async (creator: string, key: keyof typeof PROBLEMS) => {
      const p = PROBLEMS[key];
      return (
        await CodeQuestion.create({
          title: p.title,
          description: p.description,
          constraints: p.constraints,
          inputFormat: p.inputFormat,
          outputFormat: p.outputFormat,
          examples: p.examples,
          difficulty: p.difficulty,
          supportedLanguages: ['javascript', 'python', 'cpp', 'java'],
          referenceSolution: {
            language: 'javascript',
            code: `const solve = ${p.solve.toString()};`
          },
          testCases: cases(100, p.gen, p.solve),
          testCaseGenerationStatus: 'NOT_REQUESTED',
          creatorId: creator
        })
      )._id;
    };
    const c = {
      sum: await code(ids.sarah, 'sum'),
      majority: await code(ids.sarah, 'majority'),
      longest: await code(ids.arjun, 'longest'),
      twoSum: await code(ids.sarah, 'twoSum')
    };

    type Entry = [
      name: string,
      type: 'video' | 'resource' | 'mcq' | 'code-question',
      ref: mongoose.Types.ObjectId | undefined
    ];
    const submodule = async (
      creator: string,
      title: string,
      description: string,
      entries: Entry[]
    ) => {
      const content = entries
        .filter(([, , ref]) => ref)
        .map(([name, type, ref], i) => {
          const _id = new ObjectId();
          itemIds[name] = _id.toString();
          return type === 'video' || type === 'resource'
            ? { _id, type, resourceId: ref, order: i + 1 }
            : { _id, type, contentId: ref, order: i + 1 };
        });
      return (await Submodule.create({ title, description, creatorId: creator, order: 1, content }))
        ._id;
    };

    const s = {
      network: await submodule(
        ids.sarah,
        'The network is not your friend',
        'Why distributed systems fail in surprising ways.',
        [
          ['fallaciesPdf', 'resource', res.fallacies],
          ['raftVideo', 'video', res.raftVideo],
          ['fallacyQuiz', 'mcq', q.fallacy]
        ]
      ),
      consistency: await submodule(
        ids.sarah,
        'Consistency models',
        'From eventual consistency to linearizability.',
        [
          ['capQuiz', 'mcq', q.cap],
          ['linQuiz', 'mcq', q.linearizable],
          ['sumCode', 'code-question', c.sum]
        ]
      ),
      election: await submodule(
        ids.sarah,
        'Leader election with Raft',
        'Terms, votes and timeouts.',
        [
          ['raftDiagram', 'resource', res.raftDiagram],
          ['raftQuiz', 'mcq', q.raft],
          ['quorumQuiz', 'mcq', q.quorum],
          ['majorityCode', 'code-question', c.majority]
        ]
      ),
      kafka: await submodule(
        ids.sarah,
        'Partitions & consumer groups',
        'How Kafka scales and orders messages.',
        [
          ['kafkaCsv', 'resource', res.kafkaData],
          ['partitionQuiz', 'mcq', q.partitions],
          ['groupQuiz', 'mcq', q.groups]
        ]
      ),
      tracing: await submodule(
        ids.sarah,
        'Tracing & metrics',
        'Seeing inside a distributed request.',
        [['tracingQuiz', 'mcq', q.tracing]]
      ),
      rendering: await submodule(ids.arjun, 'The rendering model', 'Render, reconcile, commit.', [
        ['reactPdf', 'resource', res.reactNotes],
        ['keysQuiz', 'mcq', q.keys],
        ['effectsQuiz', 'mcq', q.effects],
        ['longestCode', 'code-question', c.longest]
      ]),
      types: await submodule(
        ids.arjun,
        'Type-level TypeScript',
        'Narrowing, generics and inference.',
        [['narrowQuiz', 'mcq', q.narrowing]]
      ),
      hashing: await submodule(
        ids.sarah,
        'Arrays & hashing',
        'The first pattern every interview uses.',
        [
          ['hashQuiz', 'mcq', q.hashing],
          ['twoSumCode', 'code-question', c.twoSum]
        ]
      )
    };

    const mod = async (
      creator: string,
      title: string,
      description: string,
      durationDays: number,
      submoduleIds: mongoose.Types.ObjectId[]
    ) =>
      (
        await Module.create({
          title,
          description,
          creatorId: creator,
          durationDays,
          progressRequirement: 70,
          submoduleIds
        })
      )._id;
    const m = {
      foundations: await mod(ids.sarah, 'Foundations', 'Networks, failure and consistency.', 7, [
        s.network,
        s.consistency
      ]),
      consensus: await mod(
        ids.sarah,
        'Replication & consensus',
        'Keeping replicas in agreement.',
        7,
        [s.election]
      ),
      messaging: await mod(
        ids.sarah,
        'Messaging with Kafka',
        'Durable logs as the backbone of a system.',
        7,
        [s.kafka]
      ),
      observability: await mod(ids.sarah, 'Observability', 'Traces, metrics and logs.', 5, [
        s.tracing
      ]),
      rendering: await mod(
        ids.arjun,
        'Rendering in depth',
        'What really happens when state changes.',
        7,
        [s.rendering]
      ),
      types: await mod(
        ids.arjun,
        'TypeScript for React',
        'Types that catch bugs before users do.',
        7,
        [s.types]
      ),
      arrays: await mod(ids.sarah, 'Arrays & hashing', 'Warm-up patterns.', 3, [s.hashing])
    };

    const entries = (list: [mongoose.Types.ObjectId, Date][]) =>
      list.map(([moduleId, releaseAt], i) => ({
        moduleId,
        order: i + 1,
        releasePolicy: {
          type: releaseAt > new Date() ? 'scheduled' : 'immediate',
          releaseAt,
          allowLateJoinerCatchUp: true
        }
      }));

    await Course.create([
      {
        _id: courseIds.dist,
        title: 'Distributed Systems Bootcamp',
        description: 'Consensus, replication and messaging — build systems that survive failure.',
        instructorId: ids.sarah,
        status: 'published',
        tags: ['backend', 'systems'],
        createdAt: ago(30),
        modules: entries([
          [m.foundations, ago(28)],
          [m.consensus, ago(21)],
          [m.messaging, ago(14)],
          [m.observability, ago(-5)]
        ])
      },
      {
        _id: courseIds.react,
        title: 'Modern React & TypeScript',
        description: 'A deep, practical tour of React’s rendering model and type-safe components.',
        instructorId: ids.arjun,
        status: 'published',
        tags: ['frontend'],
        createdAt: ago(15),
        modules: entries([
          [m.rendering, ago(10)],
          [m.types, ago(-2)]
        ])
      },
      {
        _id: courseIds.dsa,
        title: 'DSA Interview Prep',
        description: 'Pattern-by-pattern practice for coding interviews.',
        instructorId: ids.sarah,
        status: 'draft',
        tags: ['dsa'],
        createdAt: ago(3),
        modules: entries([[m.arrays, ago(1)]])
      }
    ]);

    // learner progress: completions ordered through time; correct MCQ attempts back every quiz completion
    const quizRef: Record<string, mongoose.Types.ObjectId> = {
      fallacyQuiz: q.fallacy,
      capQuiz: q.cap,
      linQuiz: q.linearizable,
      raftQuiz: q.raft,
      quorumQuiz: q.quorum,
      partitionQuiz: q.partitions,
      groupQuiz: q.groups,
      keysQuiz: q.keys,
      effectsQuiz: q.effects
    };
    const typeOf = (name: string) =>
      name.endsWith('Quiz')
        ? 'mcq'
        : name.endsWith('Code')
          ? 'code-question'
          : name === 'raftVideo'
            ? 'video'
            : 'resource';
    const progress = async (
      courseId: mongoose.Types.ObjectId,
      who: PersonKey,
      done: [string, number][]
    ) => {
      const items = done
        .filter(([name]) => itemIds[name])
        .map(([name, daysAgo]) => {
          const t = typeOf(name);
          const score = t === 'mcq' || t === 'code-question' ? 10 : 0;
          return {
            contentItemId: new ObjectId(itemIds[name]),
            type: t,
            scoreEarned: score,
            maxScore: score,
            completedAt: ago(daysAgo)
          };
        });
      await CourseProgress.create({
        courseId,
        userId: ids[who],
        totalScoreEarned: items.reduce((n, i) => n + i.scoreEarned, 0),
        completedItems: items
      });
      for (const [name, daysAgo] of done) {
        if (!quizRef[name]) continue;
        await McqAttempt.create({
          mcqId: quizRef[name],
          userId: ids[who],
          courseId,
          selectedOptionId: 'seed',
          selectedOptionIndex: 0,
          isCorrect: true,
          scoreAwarded: 10,
          attemptNumber: 1,
          createdAt: ago(daysAgo)
        });
      }
    };
    await progress(courseIds.dist, 'alex', [
      ['fallaciesPdf', 27],
      ['raftVideo', 27],
      ['fallacyQuiz', 26],
      ['capQuiz', 25],
      ['linQuiz', 25],
      ['sumCode', 24],
      ['raftDiagram', 19],
      ['raftQuiz', 18],
      ['quorumQuiz', 18],
      ['majorityCode', 16],
      ['kafkaCsv', 12],
      ['partitionQuiz', 3]
    ]);
    await progress(courseIds.dist, 'sophia', [
      ['fallaciesPdf', 26],
      ['fallacyQuiz', 26],
      ['capQuiz', 24],
      ['linQuiz', 22],
      ['sumCode', 21],
      ['raftDiagram', 15],
      ['raftQuiz', 4]
    ]);
    await progress(courseIds.dist, 'bhavya', [
      ['fallaciesPdf', 24],
      ['raftVideo', 23],
      ['fallacyQuiz', 23],
      ['capQuiz', 20],
      ['sumCode', 9],
      ['raftQuiz', 2]
    ]);
    await progress(courseIds.dist, 'marcus', [
      ['fallaciesPdf', 18],
      ['fallacyQuiz', 6]
    ]);
    await progress(courseIds.react, 'alex', [
      ['reactPdf', 9],
      ['keysQuiz', 8],
      ['effectsQuiz', 5]
    ]);
    await progress(courseIds.react, 'sophia', [
      ['reactPdf', 8],
      ['keysQuiz', 1]
    ]);
    console.log(
      '  3 courses, 7 modules, 8 submodules, 12 MCQs, 4 coding questions (100 tests each), learner progress'
    );
  });

  // ---------------------------------------------------------------- user
  await useDb('userService', async () => {
    await CourseMembership.deleteMany({ courseId: { $in: Object.values(courseIds).map(String) } });
    for (const p of PEOPLE) {
      await UserProfile.findOneAndUpdate(
        { userId: ids[p.key] },
        { userId: ids[p.key], name: p.name, email: p.email, bio: p.bio, avatar: '' },
        { upsert: true }
      );
    }
    const enrol = (
      course: mongoose.Types.ObjectId,
      who: PersonKey,
      role: string,
      daysAgo: number
    ) =>
      CourseMembership.create({
        courseId: String(course),
        userId: ids[who],
        role,
        status: 'active',
        assignedBy: ids.admin,
        assignedAt: ago(daysAgo)
      });
    await Promise.all([
      enrol(courseIds.dist, 'sarah', 'admin', 30),
      enrol(courseIds.dist, 'arjun', 'trainer', 30),
      enrol(courseIds.dist, 'alex', 'trainee', 28),
      enrol(courseIds.dist, 'sophia', 'trainee', 28),
      enrol(courseIds.dist, 'bhavya', 'trainee', 25),
      enrol(courseIds.dist, 'marcus', 'trainee', 20),
      enrol(courseIds.dist, 'elena', 'trainee', 5),
      enrol(courseIds.react, 'arjun', 'admin', 15),
      enrol(courseIds.react, 'alex', 'trainee', 10),
      enrol(courseIds.react, 'sophia', 'trainee', 10),
      enrol(courseIds.react, 'elena', 'trainee', 9),
      enrol(courseIds.react, 'bhavya', 'trainee', 9),
      enrol(courseIds.dsa, 'sarah', 'admin', 3),
      enrol(courseIds.dsa, 'alex', 'trainee', 1)
    ]);
    for (const who of ['alex', 'sophia', 'bhavya'] as const) {
      await Competency.findOneAndUpdate(
        { userId: ids[who], skill: 'Distributed systems' },
        {
          userId: ids[who],
          skill: 'Distributed systems',
          level: 'intermediate',
          score: 70 + who.length,
          verifiedBy: ids.sarah
        },
        { upsert: true }
      );
    }
    console.log('  profiles, 14 enrolments, competencies');
  });

  // ---------------------------------------------------------------- chat
  await useDb('chatService', async () => {
    await Promise.all([
      ChatRoom.deleteMany({}),
      ChatMessage.deleteMany({}),
      ReadState.deleteMany({}),
      Notification.deleteMany({})
    ]);
    const name = (k: PersonKey) => PEOPLE.find((p) => p.key === k)!.name;
    const roleIn = (k: PersonKey) =>
      k === 'sarah' || k === 'arjun' ? (k === 'sarah' ? 'admin' : 'trainer') : 'trainee';

    const community = async (
      courseId: mongoose.Types.ObjectId,
      owner: PersonKey,
      extra: { name: string; kind: string; visibility: string; members?: PersonKey[] }[]
    ) => {
      const base = [
        {
          name: 'general',
          kind: 'text',
          description: 'Say hi and talk about anything course related.'
        },
        {
          name: 'announcements',
          kind: 'announcement',
          description: 'Updates from your instructors.'
        },
        {
          name: 'course-discussion',
          kind: 'text',
          description: 'Questions and discussion about the material.'
        },
        { name: 'study-room', kind: 'voice', description: 'Drop in to talk it through.' }
      ];
      const rooms: Record<string, mongoose.Types.ObjectId> = {};
      for (const [i, c] of [
        ...base.map((b) => ({ ...b, visibility: 'public' })),
        ...extra
      ].entries()) {
        const room = await ChatRoom.create({
          name: c.name,
          slug: `${courseId}-${c.name}`,
          description: (c as { description?: string }).description || '',
          type: 'course',
          courseId: String(courseId),
          kind: c.kind,
          visibility: c.visibility,
          position: i,
          creatorId: ids[owner],
          members: ((c as { members?: PersonKey[] }).members || []).map((k) => ({
            userId: ids[k],
            role: k === owner ? 'owner' : 'member',
            joinedAt: ago(20),
            lastReadAt: ago(1)
          }))
        });
        rooms[c.name] = room._id;
      }
      return rooms;
    };

    let t = 20 * 24 * 60; // minutes ago, counting down so messages are in order
    const say = async (
      room: mongoose.Types.ObjectId,
      who: PersonKey,
      content: string,
      opts: {
        mentions?: PersonKey[];
        replyTo?: mongoose.Types.ObjectId;
        reactions?: [string, PersonKey[]][];
      } = {}
    ) => {
      t -= 37;
      let replyTo;
      if (opts.replyTo) {
        const parent = await ChatMessage.findByIdAndUpdate(opts.replyTo, {
          $inc: { replyCount: 1 }
        });
        replyTo = {
          messageId: String(parent!._id),
          senderName: parent!.sender.name,
          snippet: parent!.content.slice(0, 120)
        };
      }
      const msg = await ChatMessage.create({
        roomId: String(room),
        sender: { userId: ids[who], name: name(who), avatar: '', role: roleIn(who) },
        content,
        mentions: (opts.mentions || []).map((k) => ids[k]),
        replyTo,
        reactions: (opts.reactions || []).map(([emoji, users]) => ({
          emoji,
          users: users.map((u) => ids[u]),
          count: users.length
        })),
        createdAt: new Date(Date.now() - t * 60_000),
        updatedAt: new Date(Date.now() - t * 60_000)
      });
      await ChatRoom.updateOne(
        { _id: room },
        {
          lastMessage: {
            messageId: String(msg._id),
            content: content.slice(0, 100),
            senderId: ids[who],
            senderName: name(who),
            createdAt: msg.createdAt
          }
        }
      );
      return msg._id;
    };

    const d = await community(courseIds.dist, 'sarah', [
      { name: 'instructors', kind: 'text', visibility: 'private', members: ['sarah', 'arjun'] }
    ]);
    await say(
      d.announcements,
      'sarah',
      'Welcome to Distributed Systems Bootcamp! Module 1 is open — start with the eight fallacies reading.',
      { reactions: [['🎉', ['alex', 'sophia', 'bhavya']]] }
    );
    const hi = await say(d.general, 'alex', 'Hey everyone 👋 excited to be here!', {
      reactions: [['👋', ['sophia', 'bhavya']]]
    });
    await say(d.general, 'sophia', 'Same! Anyone want to pair on the consistency quiz?', {
      replyTo: hi
    });
    const q1 = await say(
      d['course-discussion'],
      'bhavya',
      'Why does a CP system refuse writes during a partition instead of queueing them?'
    );
    await say(
      d['course-discussion'],
      'sarah',
      'Great question @Bhavya Dhanwani — queueing means some reads would return stale data, which breaks the C in CP.',
      { replyTo: q1, mentions: ['bhavya'], reactions: [['💡', ['bhavya', 'alex']]] }
    );
    await say(
      d['course-discussion'],
      'marcus',
      'Joined late — is it okay to start Module 1 now? My deadline shows 2 weeks from today.'
    );
    await say(
      d['course-discussion'],
      'arjun',
      '@Marcus Vance yes, your deadlines start from when you joined. Catch up at your own pace 👍',
      { mentions: ['marcus'] }
    );
    await say(
      d.announcements,
      'sarah',
      'Module 4 (Observability) opens in 5 days. Finish Kafka before then to stay on the cohort schedule.'
    );
    await say(
      d.instructors,
      'sarah',
      'Marcus and Elena joined late — keep an eye on their progress this week.'
    );
    await say(d.instructors, 'arjun', 'On it. I will check in with both of them.');

    const r = await community(courseIds.react, 'arjun', []);
    await say(
      r.announcements,
      'arjun',
      'Welcome to Modern React & TypeScript! Rendering in depth is live now.'
    );
    await say(r.general, 'elena', 'Hi all! Coming from DevOps, React is new to me 🙂');
    await say(r['course-discussion'], 'alex', 'Is it ever okay to use the array index as a key?', {
      reactions: [['👀', ['sophia']]]
    });

    // alex has read everything in general, so only newer messages elsewhere count as unread
    await ReadState.create({ userId: ids.alex, roomId: String(d.general), lastReadAt: new Date() });
    await Notification.create([
      {
        userId: ids.bhavya,
        type: 'mention',
        courseId: String(courseIds.dist),
        roomId: String(d['course-discussion']),
        messageId: String(q1),
        actorName: name('sarah'),
        text: 'mentioned you in #course-discussion: Great question…'
      },
      {
        userId: ids.marcus,
        type: 'mention',
        courseId: String(courseIds.dist),
        roomId: String(d['course-discussion']),
        messageId: String(q1),
        actorName: name('arjun'),
        text: 'mentioned you in #course-discussion: yes, your deadlines start from when you joined…'
      },
      {
        userId: ids.alex,
        type: 'announcement',
        courseId: String(courseIds.dist),
        roomId: String(d.announcements),
        messageId: String(hi),
        actorName: name('sarah'),
        text: 'posted in #announcements: Module 4 (Observability) opens in 5 days…'
      }
    ]);
    console.log(
      '  2 course communities with channels (text, announcements, voice, private), messages, notifications'
    );
  });

  console.log('\n✓ Seed complete. Sign in with any seeded email and password', PASSWORD);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

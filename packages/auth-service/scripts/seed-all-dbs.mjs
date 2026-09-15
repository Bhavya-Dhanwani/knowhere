import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import fs from 'node:fs';
import path from 'node:path';

function getBaseUri() {
  if (process.env.MONGO_BASE_URI) return process.env.MONGO_BASE_URI;
  if (process.env.AUTH_DB) return process.env.AUTH_DB.replace(/\/[^/?]+(\?.*)?$/, '');
  if (process.env.MONGO_URI) return process.env.MONGO_URI.replace(/\/[^/?]+(\?.*)?$/, '');

  try {
    const secretsPath = path.resolve(process.cwd(), 'k8s/secrets.yml');
    if (fs.existsSync(secretsPath)) {
      const content = fs.readFileSync(secretsPath, 'utf8');
      const match = content.match(/AUTH_DB:\s*(\S+)/);
      if (match && match[1]) {
        return match[1].replace(/\/[^/?]+(\?.*)?$/, '');
      }
    }
  } catch {}

  return 'mongodb://localhost:27017';
}

const BASE_URI = getBaseUri();

async function seed() {
  console.log(' Connecting to MongoDB Atlas...');

  const authDb = process.env.AUTH_DB || `${BASE_URI}/authService`;
  const userDb = process.env.USER_DB || `${BASE_URI}/userService`;
  const mediaDb = process.env.MEDIA_DB || `${BASE_URI}/mediaService`;
  const mcqDb = process.env.MCQ_DB || `${BASE_URI}/mcqService`;
  const codingDb = process.env.CODING_DB || `${BASE_URI}/codingService`;
  const courseDb = process.env.COURSE_DB || `${BASE_URI}/courseService`;
  const chatDb = process.env.CHAT_DB || `${BASE_URI}/chatService`;

  // 1. Connect to AUTH DB
  const authConn = await mongoose.createConnection(authDb).asPromise();
  console.log(' Connected to authService DB');

  // 2. Connect to USER DB
  const userConn = await mongoose.createConnection(userDb).asPromise();
  console.log(' Connected to userService DB');

  // 3. Connect to MEDIA DB
  const mediaConn = await mongoose.createConnection(mediaDb).asPromise();
  console.log(' Connected to mediaService DB');

  // 4. Connect to MCQ DB
  const mcqConn = await mongoose.createConnection(mcqDb).asPromise();
  console.log(' Connected to mcqService DB');

  // 5. Connect to CODING DB
  const codingConn = await mongoose.createConnection(codingDb).asPromise();
  console.log(' Connected to codingService DB');

  // 6. Connect to COURSE DB
  const courseConn = await mongoose.createConnection(courseDb).asPromise();
  console.log(' Connected to courseService DB');

  // 7. Connect to CHAT DB
  const chatConn = await mongoose.createConnection(chatDb).asPromise();
  console.log(' Connected to chatService DB');

  console.log('\n Seeding AUTH and USER databases...');

  // Define User model on authConn
  const AuthUser = authConn.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    providers: [String],
    isVerified: Boolean,
  }));

  // Define UserProfile model on userConn
  const UserProfile = userConn.model('UserProfile', new mongoose.Schema({
    userId: { type: String, unique: true },
    name: String,
    email: String,
    avatar: String,
    bio: String,
    phone: String,
  }, { timestamps: true }));

  // Define CourseMembership on userConn
  const CourseMembership = userConn.model('CourseMembership', new mongoose.Schema({
    courseId: String,
    userId: String,
    role: String,
    status: String,
    assignedBy: String,
    assignedAt: Date,
  }, { timestamps: true }));

  // Define Competency on userConn
  const Competency = userConn.model('Competency', new mongoose.Schema({
    userId: String,
    skill: String,
    level: String,
    score: Number,
    verifiedBy: String,
  }, { timestamps: true }));

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const testUsers = [
    {
      name: 'Alex Rivera',
      email: 'student@example.com',
      role: 'trainee',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
      bio: 'Full Stack Engineering student passionate about distributed systems and cloud architecture.',
    },
    {
      name: 'Bhavya Dhanwani',
      email: 'dhanwanibhavya@example.com',
      role: 'trainee',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=faces',
      bio: 'Software engineer building modern web applications and microservice architectures.',
    },
    {
      name: 'Sarah Connor',
      email: 'trainer@example.com',
      role: 'trainer',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=faces',
      bio: 'Lead Instructor with 8+ years experience in Node.js, Kubernetes, and System Design.',
    },
    {
      name: 'David Miller',
      email: 'admin@example.com',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
      bio: 'LMS Platform Administrator.',
    },
    {
      name: 'Sophia Chen',
      email: 'sophia.chen@example.com',
      role: 'trainee',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=faces',
      bio: 'Competitive programmer and backend enthusiast.',
    },
    {
      name: 'Marcus Vance',
      email: 'marcus.vance@example.com',
      role: 'trainee',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
      bio: 'Frontend wizard specializing in React and TypeScript.',
    },
    {
      name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      role: 'trainee',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
      bio: 'DevOps & Cloud architecture apprentice.',
    },
  ];

  const createdUserRecords = [];

  for (const u of testUsers) {
    let authRecord = await AuthUser.findOne({ email: u.email });
    if (!authRecord) {
      authRecord = await AuthUser.create({
        name: u.name,
        email: u.email,
        password: hashedPassword,
        providers: ['local'],
        isVerified: true,
      });
      console.log(`  Created auth user: ${u.email}`);
    } else {
      authRecord.password = hashedPassword;
      authRecord.isVerified = true;
      await authRecord.save();
      console.log(`  Updated auth user: ${u.email}`);
    }

    const userId = authRecord._id.toString();
    createdUserRecords.push({ ...u, userId, _id: authRecord._id });

    await UserProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        bio: u.bio,
        phone: '+1 (555) 019-2834',
      },
      { upsert: true, new: true }
    );

    // Seed Competencies
    await Competency.findOneAndUpdate(
      { userId, skill: 'JavaScript / TypeScript' },
      { userId, skill: 'JavaScript / TypeScript', level: 'advanced', score: 92, verifiedBy: 'system' },
      { upsert: true }
    );
    await Competency.findOneAndUpdate(
      { userId, skill: 'Microservices & Docker' },
      { userId, skill: 'Microservices & Docker', level: 'intermediate', score: 85, verifiedBy: 'system' },
      { upsert: true }
    );
  }

  // 7. Seed MEDIA DB
  console.log('\n Seeding MEDIA database...');
  const Resource = mediaConn.model('Resource', new mongoose.Schema({
    title: String,
    type: String,
    ownerId: String,
    s3Key: { type: String, unique: true },
    playbackUrl: String,
    durationSeconds: Number,
    fileSizeBytes: Number,
    status: String,
  }, { timestamps: true }));

  const trainerId = createdUserRecords.find(u => u.role === 'trainer')?._id.toString() || 'trainer-1';

  const media1 = await Resource.findOneAndUpdate(
    { s3Key: 'videos/v8-engine-deep-dive.mp4' },
    {
      title: 'Deep Dive: V8 Engine & Libuv Execution Architecture',
      type: 'video',
      ownerId: trainerId,
      s3Key: 'videos/v8-engine-deep-dive.mp4',
      playbackUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      durationSeconds: 2700,
      fileSizeBytes: 480000000,
      status: 'ready',
    },
    { upsert: true, new: true }
  );

  const media2 = await Resource.findOneAndUpdate(
    { s3Key: 'videos/typescript-generics.mp4' },
    {
      title: 'Advanced TypeScript Generics & Type Narrowing',
      type: 'video',
      ownerId: trainerId,
      s3Key: 'videos/typescript-generics.mp4',
      playbackUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      durationSeconds: 3200,
      fileSizeBytes: 520000000,
      status: 'ready',
    },
    { upsert: true, new: true }
  );

  const media3 = await Resource.findOneAndUpdate(
    { s3Key: 'videos/microservices-k8s.mp4' },
    {
      title: 'Containerization, Kubernetes & Ingress Routing',
      type: 'video',
      ownerId: trainerId,
      s3Key: 'videos/microservices-k8s.mp4',
      playbackUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      durationSeconds: 3600,
      fileSizeBytes: 600000000,
      status: 'ready',
    },
    { upsert: true, new: true }
  );

  const mediaNotes = await Resource.findOneAndUpdate(
    { s3Key: 'notes/event-loop-cheatsheet.pdf' },
    {
      title: 'Cheatsheet: Microtask vs Macro-task Queue Lifecycle',
      type: 'notes',
      ownerId: trainerId,
      s3Key: 'notes/event-loop-cheatsheet.pdf',
      playbackUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      durationSeconds: 600,
      fileSizeBytes: 1200000,
      status: 'ready',
    },
    { upsert: true, new: true }
  );
  console.log('  Seeded 4 Media Resources (3 videos, 1 notes).');

  // 8. Seed MCQ DB
  console.log('\n Seeding MCQ database...');
  const MCQQuestion = mcqConn.model('MCQQuestion', new mongoose.Schema({
    title: String,
    stem: String,
    options: [{ id: String, text: String }],
    correct_option_id: String,
    max_score: Number,
    explanation: String,
    creatorId: String,
  }, { timestamps: true }));

  const mcq1 = await MCQQuestion.findOneAndUpdate(
    { title: 'Quiz: Event Loop Task Scheduling & Microtask Queue' },
    {
      title: 'Quiz: Event Loop Task Scheduling & Microtask Queue',
      stem: 'In the Node.js event loop lifecycle, which queue is drained immediately after each synchronous execution phase before macro-tasks run?',
      options: [
        { id: 'A', text: 'Timers Queue (setTimeout / setInterval callbacks)' },
        { id: 'B', text: 'Microtask Queue (process.nextTick and Promise.then callbacks)' },
        { id: 'C', text: 'Check Phase (setImmediate callbacks)' },
        { id: 'D', text: 'Close Callbacks Queue' },
      ],
      correct_option_id: 'B',
      max_score: 25,
      explanation: 'Microtasks (nextTick and resolved Promises) are drained immediately whenever the call stack clears and between every phase of the event loop.',
      creatorId: trainerId,
    },
    { upsert: true, new: true }
  );

  const mcq2 = await MCQQuestion.findOneAndUpdate(
    { title: 'Quiz: TypeScript Utility Types & Type Manipulation' },
    {
      title: 'Quiz: TypeScript Utility Types & Type Manipulation',
      stem: 'Which built-in TypeScript utility type constructs a type where all properties of type T are set to optional?',
      options: [
        { id: 'A', text: 'Partial<T>' },
        { id: 'B', text: 'Required<T>' },
        { id: 'C', text: 'Readonly<T>' },
        { id: 'D', text: 'Record<K, T>' },
      ],
      correct_option_id: 'A',
      max_score: 25,
      explanation: 'Partial<T> makes all properties in T optional by adding the ? modifier.',
      creatorId: trainerId,
    },
    { upsert: true, new: true }
  );
  console.log('  Seeded 2 MCQ Questions.');

  // 9. Seed CODING DB
  console.log('\n Seeding CODING database...');
  const CodingQuestion = codingConn.model('CodingQuestion', new mongoose.Schema({
    title: String,
    description: String,
    starterCode: { type: Map, of: String },
    testCases: [{ input: String, expectedOutput: String, isHidden: Boolean }],
    timeLimitMs: Number,
    memoryLimitMb: Number,
    max_score: Number,
    creatorId: String,
  }, { timestamps: true }));

  const coding1 = await CodingQuestion.findOneAndUpdate(
    { title: 'Two Sum Problem' },
    {
      title: 'Two Sum Problem',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
      starterCode: {
        typescript: `function twoSum(nums: number[], target: number): number[] {\n  const map = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement)!, i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}`,
        javascript: `function twoSum(nums, target) {\n  // Write solution here\n}`,
      },
      testCases: [
        { input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false },
        { input: '[3, 2, 4], 6', expectedOutput: '[1, 2]', isHidden: false },
        { input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: true },
      ],
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      max_score: 50,
      creatorId: trainerId,
    },
    { upsert: true, new: true }
  );

  const coding2 = await CodingQuestion.findOneAndUpdate(
    { title: 'Implement LRU Cache' },
    {
      title: 'Implement LRU Cache',
      description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) time complexity for get and put operations.',
      starterCode: {
        typescript: `class LRUCache {\n  private capacity: number;\n  private cache: Map<number, number>;\n\n  constructor(capacity: number) {\n    this.capacity = capacity;\n    this.cache = new Map();\n  }\n\n  get(key: number): number {\n    if (!this.cache.has(key)) return -1;\n    const val = this.cache.get(key)!;\n    this.cache.delete(key);\n    this.cache.set(key, val);\n    return val;\n  }\n\n  put(key: number, value: number): void {\n    if (this.cache.has(key)) {\n      this.cache.delete(key);\n    } else if (this.cache.size >= this.capacity) {\n      const oldestKey = this.cache.keys().next().value;\n      this.cache.delete(oldestKey);\n    }\n    this.cache.set(key, value);\n  }\n}`,
      },
      testCases: [
        { input: '["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]\n[[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]', expectedOutput: '[null, null, null, 1, null, -1, null, -1, 3, 4]', isHidden: false },
      ],
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      max_score: 100,
      creatorId: trainerId,
    },
    { upsert: true, new: true }
  );
  console.log('  Seeded 2 Coding Challenges.');

  // 10. Seed COURSE DB
  console.log('\n Seeding COURSE database...');
  const Course = courseConn.model('Course', new mongoose.Schema({
    title: String,
    description: String,
    instructorId: String,
    status: String,
    tags: [String],
  }, { timestamps: true }));

  const Module = courseConn.model('Module', new mongoose.Schema({
    courseId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    order: Number,
  }, { timestamps: true }));

  const Submodule = courseConn.model('Submodule', new mongoose.Schema({
    moduleId: mongoose.Schema.Types.ObjectId,
    title: String,
    order: Number,
  }, { timestamps: true }));

  const ContentItem = courseConn.model('ContentItem', new mongoose.Schema({
    submoduleId: mongoose.Schema.Types.ObjectId,
    type: String,
    ref_id: mongoose.Schema.Types.ObjectId,
    title: String,
    order: Number,
    max_score: Number,
  }, { timestamps: true }));

  const completedItemSchema = new mongoose.Schema({
    contentItemId: mongoose.Schema.Types.ObjectId,
    type: { type: String },
    scoreEarned: Number,
    maxScore: Number,
    completedAt: Date,
  }, { _id: false });

  const CourseProgress = courseConn.model('CourseProgress', new mongoose.Schema({
    courseId: mongoose.Schema.Types.ObjectId,
    userId: String,
    totalScoreEarned: Number,
    completedItems: [completedItemSchema],
  }, { timestamps: true }));

  // Primary Course
  const course1 = await Course.findOneAndUpdate(
    { title: 'Full Stack Web Development & System Design Mastery' },
    {
      title: 'Full Stack Web Development & System Design Mastery',
      description: 'Comprehensive industry syllabus covering Modern TypeScript, V8 Engine internals, Distributed Microservices, and Kubernetes.',
      instructorId: trainerId,
      status: 'published',
      tags: ['TypeScript', 'Node.js', 'System Design', 'Kubernetes'],
    },
    { upsert: true, new: true }
  );

  // Second Course
  const course2 = await Course.findOneAndUpdate(
    { title: 'Distributed Systems & Cloud-Native Engineering' },
    {
      title: 'Distributed Systems & Cloud-Native Engineering',
      description: 'Production patterns for high-scale backends, caching strategies, and event-driven architectures.',
      instructorId: trainerId,
      status: 'published',
      tags: ['Kubernetes', 'Docker', 'Redis', 'Microservices'],
    },
    { upsert: true, new: true }
  );

  // Enroll users into Course 1 & 2
  for (const u of createdUserRecords) {
    await CourseMembership.findOneAndUpdate(
      { courseId: course1._id.toString(), userId: u.userId },
      {
        courseId: course1._id.toString(),
        userId: u.userId,
        role: u.role,
        status: 'active',
        assignedBy: 'system',
      },
      { upsert: true }
    );
    await CourseMembership.findOneAndUpdate(
      { courseId: course2._id.toString(), userId: u.userId },
      {
        courseId: course2._id.toString(),
        userId: u.userId,
        role: u.role,
        status: 'active',
        assignedBy: 'system',
      },
      { upsert: true }
    );
  }

  // Modules for Course 1
  const mod1 = await Module.findOneAndUpdate(
    { courseId: course1._id, title: 'Module 01: Modern JavaScript & TypeScript Foundations' },
    {
      courseId: course1._id,
      title: 'Module 01: Modern JavaScript & TypeScript Foundations',
      description: 'Deep dive into runtime internals, compiler mechanics, and advanced typing.',
      order: 1,
    },
    { upsert: true, new: true }
  );

  const mod2 = await Module.findOneAndUpdate(
    { courseId: course1._id, title: 'Module 02: Microservices & Cloud-Native Architectures' },
    {
      courseId: course1._id,
      title: 'Module 02: Microservices & Cloud-Native Architectures' ,
      description: 'Containerization, Kubernetes, NGINX Ingress, and inter-service communications.',
      order: 2,
    },
    { upsert: true, new: true }
  );

  // Submodules for Module 1
  const sub1 = await Submodule.findOneAndUpdate(
    { moduleId: mod1._id, title: '01. Event Loop, Microtasks & Macro-task Scheduling' },
    {
      moduleId: mod1._id,
      title: '01. Event Loop, Microtasks & Macro-task Scheduling',
      order: 1,
    },
    { upsert: true, new: true }
  );

  const sub2 = await Submodule.findOneAndUpdate(
    { moduleId: mod1._id, title: '02. Advanced TypeScript Generics & Type Narrowing' },
    {
      moduleId: mod1._id,
      title: '02. Advanced TypeScript Generics & Type Narrowing',
      order: 2,
    },
    { upsert: true, new: true }
  );

  // Submodules for Module 2
  const sub3 = await Submodule.findOneAndUpdate(
    { moduleId: mod2._id, title: '01. Kubernetes Ingress & Service Networking' },
    {
      moduleId: mod2._id,
      title: '01. Kubernetes Ingress & Service Networking',
      order: 1,
    },
    { upsert: true, new: true }
  );

  // Content Items for Submodule 1.1
  const ci1 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub1._id, ref_id: media1._id },
    {
      submoduleId: sub1._id,
      type: 'video',
      ref_id: media1._id,
      title: 'Deep Dive: V8 Engine & Libuv Execution Architecture',
      order: 1,
      max_score: 50,
    },
    { upsert: true, new: true }
  );

  const ci2 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub1._id, ref_id: mcq1._id },
    {
      submoduleId: sub1._id,
      type: 'mcq',
      ref_id: mcq1._id,
      title: 'Quiz: Event Loop Ordering & Promise Resolution',
      order: 2,
      max_score: 25,
    },
    { upsert: true, new: true }
  );

  const ci3 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub1._id, ref_id: mediaNotes._id },
    {
      submoduleId: sub1._id,
      type: 'notes',
      ref_id: mediaNotes._id,
      title: 'Cheatsheet: Microtask vs Macro-task Queue Lifecycle',
      order: 3,
      max_score: 10,
    },
    { upsert: true, new: true }
  );

  // Content Items for Submodule 1.2
  const ci4 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub2._id, ref_id: media2._id },
    {
      submoduleId: sub2._id,
      type: 'video',
      ref_id: media2._id,
      title: 'Deep Dive: Advanced TypeScript Generics',
      order: 1,
      max_score: 50,
    },
    { upsert: true, new: true }
  );

  const ci5 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub2._id, ref_id: coding1._id },
    {
      submoduleId: sub2._id,
      type: 'coding',
      ref_id: coding1._id,
      title: 'Challenge: Two Sum Problem',
      order: 2,
      max_score: 50,
    },
    { upsert: true, new: true }
  );

  // Content Items for Submodule 2.1
  const ci6 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub3._id, ref_id: media3._id },
    {
      submoduleId: sub3._id,
      type: 'video',
      ref_id: media3._id,
      title: 'Deep Dive: Microservices & Kubernetes Architecture',
      order: 1,
      max_score: 50,
    },
    { upsert: true, new: true }
  );

  const ci7 = await ContentItem.findOneAndUpdate(
    { submoduleId: sub3._id, ref_id: coding2._id },
    {
      submoduleId: sub3._id,
      type: 'coding',
      ref_id: coding2._id,
      title: 'Challenge: Implement LRU Cache',
      order: 2,
      max_score: 100,
    },
    { upsert: true, new: true }
  );

  console.log('  Seeded 2 Courses, 2 Modules, 3 Submodules, and 7 Content Items.');

  // Seed Leaderboard Progress
  const progressSeedData = [
    { email: 'sophia.chen@example.com', score: 3400, items: [ci1, ci2, ci3, ci4, ci5, ci6, ci7] },
    { email: 'marcus.vance@example.com', score: 3150, items: [ci1, ci2, ci4, ci5, ci6] },
    { email: 'elena.rostova@example.com', score: 2850, items: [ci1, ci2, ci3, ci4, ci5] },
    { email: 'dhanwanibhavya@example.com', score: 2600, items: [ci1, ci2, ci3, ci4] },
    { email: 'student@example.com', score: 2450, items: [ci1, ci2, ci3, ci4] },
  ];

  for (const entry of progressSeedData) {
    const userRec = createdUserRecords.find(u => u.email === entry.email);
    if (!userRec) continue;

    await CourseProgress.findOneAndUpdate(
      { courseId: course1._id, userId: userRec.userId },
      {
        courseId: course1._id,
        userId: userRec.userId,
        totalScoreEarned: entry.score,
        completedItems: entry.items.map(ci => ({
          contentItemId: ci._id,
          type: ci.type,
          scoreEarned: ci.max_score,
          maxScore: ci.max_score,
          completedAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 5)),
        })),
      },
      { upsert: true }
    );
  }
  console.log('  Seeded CourseProgress for 5 students for Live Leaderboard.');

  // 11. Seed CHAT DB
  console.log('\n Seeding CHAT database...');
  const ChatRoom = chatConn.model('ChatRoom', new mongoose.Schema({
    name: String,
    slug: { type: String, unique: true },
    description: String,
    type: String,
    courseId: String,
    icon: String,
    creatorId: String,
    members: [{ userId: String, role: String, joinedAt: Date, lastReadAt: Date }],
    isArchived: Boolean,
    pinnedMessageIds: [String],
    lastMessage: Object,
  }, { timestamps: true }));

  const ChatMessage = chatConn.model('ChatMessage', new mongoose.Schema({
    roomId: String,
    sender: { userId: String, name: String, avatar: String, role: String },
    content: String,
    attachments: Array,
    replyTo: Object,
    reactions: [{ emoji: String, users: [String], count: Number }],
    isPinned: Boolean,
    isEdited: Boolean,
    deletedAt: Date,
  }, { timestamps: true }));

  const allUserMembers = createdUserRecords.map(u => ({
    userId: u.userId,
    role: u.role === 'admin' ? 'owner' : u.role === 'trainer' ? 'moderator' : 'member',
    joinedAt: new Date(),
    lastReadAt: new Date()
  }));

  const generalRoom = await ChatRoom.findOneAndUpdate(
    { slug: 'general' },
    {
      name: 'general',
      slug: 'general',
      description: 'General community discussion and introductions',
      type: 'public',
      creatorId: trainerId,
      members: allUserMembers,
      isArchived: false,
    },
    { upsert: true, new: true }
  );

  const webDevRoom = await ChatRoom.findOneAndUpdate(
    { slug: 'web-development' },
    {
      name: 'web-development',
      slug: 'web-development',
      description: 'Modern TypeScript, distributed systems, and backend design questions',
      type: 'public',
      creatorId: trainerId,
      members: allUserMembers,
      isArchived: false,
    },
    { upsert: true, new: true }
  );

  const courseChatRoom = await ChatRoom.findOneAndUpdate(
    { slug: 'course-mastery-qa' },
    {
      name: 'course-mastery-qa',
      slug: 'course-mastery-qa',
      description: 'Questions and study group for Full Stack Web Development & System Design',
      type: 'course',
      courseId: course1._id.toString(),
      creatorId: trainerId,
      members: allUserMembers,
      isArchived: false,
    },
    { upsert: true, new: true }
  );

  // Seed sample messages
  const sarahUser = createdUserRecords.find(u => u.role === 'trainer');
  const alexUser = createdUserRecords.find(u => u.email === 'student@example.com');
  const sophiaUser = createdUserRecords.find(u => u.email === 'sophia.chen@example.com');

  if (sarahUser && alexUser && sophiaUser) {
    await ChatMessage.deleteMany({ roomId: generalRoom._id.toString() });

    const msg1 = await ChatMessage.create({
      roomId: generalRoom._id.toString(),
      sender: { userId: sarahUser.userId, name: sarahUser.name, avatar: sarahUser.avatar, role: 'trainer' },
      content: 'Welcome to the Knowhere LMS community chat! Feel free to ask questions, share code snippets, and collaborate with your peers.',
      reactions: [{ emoji: '👋', users: [alexUser.userId, sophiaUser.userId], count: 2 }],
      createdAt: new Date(Date.now() - 3600000 * 2)
    });

    const msg2 = await ChatMessage.create({
      roomId: generalRoom._id.toString(),
      sender: { userId: sophiaUser.userId, name: sophiaUser.name, avatar: sophiaUser.avatar, role: 'trainee' },
      content: 'Excited to be here! The V8 engine module and microtask scheduling walkthrough was super clear.',
      replyTo: { messageId: msg1._id.toString(), senderName: sarahUser.name, snippet: 'Welcome to the Knowhere LMS community chat!' },
      reactions: [{ emoji: '🔥', users: [sarahUser.userId], count: 1 }],
      createdAt: new Date(Date.now() - 3600000)
    });

    await ChatMessage.create({
      roomId: generalRoom._id.toString(),
      sender: { userId: alexUser.userId, name: alexUser.name, avatar: alexUser.avatar, role: 'trainee' },
      content: 'Hey everyone! Working on the LRU Cache coding challenge right now. Anyone want to discuss eviction strategies?',
      reactions: [{ emoji: '🚀', users: [sophiaUser.userId], count: 1 }, { emoji: '💡', users: [sarahUser.userId], count: 1 }],
      createdAt: new Date(Date.now() - 600000)
    });

    await generalRoom.updateOne({
      lastMessage: {
        messageId: msg2._id.toString(),
        content: 'Hey everyone! Working on the LRU Cache coding challenge right now...',
        senderId: alexUser.userId,
        senderName: alexUser.name,
        createdAt: new Date()
      }
    });
  }

  console.log('  Seeded 3 Chat Rooms (#general, #web-development, #course-mastery-qa) with sample messages.');

  // Close all connections
  await Promise.all([
    authConn.close(),
    userConn.close(),
    mediaConn.close(),
    mcqConn.close(),
    codingConn.close(),
    courseConn.close(),
    chatConn.close(),
  ]);

  console.log('\n SUCCESS! All 7 databases populated successfully.');
  console.log('====================================================');
  console.log('Test Accounts (Password for all: Password123!):');
  console.log('  1. Student: student@example.com');
  console.log('  2. Student: dhanwanibhavya@example.com');
  console.log('  3. Trainer: trainer@example.com');
  console.log('  4. Admin:   admin@example.com');
  console.log('Course ID: ' + course1._id.toString());
  console.log('====================================================\n');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

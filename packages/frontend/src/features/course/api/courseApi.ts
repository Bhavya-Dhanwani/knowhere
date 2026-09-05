import { axiosClient } from '../../../shared/lib/axiosClient';
import { ContentItemDetail, CourseStructure, LeaderboardData } from '../../../shared/types';

const MOCK_COURSE_STRUCTURE: CourseStructure = {
  id: 'course-web-dev',
  title: 'Full Stack Web Development & System Design Mastery',
  badge: 'Batches 2026',
  overallProgress: 42,
  totalModules: 6,
  completedModules: 3,
  totalSubmodules: 24,
  completedSubmodules: 11,
  totalScore: 5890,
  maxScore: 14650,
  modules: [
    {
      id: 'mod-1',
      title: 'Module 01: Modern JavaScript & TypeScript Foundations',
      order: 1,
      submodules: [
        {
          id: 'sub-1',
          title: '01. Event Loop, Microtasks & Macro-task Scheduling',
          order: 1,
          status: 'completed',
          contentItems: [
            {
              id: 'item-101',
              title: 'Deep Dive: V8 Engine & Libuv Execution Architecture',
              type: 'video',
              marks: 50,
              status: 'completed',
              durationMinutes: 45
            },
            {
              id: 'item-102',
              title: 'Quiz: Event Loop Ordering & Promise Resolution',
              type: 'mcq',
              marks: 25,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-2',
          title: '02. Advanced TypeScript Generics & Type Narrowing',
          order: 2,
          status: 'completed',
          contentItems: [
            {
              id: 'item-103',
              title: 'Video: Conditional Types and Utility Type Internals',
              type: 'video',
              marks: 50,
              status: 'completed',
              durationMinutes: 38
            },
            {
              id: 'item-104',
              title: 'Challenge: Implement DeepReadonly and TupleToUnion',
              type: 'coding',
              marks: 100,
              status: 'completed'
            }
          ]
        }
      ]
    },
    {
      id: 'mod-2',
      title: 'Module 02: React 18 Internals & State Architecture',
      order: 2,
      submodules: [
        {
          id: 'sub-3',
          title: '03. Fiber Tree, Reconciliation & Concurrent Transitions',
          order: 1,
          status: 'in_progress',
          contentItems: [
            {
              id: 'item-201',
              title: 'Class: React 18 Fiber Reconciliation & Double Buffering',
              type: 'video',
              marks: 60,
              status: 'in_progress',
              durationMinutes: 52
            },
            {
              id: 'item-202',
              title: 'Challenge: Custom useTransition Debounced Search',
              type: 'coding',
              marks: 100,
              status: 'in_progress'
            }
          ]
        },
        {
          id: 'sub-4',
          title: '04. Server State vs Client State (TanStack Query + Redux)',
          order: 2,
          status: 'locked',
          contentItems: [
            {
              id: 'item-203',
              title: 'Video: Cache Invalidation, Hydration & Data Routers',
              type: 'video',
              marks: 50,
              status: 'locked',
              durationMinutes: 40
            },
            {
              id: 'item-204',
              title: 'Quiz: Optimistic Updates & Cache Garbage Collection',
              type: 'mcq',
              marks: 30,
              status: 'locked'
            }
          ]
        }
      ]
    },
    {
      id: 'mod-3',
      title: 'Module 03: Node.js Backend & Scalable Microservices',
      order: 3,
      submodules: [
        {
          id: 'sub-5',
          title: '05. Distributed Systems, Ingress & Database Sharding',
          order: 1,
          status: 'locked',
          contentItems: [
            {
              id: 'item-301',
              title: 'Video: Kubernetes Ingress Controllers & Service Meshes',
              type: 'video',
              marks: 75,
              status: 'locked',
              durationMinutes: 65
            }
          ]
        }
      ]
    }
  ]
};

const MOCK_CONTENT_DETAILS: Record<string, ContentItemDetail> = {
  'item-201': {
    id: 'item-201',
    title: 'Class: React 18 Fiber Reconciliation & Double Buffering',
    type: 'video',
    marks: 60,
    status: 'in_progress',
    durationMinutes: 52,
    description:
      'Understand how the React 18 workLoopConcurrent processes fiber units of work without blocking the main browser thread. Learn how double buffering swaps current and work-in-progress trees.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    earnedMarks: 0
  },
  'item-202': {
    id: 'item-202',
    title: 'Challenge: Custom useTransition Debounced Search',
    type: 'coding',
    marks: 100,
    status: 'in_progress',
    description:
      'Implement an efficient debounced autocompletion hook using React 18 startTransition to prevent UI stutter while rendering heavy result lists.',
    language: 'typescript',
    starterCode: `import { useState, useTransition } from 'react';\n\nexport function useDebouncedSearch<T>(searchFn: (query: string) => Promise<T[]>, delay = 300) {\n  const [query, setQuery] = useState('');\n  const [results, setResults] = useState<T[]>([]);\n  const [isPending, startTransition] = useTransition();\n\n  // TODO: Implement debounced transition\n\n  return { query, setQuery, results, isPending };\n}`,
    earnedMarks: 0
  },
  'item-101': {
    id: 'item-101',
    title: 'Deep Dive: V8 Engine & Libuv Execution Architecture',
    type: 'video',
    marks: 50,
    status: 'completed',
    durationMinutes: 45,
    description:
      'Detailed analysis of heap allocation, callstack frames, and asynchronous thread pool management in Node.js.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    earnedMarks: 50
  },
  'item-102': {
    id: 'item-102',
    title: 'Quiz: Event Loop Ordering & Promise Resolution',
    type: 'mcq',
    marks: 25,
    status: 'completed',
    description:
      'Test your understanding of setTimeout vs process.nextTick vs Promise.then resolution order.',
    mcqOptions: [
      { id: 'opt-1', text: 'nextTick executes before Promise microtasks' },
      { id: 'opt-2', text: 'setTimeout(fn, 0) always precedes microtasks' },
      { id: 'opt-3', text: 'setImmediate executes in the poll phase' },
      { id: 'opt-4', text: 'process.nextTick is managed by libuv' }
    ],
    earnedMarks: 25
  }
};

const MOCK_LEADERBOARD: LeaderboardData = {
  topThree: [
    {
      id: 'student-2',
      name: 'Rohan Sharma',
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      rank: 2,
      points: 12450
    },
    {
      id: 'student-1',
      name: 'Aanya Patel',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      rank: 1,
      points: 14200
    },
    {
      id: 'student-3',
      name: 'Devraj Singh',
      avatar:
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
      rank: 3,
      points: 11890
    }
  ],
  rankings: [
    { id: 'student-4', name: 'Sneha Roy', rank: 4, points: 10420 },
    { id: 'student-5', name: 'Tanmay Bhatt', rank: 5, points: 9850 },
    { id: 'student-6', name: 'Priya Nair', rank: 6, points: 8920 },
    { id: 'student-7', name: 'You (Alex Rivera)', rank: 7, points: 5890, aheadPercentage: 74 },
    { id: 'student-8', name: 'Kunal Verma', rank: 8, points: 5410 }
  ],
  aheadPercentage: 74
};

export const courseApi = {
  getCourseStructure: async (courseId: string): Promise<CourseStructure> => {
    try {
      const response = await axiosClient.get(`/courses/${courseId}`);
      const course = response.data?.data || response.data;
      if (course && course.modules && course.modules.length > 0) {
        return course;
      }
      return { ...MOCK_COURSE_STRUCTURE, id: courseId };
    } catch {
      return { ...MOCK_COURSE_STRUCTURE, id: courseId };
    }
  },

  getSubmoduleContent: async (contentItemId: string): Promise<ContentItemDetail> => {
    try {
      const response = await axiosClient.get(`/content-items/${contentItemId}`);
      const item = response.data?.data || response.data;
      if (item && item.title) {
        return item;
      }
      return MOCK_CONTENT_DETAILS[contentItemId] || MOCK_CONTENT_DETAILS['item-201'];
    } catch {
      return MOCK_CONTENT_DETAILS[contentItemId] || MOCK_CONTENT_DETAILS['item-201'];
    }
  },

  getLeaderboard: async (courseId: string): Promise<LeaderboardData> => {
    try {
      const response = await axiosClient.get(`/courses/${courseId}/grades`);
      const data = response.data?.data || response.data;
      if (data && data.rankings) {
        return data;
      }
      return MOCK_LEADERBOARD;
    } catch {
      return MOCK_LEADERBOARD;
    }
  },

  completeContentItem: async (
    courseId: string,
    itemId: string
  ): Promise<{ marksAwarded: number }> => {
    const response = await axiosClient.post(
      `/courses/${courseId}/content-items/${itemId}/complete`
    );
    return response.data?.data || response.data;
  }
};

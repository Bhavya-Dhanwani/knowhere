import { axiosClient } from '../../../shared/lib/axiosClient';
import { ContentItemDetail, CourseStructure, LeaderboardData } from '../../../shared/types';

const MOCK_COURSE_STRUCTURE: CourseStructure = {
  id: 'course-dsa-bootcamp',
  title: 'DSA for Bootcamp',
  badge: 'Batch 2026',
  overallProgress: 86.89,
  totalModules: 5,
  completedModules: 3,
  totalSubmodules: 22,
  completedSubmodules: 16,
  totalScore: 15880,
  maxScore: 18280,
  modules: [
    {
      id: 'mod-frontend',
      title: 'Front-End',
      order: 1,
      status: 'completed',
      submodules: [
        {
          id: 'sub-fe-html-css',
          title: 'Semantic HTML5, CSS Grid & Flexbox Masterclass',
          order: 1,
          status: 'completed',
          deadline: 'March 01, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-fe-1',
              title: 'Responsive Web Design & Box Model',
              type: 'video',
              marks: 30,
              status: 'completed',
              durationMinutes: 40
            }
          ]
        },
        {
          id: 'sub-fe-react-ts',
          title: 'React 18 Architecture & TypeScript Hooks',
          order: 2,
          status: 'completed',
          deadline: 'March 08, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-fe-2',
              title: 'State Primitives, Reducers & Custom Hooks',
              type: 'coding',
              marks: 70,
              status: 'completed'
            }
          ]
        }
      ]
    },
    {
      id: 'mod-backend',
      title: 'Backend',
      order: 2,
      isNew: true,
      status: 'completed',
      submodules: [
        {
          id: 'sub-node',
          title: 'Node.js Architecture & Libuv',
          order: 1,
          isNew: true,
          status: 'completed',
          deadline: 'March 15, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-node-1',
              title: 'Deep Dive: V8 Engine & Libuv Execution Architecture',
              type: 'video',
              marks: 50,
              status: 'completed',
              durationMinutes: 45
            },
            {
              id: 'item-node-2',
              title: 'Quiz: Event Loop Ordering & Promise Resolution',
              type: 'mcq',
              marks: 25,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-express',
          title: 'Express.js & REST API Design',
          order: 2,
          status: 'completed',
          deadline: 'March 20, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-exp-1',
              title: 'Middleware Chains, Error Handlers & Controllers',
              type: 'video',
              marks: 50,
              status: 'completed',
              durationMinutes: 40
            }
          ]
        },
        {
          id: 'sub-prisma',
          title: 'Prisma ORM & PostgreSQL Schema',
          order: 3,
          status: 'completed',
          deadline: 'March 25, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-prisma-1',
              title: 'Schema Migrations, Relations & Connection Pooling',
              type: 'coding',
              marks: 100,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-jwt',
          title: 'Authentication & JWT Security',
          order: 4,
          status: 'completed',
          deadline: 'March 30, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-jwt-1',
              title: 'Access Tokens, Refresh Rotation & HttpOnly Cookies',
              type: 'coding',
              marks: 80,
              status: 'completed'
            }
          ]
        }
      ]
    },
    {
      id: 'mod-dsa',
      title: 'Data Structure & Algorithm',
      order: 2,
      status: 'completed',
      submodules: [
        {
          id: 'sub-res',
          title: 'Resources',
          order: 1,
          status: 'completed',
          deadline: 'February 25, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-res-1',
              title: 'Curated Cheat-sheets & Documentation',
              type: 'resource',
              marks: 20,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-dsa-intro',
          title: '1 - Dsa Introduction',
          order: 2,
          status: 'completed',
          deadline: 'March 2, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-dsa-1',
              title: 'Dsa Introduction',
              type: 'video',
              marks: 10,
              status: 'completed',
              durationMinutes: 45
            }
          ]
        },
        {
          id: 'sub-js-essentials',
          title: '2 - JS Essentials',
          order: 3,
          status: 'completed',
          deadline: 'March 7, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-js-1',
              title: 'Memory Management, Call Stack & Hoisting',
              type: 'video',
              marks: 50,
              status: 'completed',
              durationMinutes: 40
            }
          ]
        },
        {
          id: 'sub-operator',
          title: '3 - Operator',
          order: 4,
          status: 'completed',
          deadline: 'March 12, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-op-1',
              title: 'Bitwise Operators & Arithmetic Precedence',
              type: 'coding',
              marks: 75,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-math-function',
          title: '4 - Math Function',
          order: 5,
          status: 'completed',
          deadline: 'March 17, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-math-1',
              title: 'Math API, Primes, Sieve of Eratosthenes',
              type: 'coding',
              marks: 100,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-conditional',
          title: '5 - Conditional Statement',
          order: 6,
          status: 'completed',
          deadline: 'March 22, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-cond-1',
              title: 'Branching logic, Ternary & Truthy/Falsy traps',
              type: 'mcq',
              marks: 30,
              status: 'completed'
            }
          ]
        },
        {
          id: 'sub-switch-case',
          title: '6 - Switch Case',
          order: 7,
          status: 'completed',
          deadline: 'March 27, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-switch-1',
              title: 'Switch Jump Tables & Pattern Matching',
              type: 'coding',
              marks: 60,
              status: 'completed'
            }
          ]
        }
      ]
    },
    {
      id: 'mod-aptitude',
      title: 'Aptitude And Reasoning',
      order: 3,
      submodules: [
        {
          id: 'sub-quant',
          title: 'Quantitative Aptitude Fundamentals',
          order: 1,
          status: 'in_progress',
          deadline: 'April 05, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-quant-1',
              title: 'Number Systems, Percentages & Ratios',
              type: 'video',
              marks: 40,
              status: 'completed',
              durationMinutes: 50
            }
          ]
        },
        {
          id: 'sub-logical',
          title: 'Logical Reasoning & Puzzles',
          order: 2,
          status: 'in_progress',
          deadline: 'April 10, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-log-1',
              title: 'Syllogisms, Blood Relations & Seating Arrangements',
              type: 'mcq',
              marks: 35,
              status: 'in_progress'
            }
          ]
        },
        {
          id: 'sub-verbal',
          title: 'Verbal Ability & Comprehension',
          order: 3,
          status: 'in_progress',
          deadline: 'April 15, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-verb-1',
              title: 'Reading Comprehension & Sentence Correction',
              type: 'mcq',
              marks: 30,
              status: 'in_progress'
            }
          ]
        }
      ]
    },
    {
      id: 'mod-threejs',
      title: 'Three Js',
      order: 4,
      isNew: true,
      submodules: [
        {
          id: 'sub-three-basics',
          title: 'Three.js ( Basics )',
          order: 1,
          isNew: true,
          status: 'in_progress',
          deadline: 'April 20, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-three-1',
              title: 'WebGL, Scenes, Renderer & RequestAnimationFrame',
              type: 'video',
              marks: 50,
              status: 'in_progress',
              durationMinutes: 45
            }
          ]
        },
        {
          id: 'sub-three-boilerplate',
          title: 'Three.js (Complete Boilerplate)',
          order: 2,
          isNew: true,
          status: 'in_progress',
          deadline: 'April 25, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-three-2',
              title: 'Setting up Vite, Canvas, OrbitControls & Resizing',
              type: 'coding',
              marks: 60,
              status: 'in_progress'
            }
          ]
        },
        {
          id: 'sub-three-camera',
          title: 'Three.js (Camera, Geometry and Material)',
          order: 3,
          isNew: true,
          status: 'in_progress',
          deadline: 'May 02, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-three-3',
              title: 'Perspective vs Orthographic Camera, BufferGeometries & MeshStandardMaterial',
              type: 'video',
              marks: 80,
              status: 'in_progress',
              durationMinutes: 55
            }
          ]
        },
        {
          id: 'sub-three-textures',
          title: 'Three.js (Textures and More)',
          order: 4,
          isNew: true,
          status: 'in_progress',
          deadline: 'May 09, 2026, 12:00 am',
          contentItems: [
            {
              id: 'item-three-4',
              title: 'TextureLoader, UV Mapping, Normal & Roughness Maps',
              type: 'coding',
              marks: 90,
              status: 'in_progress'
            }
          ]
        }
      ]
    }
  ]
};

const MOCK_CONTENT_DETAILS: Record<string, ContentItemDetail> = {
  'item-dsa-1': {
    id: 'item-dsa-1',
    title: 'Dsa Introduction',
    type: 'video',
    marks: 10,
    status: 'completed',
    durationMinutes: 45,
    description:
      'Welcome to Data Structures and Algorithms! In this foundational class, we analyze time and space complexity, understand Big-O asymptotes, learn how CPU cycles and memory cache affect algorithms, and explore standard coding methodologies.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    earnedMarks: 10
  },
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
  },
  'item-three-1': {
    id: 'item-three-1',
    title: 'Three.js ( Basics )',
    type: 'video',
    marks: 50,
    status: 'in_progress',
    durationMinutes: 45,
    description:
      'Foundations of 3D rendering in the browser using Three.js. Learn how WebGL rasterizes vertices, configuring a Scene, PerspectiveCamera, WebGLRenderer, and maintaining the animation loop with requestAnimationFrame.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    earnedMarks: 0
  },
  'item-three-2': {
    id: 'item-three-2',
    title: 'Three.js (Complete Boilerplate)',
    type: 'coding',
    marks: 60,
    status: 'in_progress',
    description:
      'Set up a production-ready Three.js boilerplate with Vite, TypeScript, resize event listener handlers, pixel ratio clamps, and OrbitControls.',
    language: 'typescript',
    starterCode: `import * as THREE from 'three';\nimport { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';\n\n// Scene, Camera, Renderer setup\nconst scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);\nconst renderer = new THREE.WebGLRenderer({ antialias: true });\n\n// TODO: Implement resize handler & animate loop\n`,
    earnedMarks: 0
  },
  'item-three-3': {
    id: 'item-three-3',
    title: 'Three.js (Camera, Geometry and Material)',
    type: 'video',
    marks: 80,
    status: 'in_progress',
    durationMinutes: 55,
    description:
      'Explore BoxGeometry, SphereGeometry, and custom BufferGeometry. Understand materials like MeshBasicMaterial, MeshLambertMaterial, and physically-based MeshStandardMaterial.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    earnedMarks: 0
  },
  'item-three-4': {
    id: 'item-three-4',
    title: 'Three.js (Textures and More)',
    type: 'coding',
    marks: 90,
    status: 'in_progress',
    description:
      'Load color, normal, roughness, and ambient occlusion textures using TextureLoader with mipmapping and anisotropic filtering.',
    language: 'typescript',
    starterCode: `import * as THREE from 'three';\n\nconst textureLoader = new THREE.TextureLoader();\n// TODO: Load textures and apply to MeshStandardMaterial\n`,
    earnedMarks: 0
  }
};

const MOCK_LEADERBOARD: LeaderboardData = {
  topThree: [
    {
      id: 'student-dishant',
      name: 'Dishant',
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      rank: 2,
      points: 13340
    },
    {
      id: 'student-bhavya',
      name: 'Bhavya',
      avatar: '',
      rank: 1,
      points: 15880
    },
    {
      id: 'student-nihal',
      name: 'Nihal',
      avatar:
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
      rank: 3,
      points: 10470
    }
  ],
  rankings: [
    { id: 'student-sharat', name: 'Sharat Katwa', rank: 4, points: 9530 },
    { id: 'student-satyam', name: 'Satyam Sharma', rank: 5, points: 9040 },
    { id: 'student-praman', name: 'Praman Bhogal', rank: 6, points: 8600 },
    { id: 'student-ashutosh', name: 'Ashutoshh', rank: 7, points: 7460 },
    { id: 'student-mekail', name: 'SK MEKAIL ALI', rank: 8, points: 7210 },
    { id: 'student-krish', name: 'Krish Khambhati', rank: 9, points: 7130 },
    { id: 'student-om', name: 'Om Mhatre', rank: 10, points: 6960 },
    { id: 'student-subham', name: 'Subham Samanta', rank: 11, points: 6730 }
  ],
  aheadPercentage: 100.0
};

const COURSE_STRUCTURES_STORE: Record<string, CourseStructure> = {
  'course-dsa-bootcamp': MOCK_COURSE_STRUCTURE
};

export const courseApi = {
  saveCourseStructure: (courseId: string, structure: CourseStructure) => {
    COURSE_STRUCTURES_STORE[courseId] = structure;
  },

  saveContentItemDetail: (itemDetail: ContentItemDetail) => {
    MOCK_CONTENT_DETAILS[itemDetail.id] = itemDetail;
  },

  initCourseStructure: (courseId: string, title: string) => {
    if (!COURSE_STRUCTURES_STORE[courseId]) {
      COURSE_STRUCTURES_STORE[courseId] = {
        id: courseId,
        title,
        overallProgress: 0,
        totalModules: 0,
        completedModules: 0,
        totalSubmodules: 0,
        completedSubmodules: 0,
        totalScore: 0,
        maxScore: 0,
        modules: []
      };
    }
    return COURSE_STRUCTURES_STORE[courseId];
  },

  getCourseStructure: async (courseId: string): Promise<CourseStructure> => {
    try {
      const response = await axiosClient.get(`/courses/${courseId}`);
      const course = response.data?.data || response.data;
      if (course && course.modules && course.modules.length > 0) {
        return course;
      }
      if (COURSE_STRUCTURES_STORE[courseId]) {
        return COURSE_STRUCTURES_STORE[courseId];
      }
      return { ...MOCK_COURSE_STRUCTURE, id: courseId };
    } catch {
      if (COURSE_STRUCTURES_STORE[courseId]) {
        return COURSE_STRUCTURES_STORE[courseId];
      }
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

import { axiosClient } from '../../../shared/lib/axiosClient';

export interface AdminCourseSummary {
  id: string;
  title: string;
  code: string;
  thumbnail: string;
  status: 'published' | 'draft' | 'archived';
  category: string;
  instructorName: string;
  totalStudents: number;
  totalModules: number;
  totalSubmodules: number;
  averageProgress: number;
  createdAt: string;
  discordUrl?: string;
}

export interface CourseMember {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'trainer' | 'trainee';
  enrolledAt: string;
  progressPercent: number;
  points: number;
}

export interface AdminActivityAlert {
  id: string;
  title: string;
  message: string;
  type: 'enrollment' | 'evaluation' | 'system' | 'submission';
  timestamp: string;
  isRead?: boolean;
}

const MOCK_ADMIN_COURSES: AdminCourseSummary[] = [
  {
    id: 'course-dsa-bootcamp',
    title: 'DSA for Bootcamp',
    code: 'CS-204',
    thumbnail:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    status: 'published',
    category: 'Computer Science',
    instructorName: 'Dr. Arjun Verma',
    totalStudents: 142,
    totalModules: 5,
    totalSubmodules: 22,
    averageProgress: 76.4,
    createdAt: 'January 12, 2026',
    discordUrl: 'https://discord.gg/knowhere'
  },
  {
    id: 'course-kodex-bootcamp',
    title: 'Kodex Bootcamp',
    code: 'FS-101',
    thumbnail:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    status: 'published',
    category: 'Full-Stack Development',
    instructorName: 'Sarah Jenkins',
    totalStudents: 98,
    totalModules: 6,
    totalSubmodules: 30,
    averageProgress: 48.2,
    createdAt: 'December 20, 2025',
    discordUrl: 'https://discord.gg/knowhere'
  },
  {
    id: 'course-c-programming',
    title: 'C Programming For Beginners',
    code: 'CP-100',
    thumbnail:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    status: 'published',
    category: 'Systems Engineering',
    instructorName: 'David K.',
    totalStudents: 215,
    totalModules: 4,
    totalSubmodules: 18,
    averageProgress: 61.9,
    createdAt: 'November 15, 2025',
    discordUrl: 'https://discord.gg/knowhere'
  },
  {
    id: 'course-ai-cohort',
    title: '2.0 Job Ready AI Powered Cohort',
    code: 'AI-500',
    thumbnail:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    status: 'published',
    category: 'Machine Learning',
    instructorName: 'Elena Rostova',
    totalStudents: 310,
    totalModules: 8,
    totalSubmodules: 44,
    averageProgress: 88.5,
    createdAt: 'November 05, 2025',
    discordUrl: 'https://discord.gg/knowhere'
  }
];

const MOCK_ADMIN_ALERTS: AdminActivityAlert[] = [
  {
    id: 'alert-1',
    title: 'New Trainee Batch Enrolled',
    message: '28 trainees joined DSA for Bootcamp from Spring Cohort.',
    type: 'enrollment',
    timestamp: '10m ago'
  },
  {
    id: 'alert-2',
    title: 'Evaluation Pipeline Completed',
    message: 'Automated code review finished for Project Review Event #4.',
    type: 'evaluation',
    timestamp: '42m ago'
  },
  {
    id: 'alert-3',
    title: 'Curriculum Module Published',
    message: 'Backend Module "Node.js Architecture & Libuv" was marked live.',
    type: 'system',
    timestamp: '3h ago'
  }
];

const MOCK_MEMBERS: Record<string, CourseMember[]> = {
  'course-dsa-bootcamp': [
    {
      userId: 'usr-1',
      name: 'Bhavya Dhanwani',
      email: 'bhavya@knowhere.dev',
      role: 'admin',
      enrolledAt: 'Jan 15, 2026',
      progressPercent: 86.89,
      points: 15880
    },
    {
      userId: 'usr-2',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      role: 'trainee',
      enrolledAt: 'Jan 18, 2026',
      progressPercent: 94.2,
      points: 17850
    },
    {
      userId: 'usr-3',
      name: 'Rohan Gupta',
      email: 'rohan.g@example.com',
      role: 'trainee',
      enrolledAt: 'Jan 19, 2026',
      progressPercent: 91.0,
      points: 16900
    },
    {
      userId: 'usr-4',
      name: 'Priya Iyer',
      email: 'priya.iyer@example.com',
      role: 'trainer',
      enrolledAt: 'Jan 14, 2026',
      progressPercent: 100,
      points: 18280
    },
    {
      userId: 'usr-5',
      name: 'Kabir Mehta',
      email: 'kabir.m@example.com',
      role: 'trainee',
      enrolledAt: 'Jan 22, 2026',
      progressPercent: 78.5,
      points: 14200
    }
  ]
};

export const adminApi = {
  // 1. Course Management
  listCourses: async (): Promise<AdminCourseSummary[]> => {
    try {
      const res = await axiosClient.get('/courses');
      if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
        return res.data.data.map((c: any) => ({
          id: c._id || c.id,
          title: c.title || 'Untitled Course',
          code: c.code || 'CS-100',
          thumbnail:
            c.thumbnail ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
          status: 'published',
          category: c.category || 'Engineering',
          instructorName: c.instructorName || 'Lead Faculty',
          totalStudents: c.totalStudents || 120,
          totalModules: c.totalModules || 5,
          totalSubmodules: c.totalSubmodules || 20,
          averageProgress: c.averageProgress || 72.5,
          createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'
        }));
      }
    } catch {
      // fallback to mock
    }
    return MOCK_ADMIN_COURSES;
  },

  createCourse: async (data: {
    title: string;
    code: string;
    description: string;
    thumbnail?: string;
    category?: string;
    instructorName?: string;
  }): Promise<AdminCourseSummary> => {
    try {
      const res = await axiosClient.post('/courses', data);
      if (res.data?.data) {
        const c = res.data.data;
        return {
          id: c._id || c.id,
          title: c.title,
          code: c.code || data.code,
          thumbnail:
            c.thumbnail ||
            data.thumbnail ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
          status: 'published',
          category: c.category || data.category || 'General',
          instructorName: c.instructorName || data.instructorName || 'Administrator',
          totalStudents: 0,
          totalModules: 0,
          totalSubmodules: 0,
          averageProgress: 0,
          createdAt: 'Just now'
        };
      }
    } catch {
      // fallback mock creation
    }
    const newCourse: AdminCourseSummary = {
      id: `course-${Date.now()}`,
      title: data.title,
      code: data.code,
      thumbnail:
        data.thumbnail ||
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
      status: 'published',
      category: data.category || 'Engineering',
      instructorName: data.instructorName || 'Administrator',
      totalStudents: 1,
      totalModules: 1,
      totalSubmodules: 2,
      averageProgress: 0,
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    };
    MOCK_ADMIN_COURSES.unshift(newCourse);
    return newCourse;
  },

  // 2. Course Members & ARBAC
  listMembers: async (courseId: string): Promise<CourseMember[]> => {
    try {
      const res = await axiosClient.get(`/courses/${courseId}/members`);
      if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
        return res.data.data;
      }
    } catch {
      // fallback
    }
    return MOCK_MEMBERS[courseId] || MOCK_MEMBERS['course-dsa-bootcamp'] || [];
  },

  assignMember: async (
    courseId: string,
    member: { name: string; email: string; role: 'admin' | 'trainer' | 'trainee' }
  ): Promise<CourseMember> => {
    try {
      const res = await axiosClient.post(`/courses/${courseId}/members`, member);
      if (res.data?.data) return res.data.data;
    } catch {
      // fallback
    }
    const newMember: CourseMember = {
      userId: `usr-${Date.now()}`,
      name: member.name,
      email: member.email,
      role: member.role,
      enrolledAt: 'Today',
      progressPercent: 0,
      points: 0
    };
    if (!MOCK_MEMBERS[courseId]) MOCK_MEMBERS[courseId] = [];
    MOCK_MEMBERS[courseId].push(newMember);
    return newMember;
  },

  updateMemberRole: async (
    courseId: string,
    userId: string,
    role: 'admin' | 'trainer' | 'trainee'
  ): Promise<void> => {
    try {
      await axiosClient.put(`/courses/${courseId}/members/${userId}/role`, { role });
    } catch {
      // fallback
    }
    const list = MOCK_MEMBERS[courseId];
    if (list) {
      const target = list.find((m) => m.userId === userId);
      if (target) target.role = role;
    }
  },

  revokeMember: async (courseId: string, userId: string): Promise<void> => {
    try {
      await axiosClient.delete(`/courses/${courseId}/members/${userId}`);
    } catch {
      // fallback
    }
    if (MOCK_MEMBERS[courseId]) {
      MOCK_MEMBERS[courseId] = MOCK_MEMBERS[courseId].filter((m) => m.userId !== userId);
    }
  },

  // 3. Admin Alerts
  listAlerts: async (): Promise<AdminActivityAlert[]> => {
    return MOCK_ADMIN_ALERTS;
  }
};

import { axiosClient } from '../lib/axiosClient';
import { apiErrorMessage } from '../lib/roles';

// Thin typed client over the real microservice endpoints used by the dashboards.
// Everything here goes through the ingress: auth-service, user-service, course-service.

export type CourseStatus = 'draft' | 'published' | 'archived';
export type BackendRole = 'trainee' | 'trainer' | 'admin';

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  status: CourseStatus;
  tags: string[];
  moduleCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: BackendRole;
  isVerified: boolean;
}

export interface Membership {
  id: string;
  courseId: string;
  userId: string;
  role: BackendRole;
  status: 'active' | 'suspended';
  assignedAt?: string;
}

export interface CourseProgress {
  courseId: string;
  totalScoreEarned: number;
  courseMaxScore: number;
  percentage: number;
  completedItemsCount: number;
  completedItems: { contentItemId?: string; completedAt?: string; scoreEarned?: number }[];
}

export interface CourseGrades {
  courseId: string;
  courseTitle: string;
  courseMaxScore: number;
  totalStudents: number;
  grades: {
    userId: string;
    totalScoreEarned: number;
    percentage: number;
    completedCount: number;
  }[];
}

export interface Qualification {
  degree: string;
  field?: string;
  institution: string;
  startYear?: number;
  endYear?: number;
  grade?: string;
}
export interface Experience {
  title: string;
  organization: string;
  location?: string;
  startDate?: string; // YYYY-MM
  endDate?: string; // YYYY-MM, empty = present
  description?: string;
}
export interface Certificate {
  name: string;
  issuer?: string;
  issuedOn?: string; // YYYY-MM
  credentialId?: string;
  url?: string;
}
export interface ProfileLink {
  label: string;
  url: string;
}

// the professional profile: editable by its owner, shareable at domain.com/<username>
export interface Profile {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  username?: string;
  role?: BackendRole;
  visibility?: 'public' | 'members' | 'private';
  headline?: string;
  location?: string;
  links?: ProfileLink[];
  skills?: string[];
  interests?: string[];
  qualifications?: Qualification[];
  experience?: Experience[];
  certificates?: Certificate[];
}

export type PublicProfile = Omit<Profile, 'userId' | 'email' | 'phone' | 'visibility'> & {
  username: string;
  memberSince?: string;
  isOwner: boolean;
  stats: { learning: number; teaching: number };
};

type Raw = Record<string, unknown>;
const data = <T>(res: { data?: { data?: T } }): T => res.data?.data as T;

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

const toCourse = (c: Raw): Course => ({
  id: String(c._id || c.id),
  title: String(c.title || 'Untitled course'),
  description: String(c.description || ''),
  instructorId: String(c.instructorId || ''),
  status: (c.status as CourseStatus) || 'draft',
  tags: (c.tags as string[]) || [],
  moduleCount: Number(c.moduleCount || 0),
  createdAt: String(c.createdAt || ''),
  updatedAt: c.updatedAt ? String(c.updatedAt) : undefined
});

const toUser = (u: Raw): PlatformUser => ({
  id: String(u._id || u.userId || u.id),
  name: String(u.name || ''),
  email: String(u.email || ''),
  role: (u.role as BackendRole) || 'trainee',
  isVerified: Boolean(u.isVerified)
});

const toMembership = (m: Raw): Membership => ({
  id: String(m.id || m._id || ''),
  courseId: String(m.courseId),
  userId: String(m.userId),
  role: (m.role as BackendRole) || 'trainee',
  status: (m.status as Membership['status']) || 'active',
  assignedAt: m.assignedAt ? String(m.assignedAt) : undefined
});

export const lmsApi = {
  // ---- courses (course-service)
  listCourses: () =>
    call(async () => (data<Raw[]>(await axiosClient.get('/courses')) || []).map(toCourse)),

  getCourse: (id: string) =>
    call(async () => toCourse(data<Raw>(await axiosClient.get(`/courses/${id}`)))),

  // POST /course returns only the id; read the course back for the caller
  createCourse: (input: {
    title: string;
    description?: string;
    status?: CourseStatus;
    modules?: string[];
  }) =>
    call(async () => {
      const { courseId } = data<{ courseId: string }>(await axiosClient.post('/course', input));
      return toCourse(data<Raw>(await axiosClient.get(`/courses/${courseId}`)));
    }),

  updateCourse: (
    id: string,
    input: Partial<{ title: string; description: string; status: CourseStatus }>
  ) => call(async () => toCourse(data<Raw>(await axiosClient.put(`/courses/${id}`, input)))),

  myProgress: (courseId: string) =>
    call(async () => {
      const p = data<Raw>(await axiosClient.get(`/courses/${courseId}/my-progress`));
      return {
        courseId,
        totalScoreEarned: Number(p.totalScoreEarned || 0),
        courseMaxScore: Number(p.courseMaxScore || 0),
        percentage: Number(p.percentage || 0),
        completedItemsCount: Number(p.completedItemsCount || 0),
        completedItems: (p.completedItems as CourseProgress['completedItems']) || []
      } satisfies CourseProgress;
    }),

  courseGrades: (courseId: string) =>
    call(async () => {
      const g = data<Raw>(await axiosClient.get(`/courses/${courseId}/grades`));
      return {
        courseId,
        courseTitle: String(g.courseTitle || ''),
        courseMaxScore: Number(g.courseMaxScore || 0),
        totalStudents: Number(g.totalStudents || 0),
        grades: ((g.grades as Raw[]) || []).map((r) => ({
          userId: String(r.userId),
          totalScoreEarned: Number(r.totalScoreEarned || 0),
          percentage: Number(r.percentage || 0),
          completedCount: Number(r.completedCount || 0)
        }))
      } satisfies CourseGrades;
    }),

  // learner-visible: top scorers plus the caller's rank ("ahead of N% of the batch")
  courseLeaderboard: (courseId: string) =>
    call(async () =>
      data<{
        totalStudents: number;
        courseMaxScore: number;
        top: { userId: string; totalScoreEarned: number; percentage: number; rank: number }[];
        me: { rank: number; totalScoreEarned: number; percentage: number; aheadOf: number } | null;
      }>(await axiosClient.get(`/courses/${courseId}/leaderboard`))
    ),

  // ---- profile & memberships (user-service)
  myProfile: () =>
    call(async () => {
      const d = data<{ profile: Raw | null; courses: Raw[] }>(await axiosClient.get('/profile/me'));
      return {
        profile: d?.profile as unknown as Profile | null,
        memberships: (d?.courses || []).map(toMembership)
      };
    }),

  updateMyProfile: (patch: Partial<Profile>) =>
    call(async () => data<Profile>(await axiosClient.put('/profile/me', patch))),

  usernameAvailable: (u: string) =>
    call(async () =>
      data<{ username: string; available: boolean; reason: string | null }>(
        await axiosClient.get('/profile/username-available', { params: { u } })
      )
    ),

  // the shareable page; signed-in viewers send their token (members-only profiles)
  publicProfile: (username: string) =>
    call(async () =>
      data<PublicProfile>(await axiosClient.get(`/profiles/u/${encodeURIComponent(username)}`))
    ),

  getProfile: (userId: string) =>
    call(async () => data<Profile>(await axiosClient.get(`/profiles/${userId}`))),

  listMembers: (courseId: string) =>
    call(async () =>
      (data<Raw[]>(await axiosClient.get(`/memberships/courses/${courseId}/members`)) || []).map(
        toMembership
      )
    ),

  assignMember: (courseId: string, userId: string, role: BackendRole) =>
    call(async () =>
      toMembership(
        data<Raw>(
          await axiosClient.post(`/memberships/courses/${courseId}/members`, { userId, role })
        )
      )
    ),

  updateMemberRole: (courseId: string, userId: string, role: BackendRole) =>
    call(async () => {
      await axiosClient.put(`/memberships/courses/${courseId}/members/${userId}/role`, { role });
    }),

  revokeMember: (courseId: string, userId: string) =>
    call(async () => {
      await axiosClient.delete(`/memberships/courses/${courseId}/members/${userId}`);
    }),

  // ---- platform users (auth-service, admin only)
  listUsers: (search?: string) =>
    call(async () => {
      const d = data<{ users: Raw[]; stats: Record<string, number> }>(
        await axiosClient.get('/auth/users', { params: search ? { search } : undefined })
      );
      return {
        users: (d?.users || []).map(toUser),
        stats: { trainee: 0, trainer: 0, admin: 0, ...(d?.stats || {}) } as Record<
          BackendRole,
          number
        >
      };
    }),

  updateUserRole: (userId: string, role: BackendRole) =>
    call(async () =>
      toUser(data<Raw>(await axiosClient.patch(`/auth/users/${userId}/role`, { role })))
    ),

  // platform admins: newest enrollments + learners per course (user-service)
  enrollmentOverview: () =>
    call(async () =>
      data<{
        recent: {
          userId: string;
          name: string;
          courseId: string;
          role: string;
          assignedAt: string;
        }[];
        learnersByCourse: { courseId: string; learners: number }[];
        totalLearnerEnrollments: number;
      }>(await axiosClient.get('/memberships/overview'))
    )
};

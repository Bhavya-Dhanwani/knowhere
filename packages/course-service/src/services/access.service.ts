// Who may do what with a course.
//  - platform admin: everything
//  - course managers: the course's instructor, or course members with role admin/trainer
//  - learners: must be enrolled (user-service membership), the course must be published,
//    and the item's module must be open for them (release date + personal schedule)
import { createMembershipClient, CourseRole } from '@lms/shared';
import env from '../shared/config/env.config.js';
import { AuthUser } from '../shared/middlewares/auth.middleware.js';
import { ICourseDocument } from '../shared/models/course.model.js';
import CourseDao from '../shared/dao/course.dao.js';
import Forbidden from '../shared/errors/Forbidden.error.js';
import NotFound from '../shared/errors/NotFound.error.js';
import { loadCourseOutline, OutlineModule } from './courseOutline.service.js';
import { computeSchedule, ScheduledModule } from './schedule.service.js';
import CourseProgressDao from '../shared/dao/courseProgress.dao.js';

export const memberships = createMembershipClient({
  userServiceUrl: env.USER_SERVICE_URL,
  service: 'course-service'
});

const courseDao = new CourseDao();
const progressDao = new CourseProgressDao();

export async function courseRoleOf(user: AuthUser, courseId: string): Promise<CourseRole | null> {
  if (user.role === 'admin') return 'admin';
  return (await memberships.memberOf(courseId, user.userId))?.role ?? null;
}

export async function canManageCourse(user: AuthUser, course: ICourseDocument) {
  if (user.role === 'admin' || course.instructorId === user.userId) return true;
  const role = await courseRoleOf(user, course._id.toString());
  return role === 'admin' || role === 'trainer';
}

export async function requireCourse(courseId: string) {
  const course = await courseDao.findCourseById(courseId);
  if (!course) throw new NotFound(`Course with ID '${courseId}' not found.`);
  return course;
}

export async function assertCanManageCourse(user: AuthUser, course: ICourseDocument) {
  if (!(await canManageCourse(user, course))) {
    throw new Forbidden('Only this course’s instructors or an admin can change it.');
  }
}

export interface LearnerView {
  course: ICourseDocument;
  outline: OutlineModule[];
  schedule: ScheduledModule[];
  manager: boolean;
  joinedAt: Date;
}

// Loads a course for someone who wants to read it; throws 403 if they may not.
export async function openCourse(user: AuthUser, courseId: string): Promise<LearnerView> {
  const course = await requireCourse(courseId);
  const manager = await canManageCourse(user, course);
  const member = manager ? null : await memberships.memberOf(courseId, user.userId);

  if (!manager) {
    if (!member) throw new Forbidden('You are not enrolled in this course.');
    if (course.status !== 'published') throw new Forbidden('This course is not published yet.');
  }

  const outline = await loadCourseOutline(course);
  const progress = await progressDao.findProgress(courseId, user.userId);
  const joinedAt = member?.assignedAt ? new Date(member.assignedAt) : course.createdAt;
  const completedAt = new Map(
    (progress?.completedItems || []).map((c) => [
      c.contentItemId.toString(),
      new Date(c.completedAt)
    ])
  );
  const schedule = computeSchedule(
    outline.map((m) => ({
      moduleId: m._id,
      releaseAt: m.releaseAt,
      durationDays: m.durationDays,
      threshold: m.progressRequirement,
      itemIds: m.submodules.flatMap((s) => s.items.map((i) => i._id))
    })),
    joinedAt,
    completedAt
  );

  return { course, outline, schedule, manager, joinedAt };
}

// Throws unless the user may open `refId` (an item's resource/question, or an MCQ attachment)
// inside `courseId`. Staff browsing their library (no courseId) are allowed through.
export async function assertContentAccess(
  user: AuthUser,
  refId: string,
  courseId?: string
): Promise<{ manager: boolean }> {
  if (!courseId) {
    if (user.role === 'admin' || user.role === 'trainer') return { manager: true };
    throw new Forbidden('courseId is required to open course content.');
  }

  const view = await openCourse(user, courseId);
  if (view.manager) return { manager: true };

  const now = new Date();
  const index = view.outline.findIndex((m) =>
    m.submodules.some((s) =>
      s.items.some((i) => i.refId === refId || i.attachmentIds.includes(refId))
    )
  );
  if (index < 0) throw new NotFound('This content is not part of the course.');
  if (now < view.schedule[index].startsAt) {
    throw new Forbidden(
      `This module opens on ${view.schedule[index].startsAt.toISOString()} for you.`
    );
  }
  return { manager: false };
}

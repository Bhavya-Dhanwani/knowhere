import env from '../shared/config/env.config.js';
import Forbidden from '../shared/errors/Forbidden.error.js';

type CourseRole = 'admin' | 'trainer' | 'trainee';

const request = async (path: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(`${env.USER_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN,
      ...(init?.headers || {})
    },
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok)
    throw new Error(`User service authorization failed with HTTP ${response.status}`);
  return response.json();
};

export async function requireCourseMembership(
  userId: string,
  courseId: string,
  allowedRoles: CourseRole[] = ['admin', 'trainer', 'trainee']
): Promise<CourseRole> {
  const payload = await request('/api/rbac/verify', {
    method: 'POST',
    body: JSON.stringify({ userId, courseId, allowedRoles })
  });
  const result = payload?.data || payload;
  if (!result?.authorized)
    throw new Forbidden('Active course membership with the required role is required.');
  return result.role as CourseRole;
}

export async function provisionInitialAdmin(courseId: string, userId: string): Promise<void> {
  await request('/api/rbac/initial-admin', {
    method: 'POST',
    body: JSON.stringify({ courseId, userId })
  });
}

export async function listActiveCourseIds(userId: string): Promise<string[]> {
  const payload = await request(`/api/rbac/users/${encodeURIComponent(userId)}/courses`);
  const result = payload?.data || payload;
  return Array.isArray(result?.courseIds) ? result.courseIds : [];
}

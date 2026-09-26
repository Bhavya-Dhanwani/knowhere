import jwt from 'jsonwebtoken';
import { serviceTokenSecret } from './keys.js';

// Enrollment lives in user-service. Other services ask it who belongs to a course with a
// short-lived service token: signed with SERVICE_TOKEN_SECRET (never the user-token key),
// addressed to user-service and limited to the scope of that one call.

export type CourseRole = 'admin' | 'trainer' | 'trainee';

export interface CourseMember {
  userId: string;
  role: CourseRole;
  assignedAt?: string;
}

export type ServiceScope = 'memberships:read' | 'memberships:write' | 'profiles:read';

export interface ServiceIdentity {
  service: string;
  scope: ServiceScope[];
}

export function serviceToken(service: string, scope: ServiceScope[]) {
  return jwt.sign({ typ: 'service', scope }, serviceTokenSecret(), {
    algorithm: 'HS256',
    subject: `service:${service}`,
    audience: 'user-service',
    expiresIn: '60s'
  });
}

// returns the caller when `token` is a valid service token carrying `scope`, else null
export function verifyServiceToken(token: string, scope: ServiceScope): ServiceIdentity | null {
  try {
    const claims = jwt.verify(token, serviceTokenSecret(), {
      algorithms: ['HS256'],
      audience: 'user-service'
    }) as { typ?: string; sub?: string; scope?: ServiceScope[] };
    if (claims.typ !== 'service' || !claims.sub?.startsWith('service:')) return null;
    if (!claims.scope?.includes(scope)) return null;
    return { service: claims.sub.slice('service:'.length), scope: claims.scope };
  } catch {
    return null;
  }
}

export interface MembershipClientOptions {
  userServiceUrl: string;
  service: string;
  cacheMs?: number;
}

export function createMembershipClient(opts: MembershipClientOptions) {
  const cacheMs = opts.cacheMs ?? 15_000;
  const cache = new Map<string, { at: number; members: CourseMember[] }>();
  const headers = (scope: ServiceScope) => ({
    Authorization: `Bearer ${serviceToken(opts.service, [scope])}`
  });

  async function members(courseId: string): Promise<CourseMember[]> {
    const hit = cache.get(courseId);
    if (hit && Date.now() - hit.at < cacheMs) return hit.members;

    const res = await fetch(`${opts.userServiceUrl}/api/memberships/courses/${courseId}/members`, {
      headers: headers('memberships:read')
    });
    if (!res.ok) throw new Error(`user-service responded ${res.status} for course ${courseId}`);
    const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const list = (body.data || [])
      .filter((m) => (m.status || 'active') === 'active')
      .map((m) => ({
        userId: String(m.userId),
        role: m.role as CourseRole,
        assignedAt: m.assignedAt ? String(m.assignedAt) : undefined
      }));
    cache.set(courseId, { at: Date.now(), members: list });
    return list;
  }

  return {
    members,

    async memberOf(courseId: string, userId: string) {
      return (await members(courseId)).find((m) => m.userId === userId) || null;
    },

    // enrols a user (used to make a course's creator its course admin)
    async assign(courseId: string, userId: string, role: CourseRole) {
      const res = await fetch(
        `${opts.userServiceUrl}/api/memberships/courses/${courseId}/members`,
        {
          method: 'POST',
          headers: { ...headers('memberships:write'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role })
        }
      );
      if (!res.ok) throw new Error(`user-service responded ${res.status} assigning ${userId}`);
      cache.delete(courseId);
    },

    async profiles(userIds: string[]) {
      if (!userIds.length)
        return [] as Array<{ userId: string; name: string; avatar?: string; bio?: string }>;
      const res = await fetch(
        `${opts.userServiceUrl}/api/profiles?ids=${encodeURIComponent(userIds.join(','))}`,
        { headers: headers('profiles:read') }
      );
      if (!res.ok) return [];
      const body = (await res.json()) as {
        data?: Array<{ userId: string; name: string; avatar?: string; bio?: string }>;
      };
      return body.data || [];
    },

    forget(courseId: string) {
      cache.delete(courseId);
    }
  };
}

export type MembershipClient = ReturnType<typeof createMembershipClient>;

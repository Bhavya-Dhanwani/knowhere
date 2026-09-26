import { User } from '../types';

export type AppRole = 'student' | 'trainer' | 'admin';

// Backend roles are 'trainee' | 'trainer' | 'admin'; the UI calls trainees "students".
export function toAppRole(role?: string | null): AppRole {
  if (role === 'admin') return 'admin';
  if (role === 'trainer') return 'trainer';
  return 'student';
}

export function toBackendRole(role: AppRole): 'trainee' | 'trainer' | 'admin' {
  return role === 'student' ? 'trainee' : role;
}

export function roleOf(user: User | null | undefined): AppRole {
  const roles = user?.roles || [];
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('trainer')) return 'trainer';
  return 'student';
}

export function homePathFor(role: AppRole) {
  return role === 'admin' ? '/admin/dashboard' : '/dashboard';
}

export const ROLE_LABEL: Record<AppRole, string> = {
  student: 'Student',
  trainer: 'Trainer',
  admin: 'Admin'
};

// Normalises the auth-service user payload (token claims) into the frontend User shape.
export function normalizeUser(raw: Record<string, unknown> | null | undefined): User {
  const r = raw || {};
  return {
    id: String(r.userId || r._id || r.id || ''),
    name: String(r.name || String(r.email || '').split('@')[0] || 'Learner'),
    email: String(r.email || ''),
    roles: [toAppRole(r.role as string)],
    avatar: (r.avatar as string) || undefined
  };
}

// Pulls a human-readable message out of an axios / API error.
export function apiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
) {
  const e = err as {
    response?: { data?: { message?: string; error?: { message?: string } } };
    message?: string;
    code?: string;
  };
  // services answer either { message } or { error: { message } } (@lms/shared)
  const msg = e?.response?.data?.message || e?.response?.data?.error?.message;
  if (msg) {
    if (msg.includes('E11000')) return 'An account with this email already exists.';
    return msg;
  }
  if (e?.code === 'ERR_NETWORK')
    return 'Cannot reach the server. Check that the backend is running.';
  return e?.message && !e.message.startsWith('Request failed') ? e.message : fallback;
}

// Public profile URLs are domain.com/<username>, so usernames share the root path with the app's
// own pages: those names are reserved.
export const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'chat',
  'coach',
  'course',
  'courses',
  'dashboard',
  'docs',
  'forgot-password',
  'help',
  'home',
  'library',
  'login',
  'logout',
  'me',
  'openapi',
  'people',
  'profile',
  'profiles',
  'reset-password',
  'review',
  'root',
  'settings',
  'signup',
  'socket',
  'static',
  'support',
  'system',
  'u',
  'user',
  'users',
  'verify',
  'certificates',
  'www',
  'lms-raw-media',
  'lms-transcoded-media',
  'knowhere'
]);

// 3-30 chars: lowercase letters, digits, "-" and "_", starting and ending with a letter or digit
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28})[a-z0-9]$/;

export function usernameError(u: string): string | null {
  if (!USERNAME_RE.test(u)) {
    return 'Use 3-30 lowercase letters, digits, "-" or "_", starting and ending with a letter or digit.';
  }
  if (RESERVED_USERNAMES.has(u)) return 'That username is reserved.';
  return null;
}

// "Alex Rivera" -> "alex-rivera"; falls back to the email's local part
export function slugify(name: string, email = ''): string {
  const from = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
  const base = from(name) || from(email.split('@')[0]) || 'learner';
  return base.length >= 3 ? base : `${base}-${Math.random().toString(36).slice(2, 5)}`;
}

// first free candidate: base, base-2, base-3, ... then a random suffix
export async function uniqueUsername(
  base: string,
  taken: (candidate: string) => Promise<boolean>
): Promise<string> {
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)];
  for (const c of candidates) {
    if (!usernameError(c) && !(await taken(c))) return c;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

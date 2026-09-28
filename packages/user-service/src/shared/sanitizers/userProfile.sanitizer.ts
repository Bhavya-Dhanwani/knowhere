// the owner's own view (and staff tooling): everything
const PROFILE_FIELDS = [
  'username',
  'role',
  'visibility',
  'headline',
  'location',
  'links',
  'skills',
  'interests',
  'qualifications',
  'experience',
  'certificates'
] as const;

function sanitizeUserProfile(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return null;

  const p = profile as Record<string, unknown>;
  return {
    userId: p.userId,
    name: p.name,
    email: p.email,
    avatar: p.avatar,
    bio: p.bio,
    phone: p.phone,
    ...Object.fromEntries(
      PROFILE_FIELDS.map((k) => [k, p[k] ?? (Array.isArray(p[k]) ? [] : p[k])])
    ),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

// what anyone with the link sees: no email, phone or internal ids
export function publicProfile(profile: Record<string, unknown>) {
  const p = profile;
  return {
    username: p.username,
    name: p.name,
    avatar: p.avatar || '',
    bio: p.bio || '',
    role: p.role || 'trainee',
    headline: p.headline || '',
    location: p.location || '',
    links: p.links || [],
    skills: p.skills || [],
    interests: p.interests || [],
    qualifications: p.qualifications || [],
    experience: p.experience || [],
    certificates: p.certificates || [],
    memberSince: p.createdAt
  };
}

export default sanitizeUserProfile;

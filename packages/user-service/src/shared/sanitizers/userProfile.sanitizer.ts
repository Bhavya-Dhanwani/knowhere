// function to sanitize user profile data
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
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

export default sanitizeUserProfile;

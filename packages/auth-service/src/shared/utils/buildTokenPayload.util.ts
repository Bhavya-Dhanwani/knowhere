async function buildTokenPayload(user: Record<string, unknown> | object) {
  const u = user as {
    _id: { toString(): string };
    name?: string;
    email?: string;
    isVerified?: boolean;
    role?: string;
  };
  const tokenPayload = {
    _id: u._id,
    userId: u._id.toString(),
    name: u.name,
    email: u.email,
    isVerified: u.isVerified,
    role: u.role || 'trainee'
  };
  return tokenPayload;
}

export default buildTokenPayload;

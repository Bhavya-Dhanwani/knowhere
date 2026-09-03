// function to sanitize course membership data
function sanitizeMembership(membership: Record<string, unknown> | null | undefined) {
  if (!membership) return null;

  const m = membership as Record<string, unknown>;
  return {
    id: m._id,
    courseId: m.courseId,
    userId: m.userId,
    role: m.role,
    status: m.status,
    assignedBy: m.assignedBy,
    assignedAt: m.assignedAt,
    createdAt: m.createdAt
  };
}

export default sanitizeMembership;

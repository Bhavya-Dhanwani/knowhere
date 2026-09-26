function sanitizeCourse(course: Record<string, unknown> | null | undefined) {
  if (!course) return null;

  const c = course as Record<string, unknown>;
  return {
    _id: c._id,
    title: c.title,
    description: c.description,
    instructorId: c.instructorId,
    status: c.status,
    tags: c.tags,
    moduleCount: Array.isArray(c.modules) ? c.modules.length : 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

export default sanitizeCourse;

// function to sanitize competency data
function sanitizeCompetency(competency: Record<string, unknown> | null | undefined) {
  if (!competency) return null;

  const c = competency as Record<string, unknown>;
  return {
    _id: c._id,
    userId: c.userId,
    skill: c.skill,
    level: c.level,
    score: c.score,
    verifiedBy: c.verifiedBy,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

export default sanitizeCompetency;

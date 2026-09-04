function sanitizeContentItem(item: Record<string, unknown> | null | undefined) {
  if (!item) return null;

  const i = item as Record<string, unknown>;
  return {
    _id: i._id,
    submoduleId: i.submoduleId,
    type: i.type,
    ref_id: i.ref_id,
    title: i.title,
    order: i.order,
    max_score: i.max_score,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt
  };
}

export default sanitizeContentItem;

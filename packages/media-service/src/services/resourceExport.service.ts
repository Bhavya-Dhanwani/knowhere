import ResourceDao from '../shared/dao/resource.dao.js';
import sanitizeResource, { SanitizedResource } from '../shared/sanitizers/resource.sanitizer.js';

const resourceDao = new ResourceDao();

export async function getResourceById(id: string): Promise<SanitizedResource | null> {
  const resource = await resourceDao.findResourceById(id);
  if (!resource) return null;
  return sanitizeResource(resource.toObject());
}

export default {
  getResourceById
};

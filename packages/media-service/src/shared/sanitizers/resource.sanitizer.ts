import { IResource } from '../models/resource.model.js';

export interface SanitizedResource {
  id: string;
  title: string;
  type: string;
  ownerId: string;
  playbackUrl: string | null;
  durationSeconds: number;
  fileSizeBytes: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function sanitizeResource(resource: IResource | any): SanitizedResource {
  return {
    id: resource._id ? resource._id.toString() : resource.id,
    title: resource.title,
    type: resource.type,
    ownerId: resource.ownerId,
    playbackUrl: resource.playbackUrl || null,
    durationSeconds: resource.durationSeconds || 0,
    fileSizeBytes: resource.fileSizeBytes || 0,
    status: resource.status,
    createdAt: resource.createdAt ? resource.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: resource.updatedAt ? resource.updatedAt.toISOString() : new Date().toISOString()
  };
}

export default sanitizeResource;

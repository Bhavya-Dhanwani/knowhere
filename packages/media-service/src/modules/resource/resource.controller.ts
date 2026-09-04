import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import ResourceDao from '../../shared/dao/resource.dao.js';
import s3Service from '../../services/s3.service.js';
import sanitizeResource from '../../shared/sanitizers/resource.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';

class ResourceController {
  resourceDao: ResourceDao;

  constructor() {
    this.resourceDao = new ResourceDao();
  }

  // POST /resources/upload-url
  getUploadUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, type, contentType } = req.body;
      const ownerId = req.user!.userId;

      // Unique S3 Key
      const ext = contentType.split('/')[1] || 'bin';
      const s3Key = `raw/${type}/${ownerId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

      const uploadUrl = await s3Service.generateUploadUrl(s3Key, contentType);

      const resource = await this.resourceDao.createResource({
        title,
        type,
        ownerId,
        s3Key,
        status: 'pending'
      });

      return Created(res, 'Presigned upload URL generated successfully', {
        uploadUrl,
        s3Key,
        resource: sanitizeResource(resource.toObject())
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /resources/:id
  getResourceById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const resource = await this.resourceDao.findResourceById(id);

      if (!resource) {
        throw new NotFound(`Resource with ID '${id}' not found.`);
      }

      return Ok(res, 'Resource fetched successfully', sanitizeResource(resource.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // PUT /resources/:id/status
  updateResourceStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { status, playbackUrl, durationSeconds, fileSizeBytes } = req.body;

      const resource = await this.resourceDao.findResourceById(id);
      if (!resource) {
        throw new NotFound(`Resource with ID '${id}' not found.`);
      }

      // Check owner or trainer/admin
      if (
        resource.ownerId !== req.user!.userId &&
        req.user!.role !== 'admin' &&
        req.user!.role !== 'trainer'
      ) {
        throw new Forbidden('You are not authorized to update this resource status.');
      }

      const updated = await this.resourceDao.updateResourceStatus(id, status, {
        playbackUrl,
        durationSeconds,
        fileSizeBytes
      });

      return Ok(res, 'Resource status updated successfully', sanitizeResource(updated!.toObject()));
    } catch (error) {
      next(error);
    }
  };
}

export default ResourceController;

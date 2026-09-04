import express from 'express';
import ResourceController from './resource.controller.js';
import {
  getUploadUrlValidators,
  getResourceByIdValidators,
  updateResourceStatusValidators
} from './resource.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const resourceController = new ResourceController();

/*
    @route POST /api/resources/upload-url
    @desc Get presigned S3 upload URL for raw media
    @access Trainer/Admin
*/
router.post(
  '/upload-url',
  authMiddleware,
  requireRole('admin', 'trainer'),
  getUploadUrlValidators,
  resourceController.getUploadUrl
);

/*
    @route GET /api/resources/:id
    @desc Get resource details by ID
    @access Private
*/
router.get('/:id', authMiddleware, getResourceByIdValidators, resourceController.getResourceById);

/*
    @route PUT /api/resources/:id/status
    @desc Update resource processing status (ready, failed, etc.)
    @access Private (Owner, Trainer, Admin)
*/
router.put(
  '/:id/status',
  authMiddleware,
  updateResourceStatusValidators,
  resourceController.updateResourceStatus
);

export default router;

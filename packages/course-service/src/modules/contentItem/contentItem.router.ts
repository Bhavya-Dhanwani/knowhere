// Importing modules
import express from 'express';
import ContentItemController from './contentItem.controller.js';
import {
  getContentItemDetailValidators,
  updateContentItemValidators
} from './contentItem.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const contentItemController = new ContentItemController();

/*
    @route GET /api/content-items/:id
    @desc Detail call for a single content item, triggers cross-module fetch
    @access Private
*/
router.get(
  '/:id',
  authMiddleware,
  getContentItemDetailValidators,
  contentItemController.getContentItemDetail
);

/*
    @route PUT /api/content-items/:id
    @desc Update content item marks, title, or order
    @access Trainer/Admin
*/
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin', 'trainer'),
  updateContentItemValidators,
  contentItemController.updateContentItem
);

export default router;

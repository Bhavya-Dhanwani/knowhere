// Importing modules
import express from 'express';
import SubmoduleController from './submodule.controller.js';
import {
  createSubmoduleValidators,
  updateSubmoduleValidators,
  attachContentItemValidators,
  listContentItemsValidators
} from './submodule.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const submoduleController = new SubmoduleController();

/*
    @route POST /api/submodules
    @desc Create a new submodule
    @access Trainer/Admin
*/
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createSubmoduleValidators,
  submoduleController.createSubmodule
);

/*
    @route PUT /api/submodules/:id
    @desc Update submodule details
    @access Trainer/Admin
*/
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin', 'trainer'),
  updateSubmoduleValidators,
  submoduleController.updateSubmodule
);

/*
    @route POST /api/submodules/:id/content-items
    @desc Attach content item (media, mcq, coding) to submodule
    @access Trainer/Admin
*/
router.post(
  '/:id/content-items',
  authMiddleware,
  requireRole('admin', 'trainer'),
  attachContentItemValidators,
  submoduleController.attachContentItem
);

/*
    @route GET /api/submodules/:id/content-items
    @desc Cheap list call for sidebar navigation
    @access Private
*/
router.get(
  '/:id/content-items',
  authMiddleware,
  listContentItemsValidators,
  submoduleController.listContentItems
);

export default router;

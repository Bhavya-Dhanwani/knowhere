// Importing modules
import express from 'express';
import ModuleController from './module.controller.js';
import { createModuleValidators, updateModuleValidators } from './module.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const moduleController = new ModuleController();

/*
    @route POST /api/modules
    @desc Create a new module within a course
    @access Trainer/Admin
*/
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createModuleValidators,
  moduleController.createModule
);

/*
    @route PUT /api/modules/:id
    @desc Update module details
    @access Trainer/Admin
*/
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin', 'trainer'),
  updateModuleValidators,
  moduleController.updateModule
);

export default router;

import express from 'express';
import CourseApiController from './courseApi.controller.js';
import {
  uploadResourceValidators,
  createMcqValidators,
  createCodeQuestionValidators,
  createSubmoduleValidators,
  createModuleValidators,
  createCourseValidators,
  addModuleValidators,
  checkMcqValidators,
  idParamValidators
} from './courseApi.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const courseApiController = new CourseApiController();

/*
    ========================================================================
    CONTENT CREATION & MANAGEMENT ENDPOINTS (Admin & Trainer Only)
    ========================================================================
*/

/*
    @route POST /api/course/upload-resource
    @desc Upload educational resource (presigned S3 URL)
    @access Private (Trainer, Admin)
*/
router.post(
  '/upload-resource',
  authMiddleware,
  requireRole('admin', 'trainer'),
  uploadResourceValidators,
  courseApiController.uploadResource
);

/*
    @route POST /api/course/mcq
    @desc Create MCQ question
    @access Private (Trainer, Admin)
*/
router.post(
  '/mcq',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createMcqValidators,
  courseApiController.createMcq
);

/*
    @route POST /api/course/code-question
    @desc Create coding challenge with AI test case generation
    @access Private (Trainer, Admin)
*/
router.post(
  '/code-question',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createCodeQuestionValidators,
  courseApiController.createCodeQuestion
);

/*
    @route POST /api/course/submodule
    @desc Create ordered submodule with educational content
    @access Private (Trainer, Admin)
*/
router.post(
  '/submodule',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createSubmoduleValidators,
  courseApiController.createSubmodule
);

/*
    @route POST /api/course/module
    @desc Create module with relative learner duration and release policy
    @access Private (Trainer, Admin)
*/
router.post(
  '/module',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createModuleValidators,
  courseApiController.createModule
);

/*
    @route POST /api/course
    @desc Create course
    @access Private (Trainer, Admin)
*/
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createCourseValidators,
  courseApiController.createCourse
);

/*
    @route POST /api/course/add-module
    @desc Add and schedule module within a course
    @access Private (Trainer, Admin)
*/
router.post(
  '/add-module',
  authMiddleware,
  requireRole('admin', 'trainer'),
  addModuleValidators,
  courseApiController.addModule
);

/*
    ========================================================================
    LEARNER ACCESS ENDPOINTS (Authenticated Trainee, Trainer, Admin)
    ========================================================================
*/

/*
    @route GET /api/course/mcq/:id
    @desc Get learner-safe MCQ question and options (strips correct answer)
    @access Private
*/
router.get('/mcq/:id', authMiddleware, idParamValidators, courseApiController.getMcq);

/*
    @route GET /api/course/video/:id
    @desc Secure video streaming with HTTP byte-range chunk support
    @access Private
*/
router.get('/video/:id', authMiddleware, idParamValidators, courseApiController.streamVideo);

/*
    @route GET /api/course/resource/:id
    @desc Get non-video educational resource with short-lived presigned download URL
    @access Private
*/
router.get('/resource/:id', authMiddleware, idParamValidators, courseApiController.getResource);

/*
    @route POST /api/course/chk-mcq
    @desc Check learner's selected MCQ answer and record attempt
    @access Private
*/
router.post('/chk-mcq', authMiddleware, checkMcqValidators, courseApiController.checkMcq);

export default router;

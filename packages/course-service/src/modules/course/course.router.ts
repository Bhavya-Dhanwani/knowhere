// Importing modules
import express from 'express';
import CourseController from './course.controller.js';
import { createCourseValidators, updateCourseValidators } from './course.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const courseController = new CourseController();

/*
    @route POST /api/courses
    @desc Create a new course
    @access Trainer/Admin
*/
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'trainer', 'instructor'),
  createCourseValidators,
  courseController.createCourse
);

/*
    @route PUT /api/courses/:id
    @desc Update course details
    @access Trainer/Admin
*/
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin', 'trainer'),
  updateCourseValidators,
  courseController.updateCourse
);

/*
    @route GET /api/courses/:id
    @desc Get course by ID
    @access Private
*/
router.get('/:id', authMiddleware, courseController.getCourseById);

/*
    @route GET /api/courses
    @desc List all courses
    @access Private
*/
router.get('/', authMiddleware, courseController.listCourses);

export default router;

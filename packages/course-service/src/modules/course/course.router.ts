// Importing modules
import express from 'express';
import CourseController from './course.controller.js';
import { updateCourseValidators, courseIdValidators } from './course.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

// Course reads for the UI. Authoring (create course, add module) lives under /api/course.
const router = express.Router();
const courseController = new CourseController();
const staff = [authMiddleware, requireRole('admin', 'trainer')];
const anyRole = [authMiddleware, requireRole('admin', 'trainer', 'trainee')];

// @route GET /api/courses — list courses
router.get('/', anyRole, courseController.listCourses);

// @route GET /api/courses/:id/structure — outline, progress and personal module deadlines
router.get('/:id/structure', anyRole, courseIdValidators, courseController.getStructure);

// @route GET /api/courses/:id — course details
router.get('/:id', anyRole, courseIdValidators, courseController.getCourseById);

// @route PUT /api/courses/:id — rename, describe, publish / archive
router.put('/:id', staff, updateCourseValidators, courseController.updateCourse);

// @route DELETE /api/courses/:id — delete a course (its instructors or an admin)
router.delete('/:id', staff, courseIdValidators, courseController.deleteCourse);

export default router;

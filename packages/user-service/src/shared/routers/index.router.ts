import MembershipController from '../../modules/membership/membership.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
// Importing modules
import express from 'express';
import healthRouter from './health.router.js';
import profileRouter from '../../modules/profile/profile.router.js';
import competencyRouter from '../../modules/competency/competency.router.js';
import membershipRouter from '../../modules/membership/membership.router.js';

// making the router
const router = express.Router();

// mounting routers
router.use('/health', healthRouter);
router.use('/profile', profileRouter);
router.use('/profiles', profileRouter);
router.use('/competencies', competencyRouter);
/*
    @route GET /api/memberships/overview
    @desc Newest enrollments and learners per course across the platform
    @access Platform admin
*/
router.get('/memberships/overview', authMiddleware, new MembershipController().overview);
router.use('/courses/:courseId', membershipRouter);
router.use('/memberships/courses/:courseId', membershipRouter);

export default router;

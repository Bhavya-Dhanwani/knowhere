// Importing modules
import express from 'express';
import healthRouter from './health.router.js';
import profileRouter from '../../modules/profile/profile.router.js';
import competencyRouter from '../../modules/competency/competency.router.js';
import membershipRouter from '../../modules/membership/membership.router.js';
import rbacRouter from '../../modules/rbac/rbac.router.js';

// making the router
const router = express.Router();

// mounting routers
router.use('/health', healthRouter);
router.use('/profile', profileRouter);
router.use('/profiles', profileRouter);
router.use('/competencies', competencyRouter);
router.use('/courses/:courseId', membershipRouter);
router.use('/rbac', rbacRouter);

export default router;

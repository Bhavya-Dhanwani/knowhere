// Importing modules
import express from 'express';
import healthRouter from './health.router.js';
import courseRouter from '../../modules/course/course.router.js';
import moduleRouter from '../../modules/module/module.router.js';
import submoduleRouter from '../../modules/submodule/submodule.router.js';
import contentItemRouter from '../../modules/contentItem/contentItem.router.js';
import progressRouter from '../../modules/progress/progress.router.js';
import courseApiRouter from '../../modules/courseApi/courseApi.router.js';

// making the router
const router = express.Router();

// mounting routers
router.use('/health', healthRouter);
router.use('/course', courseApiRouter);
router.use('/courses', progressRouter);
router.use('/courses', courseRouter);
router.use('/modules', moduleRouter);
router.use('/submodules', submoduleRouter);
router.use('/content-items', contentItemRouter);

export default router;

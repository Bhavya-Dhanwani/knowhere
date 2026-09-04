import express from 'express';
import healthRouter from './health.router.js';
import resourceRouter from '../../modules/resource/resource.router.js';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/resources', resourceRouter);

export default router;

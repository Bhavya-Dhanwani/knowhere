import express from 'express';
import healthRouter from './health.router.js';
import codingRouter from '../../modules/question/question.router.js';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/', codingRouter);

export default router;

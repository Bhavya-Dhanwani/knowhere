import express from 'express';
import healthRouter from './health.router.js';
import questionRouter from '../../modules/question/question.router.js';

const router = express.Router();

router.use('/health', healthRouter);
router.use('/questions', questionRouter);

export default router;

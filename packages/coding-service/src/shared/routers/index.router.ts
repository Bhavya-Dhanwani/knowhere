import express from 'express';
import healthRouter from './health.router.js';
import codingRouter from '../../modules/question/question.router.js';

const router = express.Router();

router.use('/health', healthRouter);
// /api/coding/* — the ingress routes /api/questions to mcq-service
router.use('/coding', codingRouter);

export default router;

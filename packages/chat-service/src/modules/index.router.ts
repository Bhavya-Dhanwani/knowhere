import express from 'express';
import communityRouter from '../community/community.router.js';

// every chat route belongs to a course community
const router = express.Router();
router.use('/', communityRouter);

export default router;

import express from 'express';
import reviewRouter from '../../modules/review/review.router.js';

const router = express.Router();

router.use('/review', reviewRouter);

export default router;

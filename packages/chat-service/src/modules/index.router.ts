import express from 'express';
import roomRouter from './room/room.router.js';
import messageRouter from './message/message.router.js';

const router = express.Router();

router.use('/rooms', roomRouter);
router.use('/', messageRouter);

export default router;

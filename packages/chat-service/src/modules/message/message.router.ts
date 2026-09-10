import express from 'express';
import { authMiddleware, validate } from '@lms/shared';
import MessageController from './message.controller.js';
import { sendMessageSchema, editMessageSchema, reactionSchema } from './message.validator.js';

const router = express.Router();
const controller = new MessageController();

router.use(authMiddleware);

// Room-scoped messages
router.get('/rooms/:roomId/messages', controller.getMessages);
router.post('/rooms/:roomId/messages', validate(sendMessageSchema), controller.sendMessage);
router.get('/rooms/:roomId/pinned', controller.getPinnedMessages);

// Direct message operations
router.put('/messages/:messageId', validate(editMessageSchema), controller.editMessage);
router.delete('/messages/:messageId', controller.deleteMessage);
router.post('/messages/:messageId/react', validate(reactionSchema), controller.toggleReaction);

export default router;

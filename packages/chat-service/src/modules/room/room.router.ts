import express from 'express';
import { authMiddleware, validate } from '@lms/shared';
import RoomController from './room.controller.js';
import { createRoomSchema, updateRoomSchema, roomIdParamSchema } from './room.validator.js';

const router = express.Router();
const controller = new RoomController();

router.use(authMiddleware);

router.get('/', controller.listRooms);
router.post('/', validate(createRoomSchema), controller.createRoom);
router.get('/:id', validate({ params: roomIdParamSchema }), controller.getRoom);
router.put(
  '/:id',
  validate({ params: roomIdParamSchema, body: updateRoomSchema }),
  controller.updateRoom
);
router.delete('/:id', validate({ params: roomIdParamSchema }), controller.deleteRoom);
router.post('/:id/join', validate({ params: roomIdParamSchema }), controller.joinRoom);
router.post('/:id/leave', validate({ params: roomIdParamSchema }), controller.leaveRoom);

export default router;

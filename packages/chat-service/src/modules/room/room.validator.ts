import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  description: z.string().optional().default(''),
  type: z.enum(['course', 'public', 'private_group', 'direct']).default('public'),
  courseId: z.string().optional(),
  icon: z.string().optional()
});

export const updateRoomSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  icon: z.string().optional()
});

export const roomIdParamSchema = z.object({
  id: z.string().min(1, 'Room ID is required')
});

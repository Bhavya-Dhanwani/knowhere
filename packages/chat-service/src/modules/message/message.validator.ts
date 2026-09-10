import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty'),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        type: z.enum(['image', 'video', 'file', 'code']).default('file'),
        name: z.string(),
        sizeBytes: z.number().optional()
      })
    )
    .optional(),
  replyTo: z
    .object({
      messageId: z.string(),
      senderName: z.string(),
      snippet: z.string()
    })
    .optional()
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  beforeId: z.string().optional()
});

export const editMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty')
});

export const reactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required')
});

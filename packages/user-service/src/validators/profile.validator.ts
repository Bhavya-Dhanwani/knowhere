import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  email: z.string().email('Invalid email address').optional(),
  avatar: z.string().url('Avatar must be a valid URL').optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio max 500 characters').optional(),
  phone: z.string().max(20, 'Phone max 20 characters').optional(),
  headline: z.string().max(120, 'Headline max 120 characters').optional()
});

export const profileParamsSchema = z.object({
  userId: z.string().min(1, 'userId is required')
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

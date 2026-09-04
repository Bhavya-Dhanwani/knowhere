import { z } from 'zod';

export const createCompetencySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  skill: z.string().min(1, 'skill is required'),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  score: z.number().min(0).max(100).optional(),
  verifiedBy: z.string().optional()
});

export const competencyParamsSchema = z.object({
  userId: z.string().min(1, 'userId is required')
});

export type CreateCompetencyInput = z.infer<typeof createCompetencySchema>;

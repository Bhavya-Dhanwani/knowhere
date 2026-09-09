// Importing modules
import { config } from 'dotenv';
import z from 'zod';

import envConstants from '../constants/env.constants.js';

// loading environment variables
config();

// defining the schema for environment variables
const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32)
    .default(process.env.NODE_ENV === 'test' ? envConstants.ACCESS_TOKEN_SECRET : ''),
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(32)
    .default(process.env.NODE_ENV === 'test' ? envConstants.INTERNAL_SERVICE_TOKEN : ''),
  USER_SERVICE_URL: z.string().url().default(envConstants.USER_SERVICE_URL),
  MEDIA_SERVICE_URL: z.string().url().default(envConstants.MEDIA_SERVICE_URL),
  MCQ_SERVICE_URL: z.string().url().default(envConstants.MCQ_SERVICE_URL),
  CODING_SERVICE_URL: z.string().url().default(envConstants.CODING_SERVICE_URL)
});

// parsing and validating environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for courseService:', parsedEnv.error.format());
  process.exit(1);
}

if (
  parsedEnv.data.NODE_ENV === 'production' &&
  (!process.env.ACCESS_TOKEN_SECRET || !process.env.INTERNAL_SERVICE_TOKEN)
) {
  throw new Error('ACCESS_TOKEN_SECRET and INTERNAL_SERVICE_TOKEN are required in production.');
}

// getting the validated environment variables
const env = parsedEnv.data;

export default env;

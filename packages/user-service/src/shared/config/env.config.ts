import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';
import { assertKeysConfigured } from '@lms/shared';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for userService:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

// access-token keys: dev defaults locally, required in production
assertKeysConfigured('verifier');

export default env;

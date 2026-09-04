import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  ACCESS_TOKEN_SECRET: z.string().default(envConstants.ACCESS_TOKEN_SECRET),
  JUDGE_WORKER_TIMEOUT_MS: z.coerce.number().default(envConstants.JUDGE_WORKER_TIMEOUT_MS)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for codingService:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

export default env;

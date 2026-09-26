import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';
import { assertKeysConfigured } from '@lms/shared';

config();

const envSchema = z.object({
  // sandboxed runner for Python / C++ / Java submissions (packages/judge-runner)
  JUDGE_URL: z.string().default('http://localhost:5010'),
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  JUDGE_WORKER_TIMEOUT_MS: z.coerce.number().default(envConstants.JUDGE_WORKER_TIMEOUT_MS)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for codingService:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

// access-token keys: dev defaults locally, required in production
assertKeysConfigured('verifier');

export default env;

import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32)
    .default(process.env.NODE_ENV === 'test' ? envConstants.ACCESS_TOKEN_SECRET : ''),
  JUDGE_WORKER_TIMEOUT_MS: z.coerce
    .number()
    .positive()
    .default(envConstants.JUDGE_WORKER_TIMEOUT_MS),
  REDIS_URL: z.string().default(envConstants.REDIS_URL),
  CODING_RUNNER_URL: z.string().default(envConstants.CODING_RUNNER_URL),
  CODING_RUNNER_TOKEN: z.string().default(envConstants.CODING_RUNNER_TOKEN)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for codingService:', parsedEnv.error.format());
  process.exit(1);
}

if (
  parsedEnv.data.NODE_ENV === 'production' &&
  (!process.env.ACCESS_TOKEN_SECRET ||
    !parsedEnv.data.REDIS_URL ||
    !parsedEnv.data.CODING_RUNNER_URL)
) {
  throw new Error(
    'ACCESS_TOKEN_SECRET, REDIS_URL, and CODING_RUNNER_URL are required in production.'
  );
}

const env = parsedEnv.data;

export default env;

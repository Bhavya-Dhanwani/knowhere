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
  TEMPORAL_ADDRESS: z.string().optional().default(envConstants.TEMPORAL_ADDRESS),
  E2B_API_KEY: z.string().optional().default(envConstants.E2B_API_KEY),
  OPENAI_API_KEY: z.string().optional().default(envConstants.OPENAI_API_KEY),
  ANTHROPIC_API_KEY: z.string().optional().default(envConstants.ANTHROPIC_API_KEY),
  MISTRAL_API_KEYS: z.string().optional().default(envConstants.MISTRAL_API_KEYS),
  MISTRAL_MODEL: z.string().optional().default(envConstants.MISTRAL_MODEL),
  BROWSER_EVALUATION_RUNNER_URL: z
    .string()
    .optional()
    .default(envConstants.BROWSER_EVALUATION_RUNNER_URL),
  API_EVALUATION_RUNNER_URL: z.string().optional().default(envConstants.API_EVALUATION_RUNNER_URL),
  EXECUTION_EVALUATION_RUNNER_URL: z
    .string()
    .optional()
    .default(envConstants.EXECUTION_EVALUATION_RUNNER_URL),
  STATIC_ANALYSIS_RUNNER_URL: z
    .string()
    .optional()
    .default(envConstants.STATIC_ANALYSIS_RUNNER_URL),
  ALLOW_LOCAL_TRUSTED_ANALYZERS: z
    .enum(['true', 'false'])
    .default(envConstants.ALLOW_LOCAL_TRUSTED_ANALYZERS ? 'true' : 'false')
    .transform((value) => value === 'true'),
  REDIS_URL: z.string().optional().default(envConstants.REDIS_URL),
  EVALUATION_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(32)
    .default(envConstants.EVALUATION_WORKER_CONCURRENCY),
  EVALUATION_RUNNER_TOKEN: z.string().optional().default(envConstants.EVALUATION_RUNNER_TOKEN),
  EVALUATION_WORKSPACE_ROOT: z.string().optional().default(envConstants.EVALUATION_WORKSPACE_ROOT)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    'Invalid environment variables for projectReviewService:',
    parsedEnv.error.format()
  );
  process.exit(1);
}

const env = parsedEnv.data;

export default env;

import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';
import { assertKeysConfigured } from '@lms/shared';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  TEMPORAL_ADDRESS: z.string().optional().default(envConstants.TEMPORAL_ADDRESS),
  E2B_API_KEY: z.string().optional().default(envConstants.E2B_API_KEY),
  OPENAI_API_KEY: z.string().optional().default(envConstants.OPENAI_API_KEY),
  ANTHROPIC_API_KEY: z.string().optional().default(envConstants.ANTHROPIC_API_KEY),
  MISTRAL_API_KEYS: z.string().optional().default(envConstants.MISTRAL_API_KEYS),
  MISTRAL_MODEL: z.string().optional().default(envConstants.MISTRAL_MODEL),
  // how many submissions a batch evaluates at once (each clones a repo + calls the LLM)
  REVIEW_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(envConstants.REVIEW_CONCURRENCY),
  // Chromium binary for live-site audits; empty = use the locally installed Chrome
  CHROMIUM_PATH: z.string().optional().default(envConstants.CHROMIUM_PATH),
  // read-only GitHub token: 5000 req/h instead of 60, so big batches don't hit the rate limit
  GITHUB_TOKEN: z.string().optional().default(envConstants.GITHUB_TOKEN),
  // judge-runner base URL: builds + tests each submission in its offline sandbox; empty = skip
  JUDGE_URL: z.string().optional().default(envConstants.JUDGE_URL)
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

// access-token keys: dev defaults locally, required in production
assertKeysConfigured('verifier');

export default env;

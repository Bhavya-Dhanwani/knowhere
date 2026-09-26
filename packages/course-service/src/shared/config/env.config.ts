// Importing modules
import { config } from 'dotenv';
import z from 'zod';

import envConstants from '../constants/env.constants.js';
import { assertKeysConfigured } from '@lms/shared';

// loading environment variables
config();

// defining the schema for environment variables
const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  AWS_REGION: z.string().default(envConstants.AWS_REGION),
  AWS_ACCESS_KEY_ID: z.string().default(envConstants.AWS_ACCESS_KEY_ID),
  AWS_SECRET_ACCESS_KEY: z.string().default(envConstants.AWS_SECRET_ACCESS_KEY),
  S3_RAW_BUCKET: z.string().default(envConstants.S3_RAW_BUCKET),
  S3_TRANSCODED_BUCKET: z.string().default(envConstants.S3_TRANSCODED_BUCKET),
  CLOUDFRONT_DOMAIN: z.string().default(envConstants.CLOUDFRONT_DOMAIN),
  // set for S3-compatible stores (MinIO, LocalStack); unset uses AWS
  S3_ENDPOINT: z.string().optional(),
  USER_SERVICE_URL: z.string().default('http://localhost:5001'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  // sandboxed runner for Python / C++ / Java submissions (packages/judge-runner)
  JUDGE_URL: z.string().default('http://localhost:5010'),
  MISTRAL_API_KEYS: z.string().optional().default(envConstants.MISTRAL_API_KEYS),
  MISTRAL_MODEL: z.string().optional().default(envConstants.MISTRAL_MODEL)
});

// parsing and validating environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for courseService:', parsedEnv.error.format());
  process.exit(1);
}

// getting the validated environment variables
const env = parsedEnv.data;

// access-token keys: dev defaults locally, required in production
assertKeysConfigured('verifier');

export default env;

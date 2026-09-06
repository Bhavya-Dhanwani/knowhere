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
  TEMPORAL_ADDRESS: z.string().optional().default(envConstants.TEMPORAL_ADDRESS),
  E2B_API_KEY: z.string().optional().default(envConstants.E2B_API_KEY),
  OPENAI_API_KEY: z.string().optional().default(envConstants.OPENAI_API_KEY),
  ANTHROPIC_API_KEY: z.string().optional().default(envConstants.ANTHROPIC_API_KEY),
  MISTRAL_API_KEYS: z.string().optional().default(envConstants.MISTRAL_API_KEYS),
  MISTRAL_MODEL: z.string().optional().default(envConstants.MISTRAL_MODEL)
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

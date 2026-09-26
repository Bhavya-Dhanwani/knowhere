import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';
import { assertKeysConfigured } from '@lms/shared';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  REDIS_URL: z.string().default(envConstants.REDIS_URL),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  USER_SERVICE_URL: z.string().default('http://localhost:5001'),
  // database name, so a shared cluster URI (k8s) still lands in the chat database
  MONGO_DB_NAME: z.string().default('chatService'),
  // voice channels run on LiveKit (SFU); LIVEKIT_URL is the address browsers connect to
  LIVEKIT_URL: z.string().default('ws://localhost:7880'),
  LIVEKIT_API_KEY: z.string().default(''),
  LIVEKIT_API_SECRET: z.string().default('')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for chatService:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

// access-token keys: dev defaults locally, required in production
assertKeysConfigured('verifier');

export default env;

import { config } from 'dotenv';
import z from 'zod';
import envConstants from '../constants/env.constants.js';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(envConstants.PORT),
  NODE_ENV: z.enum(['development', 'production', 'test']).default(envConstants.NODE_ENV),
  MONGO_URI: z.string().default(envConstants.MONGO_URI),
  REDIS_URL: z.string().default(envConstants.REDIS_URL),
  CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
  ACCESS_TOKEN_SECRET: z.string().default(envConstants.ACCESS_TOKEN_SECRET)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for chatService:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || env.ACCESS_TOKEN_SECRET;

export default env;

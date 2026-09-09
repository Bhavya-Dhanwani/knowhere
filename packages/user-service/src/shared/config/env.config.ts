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
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(32)
    .default(process.env.NODE_ENV === 'test' ? envConstants.INTERNAL_SERVICE_TOKEN : '')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for userService:', parsedEnv.error.format());
  process.exit(1);
}

if (
  parsedEnv.data.NODE_ENV === 'production' &&
  (!process.env.ACCESS_TOKEN_SECRET || !process.env.INTERNAL_SERVICE_TOKEN)
) {
  throw new Error('ACCESS_TOKEN_SECRET and INTERNAL_SERVICE_TOKEN are required in production.');
}

const env = parsedEnv.data;

export default env;

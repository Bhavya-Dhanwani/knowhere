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
  AWS_REGION: z.string().default(envConstants.AWS_REGION),
  AWS_ACCESS_KEY_ID: z.string().default(envConstants.AWS_ACCESS_KEY_ID),
  AWS_SECRET_ACCESS_KEY: z.string().default(envConstants.AWS_SECRET_ACCESS_KEY),
  S3_RAW_BUCKET: z.string().default(envConstants.S3_RAW_BUCKET),
  S3_TRANSCODED_BUCKET: z.string().default(envConstants.S3_TRANSCODED_BUCKET),
  CLOUDFRONT_DOMAIN: z.string().default(envConstants.CLOUDFRONT_DOMAIN)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for mediaService:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

export default env;

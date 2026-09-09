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
  AWS_REGION: z.string().default(envConstants.AWS_REGION),
  AWS_ACCESS_KEY_ID: z.string().default(envConstants.AWS_ACCESS_KEY_ID),
  AWS_SECRET_ACCESS_KEY: z.string().default(envConstants.AWS_SECRET_ACCESS_KEY),
  S3_RAW_BUCKET: z.string().default(envConstants.S3_RAW_BUCKET),
  S3_TRANSCODED_BUCKET: z.string().default(envConstants.S3_TRANSCODED_BUCKET),
  CLOUDFRONT_DOMAIN: z.string().default(envConstants.CLOUDFRONT_DOMAIN),
  MEDIACONVERT_ROLE_ARN: z.string().default(envConstants.MEDIACONVERT_ROLE_ARN),
  MEDIACONVERT_QUEUE_ARN: z.string().default(envConstants.MEDIACONVERT_QUEUE_ARN),
  MEDIACONVERT_ENDPOINT: z.string().default(envConstants.MEDIACONVERT_ENDPOINT)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables for mediaService:', parsedEnv.error.format());
  process.exit(1);
}

if (
  parsedEnv.data.NODE_ENV === 'production' &&
  (!process.env.ACCESS_TOKEN_SECRET ||
    !parsedEnv.data.MEDIACONVERT_ROLE_ARN ||
    !parsedEnv.data.MEDIACONVERT_ENDPOINT)
) {
  throw new Error('Production media service requires JWT and MediaConvert configuration.');
}

const env = parsedEnv.data;

export default env;

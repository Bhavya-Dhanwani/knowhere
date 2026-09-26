const envConstants = {
  PORT: 5002,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/courseService',
  CORS_ORIGIN: '*',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test_access_key',
  AWS_SECRET_ACCESS_KEY: 'test_secret_key',
  S3_RAW_BUCKET: 'lms-raw-media',
  S3_TRANSCODED_BUCKET: 'lms-transcoded-media',
  CLOUDFRONT_DOMAIN: 'https://cdn.example.com',
  MISTRAL_API_KEYS: '',
  MISTRAL_MODEL: 'mistral-medium-latest'
} as const;

export default envConstants;

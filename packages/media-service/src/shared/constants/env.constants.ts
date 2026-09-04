const envConstants = {
  PORT: 5003,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/mediaService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'super_secret_access_jwt_key_auth_service',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test_access_key',
  AWS_SECRET_ACCESS_KEY: 'test_secret_key',
  S3_RAW_BUCKET: 'lms-raw-media',
  S3_TRANSCODED_BUCKET: 'lms-transcoded-media',
  CLOUDFRONT_DOMAIN: 'https://cdn.example.com'
} as const;

export default envConstants;

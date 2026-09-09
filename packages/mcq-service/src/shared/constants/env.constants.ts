const envConstants = {
  PORT: 5004,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/mcqService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'test_only_access_secret_at_least_32_chars'
} as const;

export default envConstants;

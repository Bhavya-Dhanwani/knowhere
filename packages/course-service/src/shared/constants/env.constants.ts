const envConstants = {
  PORT: 5002,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/courseService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'dev_only_access_secret_change_me_32_chars',
  INTERNAL_SERVICE_TOKEN: 'dev_only_internal_service_token_change_me',
  USER_SERVICE_URL: 'http://localhost:5001',
  MEDIA_SERVICE_URL: 'http://localhost:5003',
  MCQ_SERVICE_URL: 'http://localhost:5004',
  CODING_SERVICE_URL: 'http://localhost:5005'
} as const;

export default envConstants;

const envConstants = {
  PORT: 5001,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/userService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'dev_only_access_secret_change_me_32_chars',
  INTERNAL_SERVICE_TOKEN: 'dev_only_internal_service_token_change_me'
} as const;

export default envConstants;

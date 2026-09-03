const envConstants = {
  PORT: 5001,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/userService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'super_secret_access_jwt_key_auth_service'
} as const;

export default envConstants;

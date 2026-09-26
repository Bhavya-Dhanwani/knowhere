const envConstants = {
  PORT: 5004,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/mcqService',
  CORS_ORIGIN: '*'
} as const;

export default envConstants;

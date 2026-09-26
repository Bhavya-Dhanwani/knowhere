const envConstants = {
  PORT: 5005,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/codingService',
  CORS_ORIGIN: '*',
  JUDGE_WORKER_TIMEOUT_MS: 5000
} as const;

export default envConstants;

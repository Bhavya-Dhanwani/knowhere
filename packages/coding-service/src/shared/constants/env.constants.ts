const envConstants = {
  PORT: 5005,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27017/codingService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'dev_only_access_secret_change_me_32_chars',
  JUDGE_WORKER_TIMEOUT_MS: 30000,
  REDIS_URL: '',
  CODING_RUNNER_URL: '',
  CODING_RUNNER_TOKEN: ''
} as const;

export default envConstants;

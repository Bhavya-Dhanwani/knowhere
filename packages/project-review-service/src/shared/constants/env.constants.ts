const envConstants = {
  PORT: 5006,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://127.0.0.1:27017/projectReviewService',
  CORS_ORIGIN: '*',
  ACCESS_TOKEN_SECRET: 'test_only_access_secret_at_least_32_chars',
  TEMPORAL_ADDRESS: '',
  E2B_API_KEY: '',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  MISTRAL_API_KEYS: '',
  MISTRAL_MODEL: 'mistral-medium-latest',
  BROWSER_EVALUATION_RUNNER_URL: '',
  API_EVALUATION_RUNNER_URL: '',
  EXECUTION_EVALUATION_RUNNER_URL: '',
  STATIC_ANALYSIS_RUNNER_URL: '',
  ALLOW_LOCAL_TRUSTED_ANALYZERS: false,
  REDIS_URL: '',
  EVALUATION_WORKER_CONCURRENCY: 2,
  EVALUATION_RUNNER_TOKEN: '',
  EVALUATION_WORKSPACE_ROOT: ''
} as const;

export default envConstants;

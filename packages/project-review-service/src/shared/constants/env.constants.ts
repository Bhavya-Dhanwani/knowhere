const envConstants = {
  PORT: 5006,
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://127.0.0.1:27017/projectReviewService',
  CORS_ORIGIN: '*',
  TEMPORAL_ADDRESS: '',
  E2B_API_KEY: '',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  MISTRAL_API_KEYS: '',
  MISTRAL_MODEL: 'mistral-medium-latest',
  REVIEW_CONCURRENCY: 3,
  CHROMIUM_PATH: '',
  GITHUB_TOKEN: '',
  JUDGE_URL: ''
} as const;

export default envConstants;

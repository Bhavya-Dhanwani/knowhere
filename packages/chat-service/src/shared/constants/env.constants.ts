const envConstants = {
  PORT: 5007,
  NODE_ENV: 'development' as const,
  MONGO_URI: 'mongodb://localhost:27017/chatService',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGIN: '*'
};

export default envConstants;

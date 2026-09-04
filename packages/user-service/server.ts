// Importing modules
import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';

// function to start the server
async function startServer() {
  const app = createApp();

  await connectDB();

  app.listen(env.PORT || 5001, () => {
    logger.info(`User service is running on port ${env.PORT || 5001}`);
  });
}

startServer();

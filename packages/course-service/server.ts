// Importing modules
import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';

// function to start the server
async function startServer() {
  const app = createApp();

  await connectDB();

  const port = env.PORT || 5002;
  app.listen(port, () => {
    logger.info(`Course service is running on port ${port}`);
  });
}

startServer();

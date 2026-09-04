import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';

async function startServer() {
  const app = createApp();

  const port = env.PORT || 5003;
  app.listen(port, () => {
    logger.info(`Media service is running on port ${port}`);
  });

  await connectDB();
}

startServer();

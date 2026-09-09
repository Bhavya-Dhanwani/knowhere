import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';
import judgeWorker from './src/workers/judge.worker.js';

async function startServer() {
  const app = createApp();

  const port = env.PORT || 5005;
  await connectDB();
  judgeWorker.start();
  const server = app.listen(port, () => {
    logger.info(`Coding service is running on port ${port}`);
  });
  const shutdown = async () => {
    await judgeWorker.close();
    server.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer().catch((error) => {
  logger.fatal({ error }, 'Coding service failed to start');
  process.exit(1);
});

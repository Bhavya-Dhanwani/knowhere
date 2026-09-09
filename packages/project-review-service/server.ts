import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';
import { EvaluationQueue } from './src/modules/workflows/evaluation.queue.js';

async function startServer() {
  const app = createApp();

  const port = env.PORT || 5006;
  await connectDB();
  EvaluationQueue.startWorker();
  await EvaluationQueue.reconcileQueued();

  const server = app.listen(port, () => {
    logger.info(`Project Review & Relative Ranking Service is running on port ${port}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down project review service');
    await EvaluationQueue.close();
    server.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer();

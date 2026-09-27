import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';
import { WorkflowRunner } from './src/modules/workflows/workflow.runner.js';

// this service drives a browser over student-controlled sites: one stray rejection from a
// third-party library must be logged, not allowed to kill every queued evaluation
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));

async function startServer() {
  const app = createApp();

  const port = env.PORT || 5006;
  app.listen(port, () => {
    logger.info(`Project Review & Relative Ranking Service is running on port ${port}`);
  });

  await connectDB();
  const resume = () =>
    WorkflowRunner.resumeInterrupted().catch((err) => logger.error({ err }, 'Queue resume failed'));
  await resume();
  // every replica also sweeps for work orphaned by a worker that died elsewhere
  setInterval(resume, 60_000);
}

startServer();

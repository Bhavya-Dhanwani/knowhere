// Importing modules
import express, { Express } from 'express';
import router from './shared/routers/index.router.js';
import applyMiddlewares from './shared/middlewares/index.middleware.js';
import notFoundHandler from './shared/middlewares/NotFound.middleware.js';
import errorHandler from './shared/middlewares/error.middleware.js';

// function to make the app
function createApp(): Express {
  // create an express app
  const app = express();

  // applying middlewares
  applyMiddlewares(app);

  // health check endpoint for kubernetes probes
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // adding the index router to the app
  app.use('/api', router);

  // API routes not found handler
  app.use('/api', notFoundHandler);

  // general not found middleware
  app.use(notFoundHandler);

  // error handling middleware
  app.use(errorHandler);

  return app;
}

export default createApp;

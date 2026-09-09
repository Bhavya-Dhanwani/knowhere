import express, { Express } from 'express';
import router from './shared/routers/index.router.js';
import applyMiddlewares from './shared/middlewares/index.middleware.js';
import notFoundHandler from './shared/middlewares/NotFound.middleware.js';
import errorHandler from './shared/middlewares/error.middleware.js';

function createApp(): Express {
  const app = express();

  applyMiddlewares(app);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/api/coding', router);
  app.use('/api/coding', router);
  app.use('/api', router);
  app.use('/api', notFoundHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { errorHandler } from '@lms/shared';
import env from './shared/config/env.config.js';
import router from './modules/index.router.js';

function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true
    })
  );
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check for Kubernetes probes
  app.get('/health', (_req, res) =>
    res.status(200).json({ status: 'ok', service: 'chat-service' })
  );

  // Chat API routes
  app.use('/api/chat', router);

  // Fallback 404 for unknown chat routes
  app.use('/api/chat', (_req, res) => {
    res
      .status(404)
      .json({ success: false, error: { code: 'NOT_FOUND', message: 'Chat route not found' } });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}

export default createApp;

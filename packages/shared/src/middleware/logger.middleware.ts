import { pinoHttp } from 'pino-http';
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

export const requestLogger = pinoHttp({
  logger,
  autoLogging: process.env.NODE_ENV !== 'test'
});

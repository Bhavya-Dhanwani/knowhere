// Importing modules
import pino from 'pino';
import env from './env.config.js';

// creating a logger instance
const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(process.env.PRETTY_LOGS === 'true' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  })
});

export default logger;

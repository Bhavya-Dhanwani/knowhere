import pino from 'pino';
import env from './env.config.js';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.PRETTY_LOGS === 'true'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }
      : undefined
});

export default logger;

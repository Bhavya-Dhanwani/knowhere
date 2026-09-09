import pino from 'pino';
import env from './env.config.js';

const isProduction = env.NODE_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport:
    process.env.PRETTY_LOGS === 'true'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

export default logger;

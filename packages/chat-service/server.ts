import http from 'node:http';
import createApp from './src/app.js';
import connectDB from './src/shared/config/db.config.js';
import env from './src/shared/config/env.config.js';
import logger from './src/shared/config/logger.config.js';
import { initSocketServer } from './src/socket/socket.server.js';

async function startServer(): Promise<void> {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO on top of HTTP server
  initSocketServer(httpServer);

  const port = env.PORT || 5007;
  httpServer.listen(port, () => {
    logger.info(`Chat service is running on port ${port}`);
  });

  await connectDB();
}

startServer();

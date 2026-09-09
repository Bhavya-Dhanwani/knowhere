import mongoose from 'mongoose';
import env from './env.config.js';
import logger from './logger.config.js';

async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(env.MONGO_URI);
    logger.info('Connected to MongoDB database (mediaService)');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

export default connectDB;

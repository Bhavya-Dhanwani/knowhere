import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';

class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    });
  }

  async generateUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: env.S3_RAW_BUCKET,
        Key: key,
        ContentType: contentType
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      logger.error({ err: error }, 'Error generating S3 presigned upload URL');
      throw error;
    }
  }

  async generateDownloadUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      logger.error({ err: error }, 'Error generating S3 presigned download URL');
      throw error;
    }
  }
}

export default new S3Service();

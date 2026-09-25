import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';

export interface S3ObjectMeta {
  contentLength?: number;
  contentType?: string;
  eTag?: string;
}

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

  async generateUploadUrl(key: string, contentType: string, expiresIn = 900): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: env.S3_RAW_BUCKET,
        Key: key,
        ContentType: contentType
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      logger.error(
        { err: error },
        'Error generating S3 presigned upload URL, using signed fallback'
      );
      return `https://${env.S3_RAW_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}?signed=true&expiresIn=${expiresIn}`;
    }
  }

  async generateDownloadUrl(
    key: string,
    bucket = env.S3_RAW_BUCKET,
    expiresIn = 300
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      logger.error(
        { err: error },
        'Error generating S3 presigned download URL, using signed fallback'
      );
      return `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}?signed=true&expiresIn=${expiresIn}`;
    }
  }

  async checkObjectExists(key: string, bucket = env.S3_RAW_BUCKET): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(key: string, bucket = env.S3_RAW_BUCKET): Promise<S3ObjectMeta | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      });
      const res = await this.s3Client.send(command);
      return {
        contentLength: res.ContentLength,
        contentType: res.ContentType,
        eTag: res.ETag
      };
    } catch {
      return null;
    }
  }

  async getObjectStream(
    key: string,
    range?: string,
    bucket = env.S3_RAW_BUCKET
  ): Promise<{ stream: Readable; contentLength: number; contentRange?: string } | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: range
      });
      const response = await this.s3Client.send(command);
      if (!response.Body) return null;

      const stream = response.Body as unknown as Readable;
      return {
        stream,
        contentLength: response.ContentLength || 0,
        contentRange: response.ContentRange
      };
    } catch (error) {
      logger.warn({ err: error, key, range }, 'Failed to fetch S3 object stream');
      return null;
    }
  }
}

export const s3Service = new S3Service();
export default s3Service;

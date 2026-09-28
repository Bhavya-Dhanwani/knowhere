import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  HeadBucketCommand,
  CreateBucketCommand
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

const clientFor = (endpoint?: string) =>
  new S3Client({
    region: env.AWS_REGION,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    // no static keys (e.g. EKS with IRSA): the SDK's default chain uses the pod's IAM role
    ...(env.AWS_ACCESS_KEY_ID
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY
          }
        }
      : {})
  });

class S3Service {
  private s3Client = clientFor(env.S3_ENDPOINT);
  // presigned URLs are signed for the host the browser will call
  private presignClient = clientFor(env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT);

  // Browsers PUT uploads and fetch HLS segments straight from the buckets via presigned URLs, so the
  // buckets must answer CORS; the signature, not the origin, is what grants access.
  // Creates missing buckets (a fresh MinIO) and sets CORS; both are no-ops when already in place.
  async ensureBuckets(): Promise<void> {
    const origins = env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    for (const bucket of [env.S3_RAW_BUCKET, env.S3_TRANSCODED_BUCKET]) {
      try {
        await this.s3Client
          .send(new HeadBucketCommand({ Bucket: bucket }))
          .catch(() => this.s3Client.send(new CreateBucketCommand({ Bucket: bucket })));
      } catch (error) {
        logger.warn({ err: error, bucket }, 'Storage bucket is not reachable');
        continue;
      }
      try {
        await this.s3Client.send(
          new PutBucketCorsCommand({
            Bucket: bucket,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedOrigins: origins.length ? origins : ['*'],
                  AllowedMethods: ['GET', 'PUT', 'HEAD'],
                  AllowedHeaders: ['*'],
                  ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range'],
                  MaxAgeSeconds: 3600
                }
              ]
            }
          })
        );
      } catch (error) {
        // MinIO has no bucket CORS API; it is only needed when browsers call the store cross-origin
        logger.info({ bucket, reason: (error as Error).name }, 'Bucket CORS not set');
      }
    }
  }

  async generateUploadUrl(key: string, contentType: string, expiresIn = 900): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: env.S3_RAW_BUCKET,
      Key: key,
      ContentType: contentType
    });
    return await getSignedUrl(this.presignClient, command, { expiresIn });
  }

  async generateDownloadUrl(
    key: string,
    bucket = env.S3_RAW_BUCKET,
    expiresIn = 300
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(this.presignClient, command, { expiresIn });
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

  async putObject(key: string, body: Buffer, contentType: string, bucket = env.S3_RAW_BUCKET) {
    await this.s3Client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
    );
  }

  // removes every object under a prefix (e.g. a video's HLS segments)
  async deletePrefix(prefix: string, bucket = env.S3_RAW_BUCKET): Promise<void> {
    try {
      let token: string | undefined;
      do {
        const page = await this.s3Client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
        );
        const keys = (page.Contents || []).map((o) => ({ Key: o.Key! }));
        if (keys.length) {
          await this.s3Client.send(
            new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } })
          );
        }
        token = page.NextContinuationToken;
      } while (token);
    } catch (error) {
      logger.warn({ err: error, prefix }, 'Could not delete S3 prefix');
    }
  }

  async deleteObject(key: string, bucket = env.S3_RAW_BUCKET): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      logger.warn({ err: error, key }, 'Could not delete S3 object');
    }
  }
}

export const s3Service = new S3Service();
export default s3Service;

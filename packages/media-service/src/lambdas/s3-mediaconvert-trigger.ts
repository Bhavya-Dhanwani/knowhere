import { CreateJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import ResourceDao from '../shared/dao/resource.dao.js';
import connectDB from '../shared/config/db.config.js';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';

interface S3EventRecord {
  s3: { bucket: { name: string }; object: { key: string; size: number } };
}
interface S3Event {
  Records: S3EventRecord[];
}

export async function handler(event: S3Event): Promise<{ statusCode: number; body: string }> {
  await connectDB();
  const resourceDao = new ResourceDao();
  const client = new MediaConvertClient({
    region: env.AWS_REGION,
    endpoint: env.MEDIACONVERT_ENDPOINT,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    }
  });
  const jobs: string[] = [];

  for (const record of event.Records || []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const resource = await resourceDao.findResourceByS3Key(key);
    if (!resource) throw new Error(`No resource record exists for uploaded object ${key}.`);

    if (resource.type === 'notes') {
      await resourceDao.updateResourceStatus(resource._id.toString(), 'ready', {
        playbackUrl: `${env.CLOUDFRONT_DOMAIN}/${encodeURI(key)}`,
        fileSizeBytes: record.s3.object.size
      });
      continue;
    }

    const outputPrefix = `s3://${env.S3_TRANSCODED_BUCKET}/transcoded/${resource._id}/`;
    const result = await client.send(
      new CreateJobCommand({
        Role: env.MEDIACONVERT_ROLE_ARN,
        ...(env.MEDIACONVERT_QUEUE_ARN ? { Queue: env.MEDIACONVERT_QUEUE_ARN } : {}),
        UserMetadata: { resourceId: resource._id.toString() },
        Settings: {
          Inputs: [{ FileInput: `s3://${bucket}/${key}` }],
          OutputGroups: [
            {
              Name: 'HLS',
              OutputGroupSettings: {
                Type: 'HLS_GROUP_SETTINGS',
                HlsGroupSettings: { Destination: outputPrefix, SegmentLength: 6 }
              },
              Outputs: [
                {
                  ContainerSettings: { Container: 'M3U8', M3u8Settings: {} },
                  VideoDescription: { CodecSettings: { Codec: 'H_264', H264Settings: {} } },
                  AudioDescriptions: [{ CodecSettings: { Codec: 'AAC', AacSettings: {} } }]
                }
              ]
            }
          ]
        }
      })
    );
    if (!result.Job?.Id) throw new Error(`MediaConvert did not return a job ID for ${key}.`);
    jobs.push(result.Job.Id);
    await resourceDao.updateResourceStatus(resource._id.toString(), 'processing', {
      transcodingJobId: result.Job.Id,
      fileSizeBytes: record.s3.object.size
    });
  }

  logger.info({ jobs }, 'MediaConvert jobs submitted');
  return { statusCode: 200, body: JSON.stringify({ jobs }) };
}

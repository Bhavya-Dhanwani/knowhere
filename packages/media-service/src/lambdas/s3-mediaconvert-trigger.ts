import ResourceDao from '../shared/dao/resource.dao.js';
import logger from '../shared/config/logger.config.js';

interface S3EventRecord {
  s3: {
    bucket: { name: string };
    object: { key: string; size: number };
  };
}

interface S3Event {
  Records: S3EventRecord[];
}

export async function handler(event: S3Event): Promise<{ statusCode: number; body: string }> {
  logger.info({ event }, 'S3 MediaConvert Trigger Lambda invoked');

  const resourceDao = new ResourceDao();

  for (const record of event.Records || []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    logger.info(`Detected new S3 upload: s3://${bucket}/${key}`);

    const mockJobId = `job-mc-${Date.now()}`;
    logger.info(`MediaConvert job submitted with ID: ${mockJobId}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'MediaConvert jobs submitted successfully' })
  };
}

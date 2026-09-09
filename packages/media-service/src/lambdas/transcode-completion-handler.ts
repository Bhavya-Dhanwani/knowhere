import ResourceDao from '../shared/dao/resource.dao.js';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';
import connectDB from '../shared/config/db.config.js';

interface EventBridgeMediaConvertDetail {
  status: 'COMPLETE' | 'ERROR';
  jobId: string;
  outputGroupDetails?: Array<{
    playlistFilePaths?: string[];
    type: string;
  }>;
  userMetadata?: {
    resourceId?: string;
  };
  errorMessage?: string;
}

interface EventBridgeEvent {
  source: 'aws.mediaconvert';
  'detail-type': 'MediaConvert Job State Change';
  detail: EventBridgeMediaConvertDetail;
}

export async function handler(
  event: EventBridgeEvent
): Promise<{ statusCode: number; body: string }> {
  await connectDB();
  logger.info({ event }, 'MediaConvert Completion Lambda invoked');

  const resourceDao = new ResourceDao();
  const { status, jobId, userMetadata, outputGroupDetails } = event.detail;

  const resourceId = userMetadata?.resourceId;
  if (!resourceId) {
    logger.warn({ jobId }, 'No resourceId in userMetadata of MediaConvert event');
    return { statusCode: 400, body: 'Missing resourceId in event detail' };
  }

  if (status === 'COMPLETE') {
    const hlsPath =
      outputGroupDetails?.[0]?.playlistFilePaths?.[0] || `transcoded/${resourceId}/master.m3u8`;
    const playbackUrl = `${env.CLOUDFRONT_DOMAIN}/${hlsPath.replace(/^s3:\/\/[^/]+\//, '')}`;

    await resourceDao.updateResourceStatus(resourceId, 'ready', {
      playbackUrl,
      transcodingJobId: jobId
    });

    logger.info(`Resource ${resourceId} marked as ready with playback URL: ${playbackUrl}`);
  } else {
    await resourceDao.updateResourceStatus(resourceId, 'failed', {
      transcodingJobId: jobId
    });
    logger.error(`MediaConvert job ${jobId} failed for resource ${resourceId}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Resource status processed' })
  };
}

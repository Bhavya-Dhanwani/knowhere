import { Types } from 'mongoose';
import ResourceDao from '../shared/dao/resource.dao.js';
import logger from '../shared/config/logger.config.js';
import env from '../shared/config/env.config.js';

export interface DrmJob {
  resourceId: string;
  s3Key: string;
  enqueuedAt: Date;
}

class DrmWorkerService {
  private resourceDao: ResourceDao;
  private queue: DrmJob[] = [];
  private isProcessing = false;

  constructor() {
    this.resourceDao = new ResourceDao();
  }

  enqueueVideoDrmJob(resourceId: string, s3Key: string): void {
    this.queue.push({
      resourceId,
      s3Key,
      enqueuedAt: new Date()
    });
    logger.info({ resourceId, s3Key }, 'Enqueued DRM processing job for video resource');

    // Trigger asynchronous queue processor
    void this.processNextJob();
  }

  private async processNextJob(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.isProcessing = true;

    try {
      if (!Types.ObjectId.isValid(job.resourceId)) {
        logger.warn(
          { resourceId: job.resourceId },
          'Invalid ObjectId in DRM job, skipping DB update'
        );
        return;
      }

      logger.info({ resourceId: job.resourceId }, 'Starting DRM transcoding and packaging job');

      // Update status to DRM_PROCESSING
      await this.resourceDao.updateDrmStatus(job.resourceId, 'DRM_PROCESSING');
      await this.resourceDao.updateResourceStatus(job.resourceId, 'PROCESSING');

      // Simulating DRM encryption and multi-bitrate packaging
      // In production, this interacts with AWS Elemental MediaConvert or Bento4 DRM packager
      const manifestUrl = `${env.CLOUDFRONT_DOMAIN}/drm/manifests/${job.resourceId}/stream.mpd`;

      // Complete DRM packaging
      await this.resourceDao.updateDrmStatus(job.resourceId, 'DRM_READY', manifestUrl);
      await this.resourceDao.updateResourceStatus(job.resourceId, 'READY', {
        playbackUrl: manifestUrl,
        drmManifestUrl: manifestUrl
      });

      logger.info(
        { resourceId: job.resourceId, manifestUrl },
        'DRM packaging completed successfully'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown DRM processing error';
      logger.error({ err: error, resourceId: job.resourceId }, 'DRM processing failed');

      await this.resourceDao.updateDrmStatus(job.resourceId, 'DRM_FAILED', undefined, errorMessage);
      await this.resourceDao.updateResourceStatus(job.resourceId, 'FAILED', {
        failureReason: errorMessage
      });
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        void this.processNextJob();
      }
    }
  }
}

export const drmWorkerService = new DrmWorkerService();
export default drmWorkerService;

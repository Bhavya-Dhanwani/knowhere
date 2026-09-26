import ResourceDao from '../shared/dao/resource.dao.js';
import s3Service from './s3.service.js';
import logger from '../shared/config/logger.config.js';
import { packageHls } from './hls.service.js';

const POLL_MS = 10_000;

// Watches a presigned upload: once the object lands in S3 the resource becomes UPLOADED,
// non-video files go straight to READY, and videos are packaged as encrypted HLS first.
// If the upload never arrives before the presigned URL expires, the resource is FAILED.
class DrmWorkerService {
  private resourceDao = new ResourceDao();

  enqueueUploadWatch(resourceId: string, s3Key: string, isVideo: boolean, expiresInSec: number) {
    const giveUpAt = Date.now() + expiresInSec * 1000;

    const tick = async () => {
      try {
        if (await s3Service.checkObjectExists(s3Key)) {
          await this.resourceDao.updateResourceStatus(resourceId, 'UPLOADED');
          if (isVideo) await this.applyDrm(resourceId, s3Key);
          else await this.resourceDao.updateResourceStatus(resourceId, 'READY');
          return;
        }
        if (Date.now() >= giveUpAt) {
          await this.resourceDao.updateResourceStatus(resourceId, 'FAILED', {
            failureReason: 'Upload was not completed before the presigned URL expired.'
          });
          if (isVideo) await this.resourceDao.updateDrmStatus(resourceId, 'DRM_FAILED');
          return;
        }
        setTimeout(tick, POLL_MS).unref();
      } catch (err) {
        logger.error({ err, resourceId }, 'Upload watcher failed');
      }
    };

    setTimeout(tick, POLL_MS).unref();
    logger.info({ resourceId, s3Key, isVideo }, 'Watching presigned upload');
  }

  // Encrypted HLS: AES-128 segments, per-video key held in the DB and released per viewer.
  async applyDrm(resourceId: string, s3Key: string) {
    try {
      await this.resourceDao.updateDrmStatus(resourceId, 'DRM_PROCESSING');
      await this.resourceDao.updateResourceStatus(resourceId, 'PROCESSING');
      const out = await packageHls(resourceId, s3Key);
      await this.resourceDao.updateDrmStatus(resourceId, 'DRM_READY', out.playlistKey);
      await this.resourceDao.updateResourceStatus(resourceId, 'READY', {
        hlsKey: out.key,
        hlsIv: out.iv,
        drmManifestUrl: out.playlistKey
      });
      logger.info({ resourceId, segments: out.segments }, 'Encrypted HLS packaging completed');
    } catch (error) {
      // the upload is still playable through the authenticated range stream
      const failureReason = error instanceof Error ? error.message : 'Unknown packaging error';
      logger.error({ err: error, resourceId }, 'HLS packaging failed');
      await this.resourceDao.updateDrmStatus(resourceId, 'DRM_FAILED', undefined, failureReason);
      await this.resourceDao.updateResourceStatus(resourceId, 'READY');
    }
  }
}

export const drmWorkerService = new DrmWorkerService();
export default drmWorkerService;

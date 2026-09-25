import { Response } from 'express';
import { Readable } from 'node:stream';
import s3Service from './s3.service.js';
import logger from '../shared/config/logger.config.js';

export interface StreamOptions {
  rangeHeader?: string;
  s3Key: string;
  fileSizeBytes: number;
  mimeType?: string;
}

class VideoStreamService {
  async streamVideoChunk(res: Response, options: StreamOptions): Promise<void> {
    const { rangeHeader, s3Key, fileSizeBytes } = options;
    const contentType = options.mimeType || 'video/mp4';
    const totalSize = fileSizeBytes > 0 ? fileSizeBytes : 10 * 1024 * 1024; // fallback 10MB if 0

    // Check if Range header is present
    if (!rangeHeader) {
      // Stream whole file or default chunk
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });

      const s3Stream = await s3Service.getObjectStream(s3Key);
      if (s3Stream) {
        s3Stream.stream.pipe(res);
      } else {
        // Fallback simulated chunk stream when offline/test
        this.createMockByteStream(totalSize).pipe(res);
      }
      return;
    }

    // Parse HTTP Range header: e.g. "bytes=0-1048575" or "bytes=500-"
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res
        .status(416)
        .set({
          'Content-Range': `bytes */${totalSize}`
        })
        .send('Range Not Satisfiable');
      return;
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    // Validate range limits
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= totalSize) end = totalSize - 1;

    if (start > end || start >= totalSize) {
      res
        .status(416)
        .set({
          'Content-Range': `bytes */${totalSize}`
        })
        .send('Range Not Satisfiable');
      return;
    }

    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });

    const s3Range = `bytes=${start}-${end}`;
    const s3Stream = await s3Service.getObjectStream(s3Key, s3Range);

    if (s3Stream) {
      s3Stream.stream.pipe(res);
    } else {
      // Fallback byte stream for testing/mock environment
      logger.info({ s3Key, start, end, chunkSize }, 'Streaming mock video byte chunk');
      this.createMockByteStream(chunkSize).pipe(res);
    }
  }

  private createMockByteStream(size: number): Readable {
    const chunk = Buffer.alloc(Math.min(size, 64 * 1024), 0);
    let remaining = size;

    return new Readable({
      read() {
        if (remaining <= 0) {
          this.push(null);
          return;
        }
        const toSend = Math.min(remaining, chunk.length);
        remaining -= toSend;
        this.push(chunk.subarray(0, toSend));
      }
    });
  }
}

export const videoStreamService = new VideoStreamService();
export default videoStreamService;

import { Response } from 'express';
import s3Service from './s3.service.js';
import NotFound from '../shared/errors/NotFound.error.js';

export interface StreamOptions {
  rangeHeader?: string;
  s3Key: string;
  fileSizeBytes: number;
  mimeType?: string;
}

class VideoStreamService {
  // Streams a video from S3, honouring HTTP Range requests (206 Partial Content).
  async streamVideoChunk(res: Response, options: StreamOptions): Promise<void> {
    const { rangeHeader, s3Key, fileSizeBytes: totalSize } = options;
    const contentType = options.mimeType || 'video/mp4';

    if (!rangeHeader) {
      const s3 = await s3Service.getObjectStream(s3Key);
      if (!s3) throw new NotFound('This video is not available in storage.');
      res.writeHead(200, {
        'Content-Length': s3.contentLength || totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      s3.stream.pipe(res);
      return;
    }

    // e.g. "bytes=0-1048575" or "bytes=500-"
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    let start = match?.[1] ? parseInt(match[1], 10) : 0;
    let end = match?.[2] ? parseInt(match[2], 10) : totalSize - 1;
    if (end >= totalSize) end = totalSize - 1;
    if (!match || start > end || start >= totalSize) {
      res
        .status(416)
        .set({ 'Content-Range': `bytes */${totalSize}` })
        .send('Range Not Satisfiable');
      return;
    }

    const s3 = await s3Service.getObjectStream(s3Key, `bytes=${start}-${end}`);
    if (!s3) throw new NotFound('This video is not available in storage.');
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType
    });
    s3.stream.pipe(res);
  }
}

export const videoStreamService = new VideoStreamService();
export default videoStreamService;

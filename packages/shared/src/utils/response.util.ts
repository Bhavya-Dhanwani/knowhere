import { Response } from 'express';
import { ApiResponseEnvelope, ApiErrorEnvelope } from '../types/index.js';

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): Response {
  const envelope: ApiResponseEnvelope<T> = {
    success: true,
    data
  };
  return res.status(statusCode).json(envelope);
}

export function sendError(
  res: Response,
  error: { code: string; message: string; details?: unknown },
  statusCode: number = 500
): Response {
  const envelope: ApiErrorEnvelope = {
    success: false,
    error
  };
  return res.status(statusCode).json(envelope);
}

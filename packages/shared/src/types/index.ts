import { Request } from 'express';

export type UserRole = 'admin' | 'trainer' | 'trainee';

export interface AuthUser {
  userId: string;
  email?: string;
  role?: UserRole | string;
  name?: string;
  isVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface ApiResponseEnvelope<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

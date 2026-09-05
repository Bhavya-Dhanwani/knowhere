export * from './auth.types';
export * from './dashboard.types';
export * from './course.types';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: string;
}

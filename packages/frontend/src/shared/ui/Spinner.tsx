import React from 'react';
import { cn } from '../lib/cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-9 w-9 border-[3px]' };

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => (
  <div
    className={cn('flex items-center justify-center', className)}
    role="status"
    aria-label="Loading"
  >
    <span
      className={cn('animate-spin rounded-full border-brand-600 border-r-transparent', sizes[size])}
    />
  </div>
);

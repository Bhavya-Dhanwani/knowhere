import React from 'react';
import { cn } from '../lib/cn';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ orientation = 'horizontal', className }) =>
  orientation === 'vertical' ? (
    <div className={cn('w-px self-stretch bg-zinc-200/80', className)} role="separator" />
  ) : (
    <div className={cn('h-px w-full bg-zinc-100', className)} role="separator" />
  );

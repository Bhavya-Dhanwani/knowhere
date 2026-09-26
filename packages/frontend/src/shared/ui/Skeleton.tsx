import React from 'react';
import { cn } from '../lib/cn';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('relative overflow-hidden rounded-xl bg-zinc-100', className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </div>
);

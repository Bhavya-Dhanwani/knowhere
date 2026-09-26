import React from 'react';
import { cn } from '../lib/cn';

export interface ProgressBarProps {
  progress?: number;
  value?: number;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'blue' | 'indigo' | 'primary' | 'success';
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}

const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  value,
  height = 'md',
  showLabel = false,
  variant = 'blue',
  className,
  trackClassName,
  barClassName
}) => {
  const raw = value ?? progress ?? 0;
  const pct = Math.min(Math.max(raw, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-zinc-100',
          heights[height],
          trackClassName
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700 ease-out',
            variant === 'success'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-brand-500 to-brand-700',
            barClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span className="mt-1 inline-block text-xs font-medium tabular-nums text-zinc-500">
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
};

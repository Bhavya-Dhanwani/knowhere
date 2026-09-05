import React from 'react';

export interface ProgressBarProps {
  progress: number;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 'md',
  showLabel = false,
  className = ''
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5'
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`w-full bg-surface/80 rounded-full overflow-hidden border border-white/5 ${heights[height]}`}
      >
        <div
          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel ? (
        <span className="text-xs text-muted font-medium mt-1 inline-block">
          {Math.round(clampedProgress)}%
        </span>
      ) : null}
    </div>
  );
};

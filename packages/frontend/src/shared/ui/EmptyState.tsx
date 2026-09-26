import React from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-4 py-10 text-center sm:px-8 sm:py-14',
      className
    )}
  >
    {icon ? (
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
    ) : null}
    <h4 className="text-sm font-semibold text-zinc-900 sm:text-base">{title}</h4>
    {description ? (
      <p className="mt-1 max-w-sm text-pretty text-sm leading-relaxed text-zinc-500">
        {description}
      </p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';

interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  className
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
  >
    <div className="min-w-0">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-pretty text-sm text-zinc-500">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </motion.div>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon, className }) => (
  <div className={cn('min-w-0 rounded-2xl bg-white p-4 shadow-card sm:p-5', className)}>
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-[13px] text-zinc-500">{label}</p>
      {icon ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200/70 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
      ) : null}
    </div>
    <div className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-[28px]">
      {value}
    </div>
    {hint ? <div className="mt-1 truncate text-xs text-zinc-500">{hint}</div> : null}
  </div>
);

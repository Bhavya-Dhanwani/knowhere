import React from 'react';
import { cn } from '../lib/cn';

export interface BadgeProps {
  children: React.ReactNode;
  variant?:
    'blue' | 'gray' | 'green' | 'amber' | 'red' | 'outline-blue' | 'new' | 'completed' | 'dark';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variants = {
  blue: 'bg-brand-50 text-brand-700 ring-brand-200/70',
  new: 'bg-brand-50 text-brand-700 ring-brand-200/70',
  'outline-blue': 'bg-transparent text-brand-700 ring-brand-300',
  gray: 'bg-zinc-100 text-zinc-600 ring-zinc-200/80',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200/70',
  red: 'bg-red-50 text-red-700 ring-red-200/70',
  dark: 'bg-white/10 text-white ring-white/15'
};

const dots = {
  blue: 'bg-brand-500',
  new: 'bg-brand-500',
  'outline-blue': 'bg-brand-500',
  gray: 'bg-zinc-400',
  green: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  dark: 'bg-white'
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
  dot,
  className
}) => (
  <span
    className={cn(
      'inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
      variants[variant],
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      className
    )}
  >
    {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[variant])} /> : null}
    {children}
  </span>
);

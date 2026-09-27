import React from 'react';
import { cn } from '../lib/cn';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
  className?: string;
  showSubtitle?: boolean;
  iconOnly?: boolean;
}

const marks = {
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-8 w-8 rounded-[10px]',
  lg: 'h-10 w-10 rounded-xl'
};
const words = { sm: 'text-[15px]', md: 'text-[17px]', lg: 'text-xl' };

export const LogoMark: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn(
      'relative grid shrink-0 place-items-center bg-gradient-to-br from-zinc-600 via-zinc-900 to-black shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_12px_-4px_rgb(0_0_0/0.45)]',
      className
    )}
  >
    <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" aria-hidden>
      <path
        d="M7 4v16M7 12l9-8M9.5 10l7.5 10"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  theme = 'light',
  className,
  iconOnly = false
}) => (
  <span className={cn('inline-flex select-none items-center gap-2.5', className)}>
    <LogoMark className={marks[size]} />
    {iconOnly ? null : (
      <span
        className={cn(
          'font-semibold tracking-tight',
          words[size],
          theme === 'dark' ? 'text-white' : 'text-zinc-900'
        )}
      >
        knowhere
      </span>
    )}
  </span>
);

import React from 'react';
import { cn } from '../lib/cn';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'subtle' | 'outline';
}

const sizes = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-10 w-10' };

const variants = {
  ghost: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
  subtle: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
  outline: 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 shadow-xs'
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className,
  ...props
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      'inline-grid shrink-0 place-items-center rounded-xl transition active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-[18px] [&>svg]:w-[18px]',
      sizes[size],
      variants[variant],
      className
    )}
    {...props}
  >
    {icon}
  </button>
);

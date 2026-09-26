import React from 'react';
import { cn } from '../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark' | 'indigo' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variants = {
  primary: 'bg-ink text-white hover:bg-zinc-800 shadow-xs',
  brand:
    'bg-brand-600 text-white hover:bg-brand-500 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2),0_6px_20px_-6px_rgb(106_72_234/0.6)]',
  indigo: 'bg-brand-600 text-white hover:bg-brand-500 shadow-xs',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 ring-1 ring-inset ring-brand-200/70',
  outline:
    'bg-white text-zinc-800 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300 shadow-xs',
  ghost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-xs',
  dark: 'bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/15 backdrop-blur'
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      className={cn(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  )
);

Button.displayName = 'Button';

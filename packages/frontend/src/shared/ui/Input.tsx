import React from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  containerClassName?: string;
  label?: string;
  hint?: string;
  error?: string | null;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      icon,
      iconPosition = 'left',
      className,
      containerClassName,
      label,
      hint,
      error,
      trailing,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = id || autoId;
    const hasLeft = icon && iconPosition === 'left';
    const hasRight = (icon && iconPosition === 'right') || trailing;

    return (
      <div className={cn('w-full', containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-zinc-700">
            {label}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {hasLeft ? (
            <span className="pointer-events-none absolute left-3 text-zinc-400">{icon}</span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              'h-10 w-full min-w-0 rounded-xl bg-white text-sm text-zinc-900 shadow-xs ring-1 ring-inset ring-zinc-200 transition placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500',
              hasLeft ? 'pl-9' : 'pl-3.5',
              hasRight ? 'pr-10' : 'pr-3.5',
              error && 'ring-red-300 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {trailing ? (
            <span className="absolute right-1.5">{trailing}</span>
          ) : icon && iconPosition === 'right' ? (
            <span className="pointer-events-none absolute right-3 text-zinc-400">{icon}</span>
          ) : null}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

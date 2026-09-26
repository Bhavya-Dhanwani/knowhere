import React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '../lib/cn';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange'
> {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  icon,
  className,
  containerClassName,
  ...props
}) => (
  <div className={cn('relative inline-flex max-w-full items-center', containerClassName)}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-xl bg-white pl-3 pr-8 text-sm font-medium text-zinc-700 shadow-xs ring-1 ring-inset ring-zinc-200 transition hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand-500',
        className
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <span className="pointer-events-none absolute right-2.5 text-zinc-400">
      {icon || <ChevronsUpDown className="h-3.5 w-3.5" />}
    </span>
  </div>
);

import React from 'react';
import { cn } from '../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, hoverable = false, ...props }) => (
  <div
    className={cn(
      'rounded-2xl bg-white shadow-card transition-all duration-300',
      hoverable && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lift',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

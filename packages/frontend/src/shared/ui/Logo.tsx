import React from 'react';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'text-lg gap-1.5',
    md: 'text-2xl gap-2',
    lg: 'text-3xl gap-3'
  };

  return (
    <div
      className={`flex items-center font-bold tracking-tight text-white select-none ${sizeClasses[size]} ${className}`}
    >
      <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-black shadow-lg shadow-primary/20">
        K
      </div>
      <span>
        know<span className="text-primary">here</span>
      </span>
    </div>
  );
};

import React from 'react';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', theme = 'light', className = '' }) => {
  const sizeClasses = {
    sm: 'text-base gap-2',
    md: 'text-xl gap-2.5',
    lg: 'text-2xl gap-3'
  };

  const isLight = theme === 'light';

  return (
    <div
      className={`flex items-center font-bold tracking-tight select-none ${
        isLight ? 'text-zinc-900' : 'text-white'
      } ${sizeClasses[size]} ${className}`}
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-sm shadow-blue-500/20 text-sm">
        K
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-extrabold tracking-tight">
          know<span className="text-blue-600">here</span>
        </span>
      </div>
    </div>
  );
};

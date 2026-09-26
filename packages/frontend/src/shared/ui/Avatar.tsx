import React, { useState } from 'react';
import { cn } from '../lib/cn';

export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg'
};

// deterministic gradient per name so initials avatars stay distinguishable
const gradients = [
  'from-brand-400 to-brand-700',
  'from-sky-400 to-cyan-700',
  'from-emerald-400 to-teal-700',
  'from-amber-400 to-orange-600',
  'from-rose-400 to-pink-700',
  'from-fuchsia-400 to-purple-700'
];

export function initialsOf(name?: string) {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className }) => {
  const [failed, setFailed] = useState(false);
  const hash = Array.from(name || 'U').reduce((a, c) => a + c.charCodeAt(0), 0);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white',
        gradients[hash % gradients.length],
        sizes[size],
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};

import React from 'react';
import { cn } from '../lib/cn';

const palettes = [
  ['#7d66f5', '#3e2a86', '#c4b5fd'],
  ['#0ea5e9', '#1e3a8a', '#7dd3fc'],
  ['#10b981', '#064e3b', '#6ee7b7'],
  ['#f59e0b', '#7c2d12', '#fcd34d'],
  ['#ec4899', '#581c87', '#f9a8d4'],
  ['#14b8a6', '#134e4a', '#99f6e4']
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Deterministic generative cover for a course, so every course looks distinct without uploads.
export const CourseCover: React.FC<{ seed: string; title?: string; className?: string }> = ({
  seed,
  title,
  className
}) => {
  const h = hash(seed || 'course');
  const [a, b, c] = palettes[h % palettes.length];
  const variant = h % 3;
  const initials = (title || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-40"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 200 120"
      >
        {variant === 0 &&
          Array.from({ length: 7 }).map((_, i) => (
            <circle
              key={i}
              cx={170}
              cy={110}
              r={20 + i * 22}
              fill="none"
              stroke={c}
              strokeWidth="0.8"
            />
          ))}
        {variant === 1 &&
          Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1={i * 20 - 40}
              y1={120}
              x2={i * 20 + 40}
              y2={0}
              stroke={c}
              strokeWidth="0.8"
            />
          ))}
        {variant === 2 &&
          Array.from({ length: 6 }).map((_, r) =>
            Array.from({ length: 10 }).map((__, col) => (
              <circle key={`${r}-${col}`} cx={10 + col * 20} cy={10 + r * 20} r={1.6} fill={c} />
            ))
          )}
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.35),transparent_55%)]" />
      {initials ? (
        <span className="absolute bottom-3 left-3.5 font-serif text-3xl italic text-white/90 drop-shadow-sm">
          {initials}
        </span>
      ) : null}
    </div>
  );
};

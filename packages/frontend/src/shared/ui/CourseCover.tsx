import React from 'react';
import { cn } from '../lib/cn';

// monochrome covers: graphite tones that sit quietly on the off-white UI
const palettes = [
  ['#27272a', '#09090b', '#52525b'],
  ['#3f3f46', '#18181b', '#71717a'],
  ['#1c1917', '#0c0a09', '#57534e'],
  ['#404040', '#171717', '#737373'],
  ['#292524', '#0c0a09', '#78716c'],
  ['#52525b', '#27272a', '#a1a1aa']
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

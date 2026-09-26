import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useInView } from 'motion/react';
import { cn } from '../../lib/cn';

// Metallic sweep across text (React Bits "ShinyText").
export const ShinyText: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className
}) => (
  <span
    className={cn(
      'animate-shine bg-[linear-gradient(110deg,rgba(255,255,255,0.55)_35%,#fff_50%,rgba(255,255,255,0.55)_65%)] bg-[length:200%_100%] bg-clip-text text-transparent',
      className
    )}
  >
    {children}
  </span>
);

// Slowly panning multi-stop gradient text (React Bits "GradientText").
export const GradientText: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className
}) => (
  <span
    className={cn(
      'animate-gradient-pan bg-[linear-gradient(90deg,#b8acff,#7d66f5,#f0abfc,#7dd3fc,#b8acff)] bg-[length:300%_100%] bg-clip-text text-transparent',
      className
    )}
  >
    {children}
  </span>
);

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

// Eases a number up once it enters the viewport (React Bits "CountUp").
export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1.6,
  decimals = 0,
  prefix = '',
  suffix = '',
  className
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setValue
    });
    return () => controls.stop();
  }, [inView, from, to, duration]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}
      {suffix}
    </span>
  );
};

// Cycles through words with a vertical slide (React Bits "RotatingText").
export const RotatingText: React.FC<{
  words: string[];
  interval?: number;
  className?: string;
}> = ({ words, interval = 2400, className }) => {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  return (
    <span className={cn('relative inline-grid overflow-hidden align-bottom', className)}>
      {/* invisible longest word reserves width so surrounding text never jumps */}
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {words.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[i]}
          className="col-start-1 row-start-1"
          initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '../../lib/cn';

// Card with a cursor-following radial light (React Bits "SpotlightCard").
export const SpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlight?: string;
}> = ({ children, className, spotlight = 'rgba(125, 102, 245, 0.18)' }) => {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const bg = useMotionTemplate`radial-gradient(420px circle at ${x}px ${y}px, ${spotlight}, transparent 70%)`;

  return (
    <div
      className={cn('group relative overflow-hidden', className)}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onPointerLeave={() => {
        x.set(-400);
        y.set(-400);
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: bg }}
      />
      {children}
    </div>
  );
};

// Element that drifts toward the cursor while hovered (React Bits "Magnet").
export const Magnet: React.FC<{
  children: React.ReactNode;
  strength?: number;
  className?: string;
}> = ({ children, strength = 0.3, className }) => {
  const x = useSpring(0, { stiffness: 220, damping: 18 });
  const y = useSpring(0, { stiffness: 220, damping: 18 });

  return (
    <motion.div
      className={cn('inline-block', className)}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
};

// 3D tilt that follows the pointer (React Bits "TiltedCard").
export const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  max?: number;
}> = ({ children, className, max = 8 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 160, damping: 20 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 160, damping: 20 });

  return (
    <div style={{ perspective: 1400 }} className={className}>
      <motion.div
        ref={ref}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// Fades/slides children in once when scrolled into view (React Bits "AnimatedContent").
export const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}> = ({ children, className, delay = 0, y = 24 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y, filter: 'blur(6px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

// Infinite horizontal loop (React Bits "LogoLoop"). Content is duplicated for a seamless wrap.
export const Marquee: React.FC<{
  children: React.ReactNode;
  className?: string;
  duration?: number;
  reverse?: boolean;
}> = ({ children, className, duration = 40, reverse = false }) => (
  <div className={cn('mask-fade-x group flex overflow-hidden', className)}>
    <div
      className="flex w-max shrink-0 animate-marquee items-center group-hover:[animation-play-state:paused]"
      style={
        {
          '--marquee-duration': `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal'
        } as React.CSSProperties
      }
    >
      <div className="flex shrink-0 items-center">{children}</div>
      <div className="flex shrink-0 items-center" aria-hidden>
        {children}
      </div>
    </div>
  </div>
);

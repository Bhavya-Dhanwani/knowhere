import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';

// Drifting blurred colour fields (a CSS take on React Bits "Aurora" — no WebGL needed).
export const Aurora: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden
    className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
  >
    <div className="absolute -left-[10%] -top-[30%] h-[70vmax] w-[70vmax] animate-[aurora-a_18s_ease-in-out_infinite] rounded-full bg-[radial-gradient(closest-side,rgba(125,102,245,0.55),transparent)] blur-3xl" />
    <div className="absolute -right-[15%] -top-[20%] h-[60vmax] w-[60vmax] animate-[aurora-b_22s_ease-in-out_infinite] rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.32),transparent)] blur-3xl" />
    <div className="absolute left-[25%] top-[10%] h-[45vmax] w-[45vmax] animate-[aurora-c_26s_ease-in-out_infinite] rounded-full bg-[radial-gradient(closest-side,rgba(232,121,249,0.28),transparent)] blur-3xl" />
    <style>{`
      @keyframes aurora-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(8%,6%) scale(1.1) } }
      @keyframes aurora-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-10%,8%) scale(0.92) } }
      @keyframes aurora-c { 0%,100% { transform: translate(0,0) scale(0.9) } 50% { transform: translate(-6%,-4%) scale(1.15) } }
    `}</style>
  </div>
);

interface ParticlesProps {
  className?: string;
  density?: number;
  color?: string;
  linkDistance?: number;
}

// Constellation particles on canvas (React Bits "Particles"). Pauses off-screen and
// renders a single static frame when the user prefers reduced motion.
export const Particles: React.FC<ParticlesProps> = ({
  className,
  density = 0.00009,
  color = '200, 190, 255',
  linkDistance = 120
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };
    let pts: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(18, Math.min(110, Math.floor(w * h * density)));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.4
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < 110 && d > 0) {
          p.x += (dx / d) * 0.8;
          p.y += (dy / d) * 0.8;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, 0.75)`;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < linkDistance) {
            ctx.strokeStyle = `rgba(${color}, ${0.14 * (1 - d / linkDistance)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    const loop = () => {
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduced) draw();
    else raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, [density, color, linkDistance]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
};

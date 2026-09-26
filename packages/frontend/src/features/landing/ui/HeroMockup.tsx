import React from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  CheckCircle2,
  Flame,
  LayoutDashboard,
  MessagesSquare,
  Sparkles,
  Trophy
} from 'lucide-react';
import { LogoMark } from '../../../shared/ui/Logo';

// A stylised, non-interactive preview of the student dashboard used in the hero.
const bars = [62, 88, 41];
const heat = Array.from({ length: 16 * 7 }, (_, i) => {
  const v = Math.sin(i * 1.7) * Math.cos(i * 0.37) + (i / 112) * 1.4;
  return v > 1.1 ? 4 : v > 0.7 ? 3 : v > 0.35 ? 2 : v > 0 ? 1 : 0;
});
const heatColor = [
  'bg-white/[0.06]',
  'bg-brand-900',
  'bg-brand-700',
  'bg-brand-500',
  'bg-brand-300'
];

export const HeroMockup: React.FC = () => (
  <div className="relative rounded-[20px] border border-white/10 bg-white/[0.03] p-1.5 shadow-[0_40px_120px_-30px_rgba(106,72,234,0.55)] backdrop-blur-sm sm:rounded-[28px] sm:p-2.5">
    <div className="overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0d14] sm:rounded-[20px]">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2.5 sm:px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="mx-auto hidden rounded-md bg-white/5 px-10 py-1 font-mono text-[10px] text-zinc-500 sm:block">
          app.knowhere.dev/dashboard
        </span>
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-white/5 p-3 md:flex">
          <div className="mb-3 flex items-center gap-2 px-1">
            <LogoMark className="h-6 w-6 rounded-md" />
            <span className="text-xs font-semibold text-white">knowhere</span>
          </div>
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: BookOpen, label: 'My courses' },
            { icon: MessagesSquare, label: 'Community' },
            { icon: Sparkles, label: 'Reviews' }
          ].map((i) => (
            <div
              key={i.label}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                i.active ? 'bg-white/[0.07] text-white' : 'text-zinc-500'
              }`}
            >
              <i.icon className={`h-3.5 w-3.5 ${i.active ? 'text-brand-300' : ''}`} />
              {i.label}
            </div>
          ))}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1 space-y-3 p-3 sm:p-5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500 sm:text-[10px]">
              Thursday
            </p>
            <p className="text-sm font-semibold text-white sm:text-lg">Good evening, Alex</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Progress', value: '72%', icon: CheckCircle2 },
              { label: 'Streak', value: '12d', icon: Flame },
              { label: 'Points', value: '4,280', icon: Trophy },
              { label: 'Rank', value: '#3', icon: Sparkles }
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.08 }}
                className={`rounded-xl border border-white/5 bg-white/[0.03] p-2 sm:p-3 ${i > 1 ? 'hidden sm:block' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-zinc-500 sm:text-[10px]">{s.label}</span>
                  <s.icon className="h-3 w-3 text-zinc-600" />
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums text-white sm:text-base">
                  {s.value}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-3">
              {['Distributed Systems', 'React Deep Dive', 'DSA Bootcamp'].map((t, i) => (
                <div
                  key={t}
                  className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-2 sm:p-2.5"
                >
                  <span
                    className="h-7 w-10 shrink-0 rounded-md sm:h-8 sm:w-12"
                    style={{
                      background: [
                        'linear-gradient(135deg,#7d66f5,#3e2a86)',
                        'linear-gradient(135deg,#0ea5e9,#1e3a8a)',
                        'linear-gradient(135deg,#10b981,#064e3b)'
                      ][i]
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium text-zinc-200 sm:text-xs">{t}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${bars[i]}%` }}
                        transition={{
                          delay: 1.2 + i * 0.15,
                          duration: 1.2,
                          ease: [0.22, 1, 0.36, 1]
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] tabular-nums text-zinc-500">{bars[i]}%</span>
                </div>
              ))}
            </div>
            <div className="hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 lg:col-span-2 lg:block">
              <p className="text-[10px] text-zinc-500">Activity</p>
              <div className="mt-2 grid grid-flow-col grid-rows-7 gap-[3px]">
                {heat.map((l, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + i * 0.004 }}
                    className={`aspect-square rounded-[2px] ${heatColor[l]}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* floating chips */}
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.6, type: 'spring' }}
      className="absolute -left-4 top-1/3 hidden animate-float items-center gap-2 rounded-xl border border-white/10 bg-night/80 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl lg:flex"
    >
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
      All 12 test cases passed
    </motion.div>
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.9, type: 'spring' }}
      className="absolute -right-4 bottom-10 hidden animate-float items-center gap-2 rounded-xl border border-white/10 bg-night/80 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl [animation-delay:1.5s] lg:flex"
    >
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/20 text-brand-300">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      AI review: 8.6 / 10
    </motion.div>
  </div>
);

import React from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Quote } from 'lucide-react';
import { Logo } from '../../../shared/ui/Logo';
import { Aurora, Particles, ShinyText } from '../../../shared/ui/fx';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const highlights = [
  'Structured cohorts with modules that unlock on schedule',
  'Coding challenges and MCQs graded instantly',
  'AI project reviews with rubric-level feedback'
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children, footer }) => (
  <div className="flex min-h-[100dvh] bg-white">
    {/* Brand panel — desktop only */}
    <aside className="relative hidden w-[46%] max-w-[720px] overflow-hidden bg-night text-white lg:flex lg:flex-col">
      <Aurora className="opacity-70" />
      <Particles density={0.00006} />
      <div className="grid-bg mask-radial absolute inset-0" />
      <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
        <Link to="/" aria-label="Knowhere home">
          <Logo theme="dark" />
        </Link>

        <div className="max-w-md">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-balance text-4xl font-medium leading-[1.1] tracking-tight xl:text-5xl"
          >
            The classroom that <span className="font-serif italic text-brand-300">ships</span>{' '}
            <ShinyText>with you.</ShinyText>
          </motion.h2>
          <ul className="mt-8 space-y-3">
            {highlights.map((h, i) => (
              <motion.li
                key={h}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
                className="flex items-start gap-3 text-sm text-zinc-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 shadow-[0_0_12px_2px] shadow-brand-500/60" />
                {h}
              </motion.li>
            ))}
          </ul>
        </div>

        <figure className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
          <Quote className="h-4 w-4 text-brand-300" />
          <blockquote className="mt-3 text-sm leading-relaxed text-zinc-300">
            Deadlines, practice and feedback in one place — my cohort finally stopped juggling five
            tools.
          </blockquote>
          <figcaption className="mt-3 text-xs text-zinc-500">
            Cohort lead, Full-stack bootcamp
          </figcaption>
        </figure>
      </div>
    </aside>

    {/* Form column */}
    <main className="relative flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link to="/" className="lg:hidden" aria-label="Knowhere home">
          <Logo size="sm" />
        </Link>
        <Link
          to="/"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden xs:inline">Back to site</span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-8 text-center text-sm text-zinc-500">{footer}</div> : null}
        </motion.div>
      </div>
    </main>
  </div>
);

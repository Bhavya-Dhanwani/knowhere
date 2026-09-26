import { Link } from 'react-router';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Github, Sparkles } from 'lucide-react';
import {
  Aurora,
  BlurText,
  CountUp,
  GradientText,
  Magnet,
  Marquee,
  Particles,
  Reveal,
  RotatingText,
  ShinyText,
  SplitText,
  TiltCard
} from '../../../shared/ui/fx';
import { Logo } from '../../../shared/ui/Logo';
import { LandingNav } from './LandingNav';
import { HeroMockup } from './HeroMockup';
import { FeatureBento, RoleTabs, SectionHeading, Steps } from './LandingSections';

const stack = [
  'Kubernetes',
  'MongoDB',
  'Redis',
  'Socket.IO',
  'Mistral AI',
  'AWS S3',
  'MediaConvert',
  'CloudFront',
  'Express',
  'React',
  'TanStack Query',
  'Skaffold'
];

const stats = [
  { to: 9, suffix: '', label: 'independent microservices' },
  { to: 4, suffix: '', label: 'content types per lesson' },
  { to: 3, suffix: '', label: 'role-aware workspaces' },
  { to: 100, suffix: '%', label: 'open API, documented' }
];

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60]);
  const heroFade = useTransform(scrollYProgress, [0, 0.2], [1, 0.4]);

  return (
    <div className="min-h-screen overflow-x-clip bg-night text-white">
      <LandingNav />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-40">
        <Aurora className="opacity-80" />
        <Particles />
        <div className="grid-bg mask-radial absolute inset-0 -z-10" />
        <div className="noise pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay" />

        <motion.div
          style={{ y: heroY, opacity: heroFade }}
          className="relative mx-auto max-w-5xl text-center"
        >
          <motion.a
            href="#features"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="group mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-xs backdrop-blur-md transition hover:border-white/20 sm:text-sm"
          >
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-medium">
              <Sparkles className="h-3 w-3" /> New
            </span>
            <ShinyText className="truncate">AI-reviewed projects are live</ShinyText>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
          </motion.a>

          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[2.1rem] font-medium leading-[1.02] tracking-[-0.035em] xs:text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            <SplitText text="The learning platform" delay={0.15} />{' '}
            <span className="whitespace-nowrap">
              <SplitText text="for cohorts" delay={0.55} />
            </span>
            <br className="hidden xs:block" />{' '}
            <span className="font-serif font-normal italic tracking-normal">
              <span className="text-zinc-500">that </span>
              <GradientText>
                <RotatingText words={['ship.', 'build.', 'code.', 'grow.']} />
              </GradientText>
            </span>
          </h1>

          <BlurText
            text="Courses, coding practice, AI project reviews and real-time community — one calm, fast workspace for students, trainers and admins."
            delay={0.9}
            className="mx-auto mt-6 max-w-2xl text-pretty text-[15px] leading-relaxed text-zinc-400 sm:text-lg"
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.6 }}
            className="mt-9 flex flex-col items-stretch justify-center gap-3 xs:flex-row xs:items-center"
          >
            <Magnet>
              <Link
                to="/signup"
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-6 text-[15px] font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_40px_-10px_rgba(125,102,245,0.8)] transition hover:bg-zinc-100 xs:w-auto"
              >
                Start for free
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </Magnet>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-[15px] text-zinc-200 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              Try the live demo
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.8, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformPerspective: 1600 }}
          className="relative mx-auto mt-16 max-w-5xl sm:mt-20"
        >
          <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-[radial-gradient(closest-side,rgba(125,102,245,0.35),transparent)] blur-2xl" />
          <TiltCard max={5}>
            <HeroMockup />
          </TiltCard>
        </motion.div>
      </section>

      {/* ----------------------------------------------------------- marquee */}
      <section className="border-y border-white/5 py-8">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.18em] text-zinc-500">
          Built on a production-grade stack
        </p>
        <Marquee duration={45}>
          {stack.map((s) => (
            <span
              key={s}
              className="mx-3 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 sm:mx-4"
            >
              {s}
            </span>
          ))}
        </Marquee>
      </section>

      {/* ------------------------------------------------------------- stats */}
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 xs:grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="bg-night p-6 sm:p-8">
              <p className="text-4xl font-medium tracking-tight text-white sm:text-5xl">
                <CountUp to={s.to} suffix={s.suffix} />
              </p>
              <p className="mt-2 text-sm text-zinc-500">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section id="features" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Features"
            title={
              <>
                Everything a cohort needs.{' '}
                <span className="font-serif italic text-zinc-400">Nothing it doesn&apos;t.</span>
              </>
            }
            body="Knowhere replaces the patchwork of video hosts, quiz tools, judges, chat apps and spreadsheets with one coherent product."
          />
          <FeatureBento />
        </div>
      </section>

      {/* ------------------------------------------------------------- roles */}
      <section id="roles" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="For every role"
          title="Three workspaces. One platform."
          body="Everyone signs in to the same app and lands in a workspace designed for what they actually do."
        />
        <RoleTabs />
      </section>

      {/* -------------------------------------------------------------- how */}
      <section id="how" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow="How it works" title="From syllabus to shipped project" />
          <Steps />
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="px-4 pb-20 pt-8 sm:px-6 sm:pb-28">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 px-5 py-16 text-center sm:px-12 sm:py-24">
          <Aurora />
          <div className="grid-bg mask-radial absolute inset-0" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-medium tracking-tight xs:text-4xl sm:text-6xl">
              Your next cohort starts{' '}
              <span className="font-serif italic text-brand-300">here.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-zinc-400 sm:text-base">
              Create an account in seconds. No credit card, no setup call.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Magnet className="block sm:inline-block">
                <Link
                  to="/signup"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-medium text-zinc-900 transition hover:bg-zinc-100 whitespace-nowrap sm:w-auto"
                >
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
              </Magnet>
              <Link
                to="/docs"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-[15px] text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Read the API docs
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="border-t border-white/5 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Logo theme="dark" size="sm" />
            <p className="text-xs text-zinc-500">
              © {new Date().getFullYear()} Knowhere. Learn by building.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#roles" className="hover:text-white">
              For teams
            </a>
            <Link to="/docs" className="hover:text-white">
              API
            </Link>
            <Link to="/login" className="hover:text-white">
              Sign in
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

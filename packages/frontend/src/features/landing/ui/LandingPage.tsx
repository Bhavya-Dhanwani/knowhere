import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Code2,
  LockKeyhole,
  Menu,
  MessagesSquare,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { RootState } from '../../../app/store';
import { homePathFor, roleOf } from '../../../shared/lib/roles';
import { Logo } from '../../../shared/ui/Logo';
import AnimatedContent from '../../../shared/ui/reactbits/AnimatedContent';
import BlurText from '../../../shared/ui/reactbits/BlurText';
import CircularText from '../../../shared/ui/reactbits/CircularText';
import ClickSpark from '../../../shared/ui/reactbits/ClickSpark';
import CountUp from '../../../shared/ui/reactbits/CountUp';
import DecryptedText from '../../../shared/ui/reactbits/DecryptedText';
import DotGrid from '../../../shared/ui/reactbits/DotGrid';
import LogoLoop from '../../../shared/ui/reactbits/LogoLoop';
import Magnet from '../../../shared/ui/reactbits/Magnet';
import RotatingText from '../../../shared/ui/reactbits/RotatingText';
import ScrollFloat from '../../../shared/ui/reactbits/ScrollFloat';
import ScrollVelocity from '../../../shared/ui/reactbits/ScrollVelocity';
import ShinyText from '../../../shared/ui/reactbits/ShinyText';
import SplitText from '../../../shared/ui/reactbits/SplitText';
import SpotlightCard from '../../../shared/ui/reactbits/SpotlightCard';
import StarBorder from '../../../shared/ui/reactbits/StarBorder';
import Threads from '../../../shared/ui/reactbits/Threads';
import TrueFocus from '../../../shared/ui/reactbits/TrueFocus';

// Everything below describes what the product actually does; no invented customers or metrics.
const FEATURES = [
  {
    icon: CalendarClock,
    title: 'Cohorts on a real schedule',
    body: 'Modules unlock on dates, every learner gets a deadline window, and late joiners catch up on their own clock.',
    tag: 'SCHEDULING',
    span: 'md:col-span-2'
  },
  {
    icon: Code2,
    title: 'Code, judged honestly',
    body: 'JavaScript, Python, C++ and Java graded on the server against 100 hidden tests, each run in its own sandbox.',
    tag: 'JUDGE',
    span: ''
  },
  {
    icon: LockKeyhole,
    title: 'Video that stays yours',
    body: 'Uploads become AES-128 encrypted streams. Keys only reach enrolled learners, and every frame carries a watermark.',
    tag: 'ENCRYPTED',
    span: ''
  },
  {
    icon: MessagesSquare,
    title: 'A community per course',
    body: 'Channels, threads, mentions, files and live voice rooms, open only to the people in the cohort.',
    tag: 'REALTIME',
    span: 'md:col-span-2'
  },
  {
    icon: Sparkles,
    title: 'AI project reviews',
    body: 'Submissions are analysed, scored against a rubric and ranked, with the evidence behind every point.',
    tag: 'AI',
    span: 'md:col-span-2'
  },
  {
    icon: Users,
    title: 'One app, three roles',
    body: 'Students learn, trainers author bottom-up from a shared library, admins run enrollment and people.',
    tag: 'ROLES',
    span: ''
  }
];

const FACTS = [
  { to: 4, suffix: '', label: 'languages judged in a sandbox' },
  { to: 100, suffix: '', label: 'hidden tests per coding problem' },
  { to: 128, suffix: '-bit', label: 'AES encryption on every video' },
  { to: 280, suffix: 'px', label: 'the smallest screen it fits' }
];

const STEPS = [
  {
    n: '01',
    title: 'Build the library',
    body: 'Upload videos and files, write MCQs and coding problems once.'
  },
  {
    n: '02',
    title: 'Compose the course',
    body: 'Bundle items into lessons, lessons into modules, then schedule them.'
  },
  {
    n: '03',
    title: 'Run the cohort',
    body: 'Enroll people, watch progress, grade, and talk in the community.'
  }
];

const STACK = [
  'React',
  'Node.js',
  'MongoDB',
  'Redis',
  'Socket.IO',
  'LiveKit',
  'Kubernetes',
  'ffmpeg',
  'Mistral',
  'S3'
];

function useSignedInHome() {
  const user = useSelector((s: RootState) => s.auth.user);
  return user ? homePathFor(roleOf(user)) : null;
}

const Nav: React.FC = () => {
  const home = useSignedInHome();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const links = [
    ['Product', '#product'],
    ['How it works', '#how'],
    ['API', '/docs']
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-zinc-200/70 bg-white/75 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Knowhere home" className="shrink-0">
          <Logo size="sm" />
        </Link>
        <nav className="ml-6 hidden items-center gap-6 text-sm text-zinc-500 md:flex">
          {links.map(([label, href]) => (
            <a key={label} href={href} className="transition hover:text-zinc-900">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {home ? (
            <Link
              to={home}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm text-zinc-600 transition hover:text-zinc-900"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-full text-zinc-700 sm:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-zinc-100 bg-white px-4 pb-4 pt-2 sm:hidden">
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-zinc-700"
            >
              {label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-1 gap-2 xs:grid-cols-2">
            <Link
              to={home || '/login'}
              className="rounded-full border border-zinc-200 px-4 py-2.5 text-center text-sm"
            >
              {home ? 'Dashboard' : 'Sign in'}
            </Link>
            {!home ? (
              <Link
                to="/signup"
                className="rounded-full bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Get started
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
};

export function LandingPage() {
  const home = useSignedInHome();

  return (
    <ClickSpark sparkColor="#0a0a0a" sparkRadius={22} sparkCount={9}>
      <div className="min-h-screen overflow-x-clip bg-white text-zinc-900 selection:bg-zinc-200">
        <Nav />

        {/* ---------------------------------------------------------------- hero */}
        <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden px-4 pb-16 pt-28 sm:px-6">
          <div className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]">
            <DotGrid
              dotSize={3}
              gap={22}
              baseColor="#e4e4e7"
              activeColor="#0a0a0a"
              proximity={130}
              shockRadius={220}
              shockStrength={4}
              resistance={750}
              returnDuration={1.4}
            />
          </div>

          <div className="mx-auto w-full max-w-6xl">
            <motion.a
              href="#product"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white/80 py-1 pl-1 pr-3 text-xs text-zinc-600 backdrop-blur"
            >
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                New
              </span>
              <ShinyText
                text="Voice rooms and a 4-language code judge"
                speed={3}
                className="truncate"
              />
            </motion.a>

            <h1 className="mt-7 max-w-5xl text-[clamp(2.4rem,9vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
              <SplitText
                text="The classroom"
                tag="span"
                className="block"
                splitType="chars"
                delay={35}
                duration={0.9}
                from={{ opacity: 0, y: 60 }}
                to={{ opacity: 1, y: 0 }}
                textAlign="left"
              />
              <span className="flex flex-wrap items-baseline gap-x-[0.25em]">
                <SplitText
                  text="that"
                  tag="span"
                  splitType="chars"
                  delay={35}
                  duration={0.9}
                  from={{ opacity: 0, y: 60 }}
                  to={{ opacity: 1, y: 0 }}
                />
                <RotatingText
                  texts={['ships.', 'grades.', 'listens.', 'scales.']}
                  mainClassName="overflow-hidden font-serif italic font-normal tracking-normal text-zinc-900"
                  staggerFrom="last"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '-120%' }}
                  staggerDuration={0.025}
                  splitLevelClassName="overflow-hidden pb-[0.12em]"
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                  rotationInterval={2200}
                />
              </span>
            </h1>

            <div className="mt-8 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
              <BlurText
                text="Courses on a real schedule, code graded in a sandbox, encrypted video and a live community for every cohort, in one calm workspace."
                delay={40}
                animateBy="words"
                direction="bottom"
                className="max-w-xl text-pretty text-base leading-relaxed text-zinc-500 sm:text-lg"
              />
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Magnet padding={60} magnetStrength={4}>
                  <Link
                    to={home || '/signup'}
                    className="group inline-flex h-12 items-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-700"
                  >
                    {home ? 'Open your dashboard' : 'Start for free'}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </Magnet>
                <a
                  href="#product"
                  className="inline-flex h-12 items-center px-3 text-sm text-zinc-600 transition hover:text-zinc-900"
                >
                  See the product
                </a>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-8 right-6 hidden text-zinc-400 lg:block">
            <CircularText
              text="LEARN • BUILD • SHIP • REPEAT • "
              spinDuration={24}
              onHover="speedUp"
              className="!h-[130px] !w-[130px] text-zinc-500"
            />
          </div>
        </section>

        {/* ----------------------------------------------------------- stack loop */}
        <section className="border-y border-zinc-100 py-8">
          <p className="mb-5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Built on
          </p>
          <LogoLoop
            logos={STACK.map((name) => ({
              node: (
                <span className="text-lg font-medium tracking-tight text-zinc-400 transition hover:text-zinc-900">
                  {name}
                </span>
              ),
              title: name
            }))}
            speed={60}
            direction="left"
            logoHeight={28}
            gap={56}
            pauseOnHover
            scaleOnHover
            fadeOut
            fadeOutColor="#ffffff"
            ariaLabel="Technologies Knowhere is built on"
          />
        </section>

        {/* ------------------------------------------------------------ features */}
        <section id="product" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">
            The product
          </p>
          <ScrollFloat
            containerClassName="!my-3"
            textClassName="!text-[clamp(2rem,6vw,4.5rem)] !font-semibold !leading-[1] !tracking-[-0.04em] text-zinc-900"
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.02}
          >
            Everything a cohort needs.
          </ScrollFloat>
          <p className="max-w-lg text-zinc-500">
            No patchwork of video hosts, quiz tools, judges and chat apps. One product, built for
            how bootcamps actually run.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <AnimatedContent
                key={f.title}
                distance={50}
                delay={i * 0.06}
                duration={0.8}
                className={f.span}
              >
                <SpotlightCard
                  className="group h-full !rounded-3xl !border-zinc-200 !bg-zinc-50/70 !p-7"
                  spotlightColor="rgba(0, 0, 0, 0.06)"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200">
                      <f.icon className="h-5 w-5" />
                    </span>
                    <DecryptedText
                      text={f.tag}
                      animateOn="hover"
                      speed={40}
                      className="font-mono text-[11px] tracking-[0.18em] text-zinc-400"
                      encryptedClassName="font-mono text-[11px] tracking-[0.18em] text-brand-500"
                    />
                  </div>
                  <h3 className="mt-10 text-xl font-semibold tracking-tight text-zinc-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.body}</p>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------------- velocity */}
        <section className="overflow-hidden border-y border-zinc-100 py-10 text-zinc-900">
          <ScrollVelocity
            texts={[
              'Courses — Quizzes — Code — Video — Voice — ',
              'Learn — Build — Ship — Review — Repeat — '
            ]}
            velocity={60}
            className="px-4 text-[clamp(2rem,7vw,5.5rem)] font-semibold tracking-[-0.04em] text-zinc-900 [&:nth-child(2)]:text-zinc-300"
          />
        </section>

        {/* -------------------------------------------------------------- facts */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-200 xs:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label} className="bg-white p-7 sm:p-8">
                <p className="text-5xl font-semibold tabular-nums tracking-[-0.04em] text-zinc-900 sm:text-6xl">
                  <CountUp to={f.to} duration={1.6} />
                  <span className="text-zinc-300">{f.suffix}</span>
                </p>
                <p className="mt-3 text-sm text-zinc-500">{f.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------------- steps */}
        <section id="how" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mb-14 flex justify-center text-[clamp(1.6rem,5vw,3.25rem)] font-semibold tracking-[-0.03em]">
            <TrueFocus
              sentence="Build Compose Run"
              manualMode={false}
              blurAmount={4}
              borderColor="#0a0a0a"
              glowColor="rgba(0,0,0,0.25)"
              animationDuration={0.6}
              pauseBetweenAnimations={1.2}
            />
          </div>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <AnimatedContent key={s.n} distance={40} delay={i * 0.12} duration={0.8}>
                <li className="h-full rounded-3xl border border-zinc-200 p-7">
                  <span className="font-mono text-sm text-brand-600">{s.n}</span>
                  <h3 className="mt-8 text-2xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{s.body}</p>
                </li>
              </AnimatedContent>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- cta */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-zinc-50 ring-1 ring-zinc-200">
            <div className="pointer-events-auto absolute inset-x-0 bottom-0 h-1/2 opacity-60 [mask-image:linear-gradient(to_top,black_40%,transparent)]">
              <Threads
                color={[0.1, 0.1, 0.1]}
                amplitude={1.1}
                distance={0.15}
                enableMouseInteraction
              />
            </div>
            <div className="relative flex flex-col items-center px-6 py-20 text-center sm:py-28">
              <h2 className="max-w-3xl text-balance text-[clamp(2rem,6vw,4rem)] font-semibold leading-[1] tracking-[-0.04em]">
                Run your next cohort <span className="font-serif font-normal italic">on</span>{' '}
                Knowhere.
              </h2>
              <p className="mt-5 max-w-md text-zinc-500">
                Create an account, build a course from the library, and invite your first learners.
              </p>
              <StarBorder
                as={Link}
                to={home || '/signup'}
                color="#0a0a0a"
                speed="5s"
                className="mt-9"
                backgroundColor="#0a0a0f"
                textColor="#ffffff"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  {home ? 'Open your dashboard' : 'Get started, it’s free'}{' '}
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </StarBorder>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- footer */}
        <footer className="border-t border-zinc-100 px-4 pt-16 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:justify-between">
            <div>
              <Logo size="sm" />
              <p className="mt-3 max-w-xs text-sm text-zinc-500">
                Learning, practice and community for cohorts that ship.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 text-sm">
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  Product
                </p>
                <a href="#product" className="block text-zinc-600 hover:text-zinc-900">
                  Features
                </a>
                <a href="#how" className="block text-zinc-600 hover:text-zinc-900">
                  How it works
                </a>
                <a href="/docs" className="block text-zinc-600 hover:text-zinc-900">
                  API reference
                </a>
              </div>
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  Account
                </p>
                <Link to="/login" className="block text-zinc-600 hover:text-zinc-900">
                  Sign in
                </Link>
                <Link to="/signup" className="block text-zinc-600 hover:text-zinc-900">
                  Create account
                </Link>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-16 max-w-6xl select-none overflow-hidden">
            <DecryptedText
              text="knowhere"
              animateOn="view"
              sequential
              revealDirection="start"
              speed={45}
              parentClassName="block text-[clamp(4rem,19vw,16rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-zinc-900"
              className="text-zinc-900"
              encryptedClassName="text-zinc-300"
            />
          </div>
          <p className="mx-auto max-w-6xl py-6 text-xs text-zinc-400">
            © {new Date().getFullYear()} Knowhere
          </p>
        </footer>
      </div>
    </ClickSpark>
  );
}

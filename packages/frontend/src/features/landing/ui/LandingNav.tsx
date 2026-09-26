import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { RootState } from '../../../app/store';
import { homePathFor, roleOf } from '../../../shared/lib/roles';
import { Logo } from '../../../shared/ui/Logo';
import { cn } from '../../../shared/lib/cn';

const links = [
  { href: '#features', label: 'Features' },
  { href: '#roles', label: 'For teams' },
  { href: '#how', label: 'How it works' }
];

export const LandingNav: React.FC = () => {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-2xl px-3 transition-all duration-500 sm:px-4',
          scrolled || open
            ? 'border border-white/10 bg-night/70 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl'
            : 'border border-transparent'
        )}
      >
        <Link to="/" className="shrink-0" aria-label="Knowhere home">
          <Logo theme="dark" size="sm" />
        </Link>

        <ul className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5">
          {isAuthenticated ? (
            <Link
              to={homePathFor(roleOf(user))}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
            >
              <span className="hidden xs:inline">Open app</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden h-9 items-center rounded-xl px-3 text-sm text-zinc-300 transition hover:text-white sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 xs:px-3.5"
              >
                Get started
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-xl text-zinc-300 transition hover:bg-white/10 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 max-w-6xl rounded-2xl border border-white/10 bg-night/90 p-2 backdrop-blur-xl md:hidden"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            {!isAuthenticated ? (
              <Link
                to="/login"
                className="block rounded-xl px-3 py-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                Sign in
              </Link>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
};

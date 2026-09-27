import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogOut, Menu, Search, X } from 'lucide-react';
import { RootState } from '../../app/store';
import { useLogout } from '../../features/auth/hooks/useLogout';
import { ROLE_LABEL, homePathFor, roleOf } from '../lib/roles';
import { cn } from '../lib/cn';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { CommandMenu } from './CommandMenu';
import { NotificationBell } from '../../features/chat/ui/NotificationBell';
import { NavSection, isActive, navFor } from './navigation';

const SidebarNav: React.FC<{ sections: NavSection[]; onNavigate?: () => void }> = ({
  sections,
  onNavigate
}) => {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section, si) => (
        <div key={si}>
          {section.title ? (
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                      active
                        ? 'font-medium text-zinc-900'
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl bg-zinc-100"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    ) : null}
                    <item.icon
                      className={cn(
                        'relative h-[18px] w-[18px] shrink-0',
                        active ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-700'
                      )}
                    />
                    <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};

const TopNav: React.FC<{ sections: NavSection[] }> = ({ sections }) => {
  const { pathname } = useLocation();
  return (
    <nav className="no-scrollbar hidden min-w-0 items-center gap-1 overflow-x-auto lg:ml-4 lg:flex">
      {sections
        .flatMap((s) => s.items)
        .map((item) => {
          const active = isActive(item, pathname);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors',
                active ? 'font-medium text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              {active ? (
                <motion.span
                  layoutId="topnav-active"
                  className="absolute inset-0 rounded-lg bg-zinc-100"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              ) : null}
              <span className="relative">{item.label}</span>
              {item.badge ? (
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ) : null}
            </NavLink>
          );
        })}
    </nav>
  );
};

const Tagline = () => (
  <div className="px-3">
    <p className="text-sm font-semibold text-zinc-900">Knowhere</p>
    <p className="text-xs leading-relaxed text-zinc-400">
      Learning today.
      <br />
      Stronger tomorrow.
    </p>
  </div>
);

const UserMenu: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-zinc-100 sm:pr-2"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar name={user?.name || 'User'} src={user?.avatar} size="sm" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-zinc-900 sm:block">
          {user?.name?.split(' ')[0] || 'Account'}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-zinc-400 sm:block" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lift"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-medium text-zinc-900">{user?.name}</p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-400">
                {ROLE_LABEL[roleOf(user)]}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export const AppShell: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = roleOf(user);
  const sections = navFor(role);
  const logout = useLogout();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);
  const home = homePathFor(role);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  return (
    <div className="min-h-[100dvh] bg-canvas [--shell-top:4rem]">
      {/* top bar: logo, inline nav, search, notifications, account */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/90 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <button
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-700 transition hover:bg-zinc-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to={home} className="shrink-0">
            <Logo size="sm" />
          </Link>
          <TopNav sections={sections} />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCmd(true)}
              className="grid h-9 w-9 place-items-center rounded-xl text-zinc-600 transition hover:bg-zinc-100"
              aria-label="Search"
              title="Search (⌘K)"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <NotificationBell />
            <UserMenu onLogout={logout} />
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-zinc-950/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 left-0 flex w-[min(17rem,86vw)] flex-col bg-white px-3 py-5 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between px-3">
                <Logo size="sm" />
                <button
                  onClick={() => setDrawer(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav sections={sections} onNavigate={() => setDrawer(false)} />
              </div>
              <div className="mt-4 border-t border-zinc-100 pb-safe pt-4">
                <Tagline />
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <CommandMenu open={cmd} onOpenChange={setCmd} sections={sections} onLogout={logout} />

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
};

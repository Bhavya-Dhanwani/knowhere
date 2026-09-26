import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronsUpDown, LogOut, Menu, Search, X } from 'lucide-react';
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
    <nav className="flex flex-col gap-6">
      {sections.map((section, si) => (
        <div key={si}>
          {section.title ? <p className="eyebrow mb-2 px-3">{section.title}</p> : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex h-9 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                      active
                        ? 'font-medium text-zinc-900'
                        : 'text-zinc-500 hover:bg-zinc-100/70 hover:text-zinc-900'
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl bg-white shadow-card"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    ) : null}
                    <item.icon
                      className={cn(
                        'relative h-[18px] w-[18px] shrink-0',
                        active ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600'
                      )}
                    />
                    <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
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

const UserCard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = roleOf(user);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-white p-1 shadow-lift"
          >
            <div className="px-3 py-2">
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-zinc-100/80"
        aria-expanded={open}
      >
        <Avatar name={user?.name || 'User'} src={user?.avatar} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900">
            {user?.name || 'Guest'}
          </span>
          <span className="block truncate text-xs text-zinc-500">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>
    </div>
  );
};

const SearchTrigger: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex h-9 w-full items-center gap-2.5 rounded-xl bg-white px-3 text-sm text-zinc-400 shadow-card transition hover:text-zinc-600"
  >
    <Search className="h-4 w-4" />
    <span className="flex-1 text-left">Search</span>
    <kbd className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
      ⌘K
    </kbd>
  </button>
);

export const AppShell: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = roleOf(user);
  const sections = navFor(role);
  const logout = useLogout();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  const home = homePathFor(role);

  return (
    <div className="min-h-[100dvh] bg-canvas [--shell-top:3.5rem] lg:[--shell-top:0px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200/70 bg-zinc-50/80 px-3 py-4 backdrop-blur lg:flex">
        <Link to={home} className="mb-5 px-2">
          <Logo />
        </Link>
        <div className="mb-5 flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <SearchTrigger onClick={() => setCmd(true)} />
          </div>
          <NotificationBell align="left" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav sections={sections} />
        </div>
        <div className="mt-4 border-t border-zinc-200/70 pt-3">
          <UserCard onLogout={logout} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-zinc-200/70 bg-white/80 px-3 backdrop-blur-xl sm:px-4 lg:hidden">
        <button
          onClick={() => setDrawer(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-700 transition hover:bg-zinc-100"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to={home} className="min-w-0">
          <Logo size="sm" />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setCmd(true)}
            className="grid h-9 w-9 place-items-center rounded-xl text-zinc-600 transition hover:bg-zinc-100"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <NotificationBell />
          <Avatar name={user?.name || 'User'} src={user?.avatar} size="sm" />
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
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
              className="absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col bg-zinc-50 px-3 py-4 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between px-2">
                <Logo size="sm" />
                <button
                  onClick={() => setDrawer(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/60"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav sections={sections} onNavigate={() => setDrawer(false)} />
              </div>
              <div className="mt-4 border-t border-zinc-200/70 pt-3 pb-safe">
                <UserCard onLogout={logout} />
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <CommandMenu open={cmd} onOpenChange={setCmd} sections={sections} onLogout={logout} />

      <div className="min-w-0 lg:pl-64">
        <Outlet />
      </div>
    </div>
  );
};

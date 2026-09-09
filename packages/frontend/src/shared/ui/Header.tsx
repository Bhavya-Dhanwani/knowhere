import React, { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { User } from '../types';

export interface HeaderProps {
  user: User | null;
  onLogout: () => void | Promise<void>;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onNavigateHome }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-surface/50 backdrop-blur-md border-b border-white/10 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <div className="cursor-pointer" onClick={onNavigateHome}>
          <Logo size="sm" />
        </div>
        <nav className="hidden md:flex items-center gap-4 text-xs font-medium">
          <Link to="/dashboard" className="text-muted hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link to="/review" className="text-muted hover:text-white transition-colors">
            Project Review
          </Link>
          <Link
            to="/docs"
            className="text-primary hover:text-primary-hover transition-colors flex items-center gap-1 font-semibold"
          >
            <span>API Docs</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 border border-primary/30">
              Scalar
            </span>
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-surface border border-transparent hover:border-white/10 transition-colors focus:outline-none"
            >
              <Avatar name={user.name || user.email} src={user.avatar} size="md" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-white leading-none">
                  {user.name || 'Student'}
                </p>
                <p className="text-xs text-muted mt-1 leading-none">{user.email}</p>
              </div>
            </button>

            {dropdownOpen ? (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-white/10 rounded-xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                  <span className="inline-block mt-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                    {user.roles?.[0] || 'student'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
};

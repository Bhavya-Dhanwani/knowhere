import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Shield, BookOpen, Sparkles, LayoutDashboard } from 'lucide-react';
import { Logo } from './Logo';
import { User } from '../types';

export interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onNavigateHome?: () => void;
  theme?: 'light' | 'dark';
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onNavigateHome,
  theme = 'light'
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const isAdminPath = location.pathname.startsWith('/admin');

  const initial = user?.name ? user.name[0].toUpperCase() : 'B';

  return (
    <header
      className={`h-16 px-6 lg:px-10 flex items-center justify-between sticky top-0 z-40 shrink-0 transition-colors ${
        isDark
          ? 'bg-[#0e1017] border-b border-[#232532] text-white'
          : 'bg-white border-b border-zinc-200'
      }`}
    >
      <div className="flex items-center gap-6">
        <div
          className="cursor-pointer"
          onClick={
            onNavigateHome || (() => navigate(isAdminPath ? '/admin/dashboard' : '/dashboard'))
          }
        >
          <Logo size="md" theme={isDark ? 'dark' : 'light'} />
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick Mode Switcher */}
        {isAdminPath ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Switch to Student Classroom"
          >
            <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
            <span>Student View</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
            title="Switch to Admin Console"
          >
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Admin Console</span>
          </button>
        )}

        {user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-2.5 p-1 rounded-full transition-colors focus:outline-none cursor-pointer ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-zinc-100'
              }`}
              title="User Account"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-1 ${
                  isDark
                    ? 'bg-sky-600 text-white ring-sky-500/30'
                    : 'bg-black text-white ring-zinc-300'
                }`}
              >
                {initial}
              </div>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180' : ''
                } ${isDark ? 'text-gray-300' : 'text-zinc-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {dropdownOpen ? (
              <div
                className={`absolute right-0 mt-2 w-60 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 ${
                  isDark
                    ? 'bg-[#181a24] border border-[#2e3142] text-white'
                    : 'bg-white border border-zinc-200 text-zinc-900'
                }`}
              >
                <div
                  className={`px-4 py-3 border-b ${isDark ? 'border-[#2e3142]' : 'border-zinc-100'}`}
                >
                  <p className="text-sm font-semibold">{user.name || 'User'}</p>
                  <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-zinc-500'}`}>
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 border border-blue-500/30">
                      {isAdminPath ? 'admin mode' : user.roles?.[0] || 'student'}
                    </span>
                  </div>
                </div>

                <div className="py-1 border-b border-zinc-100">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/dashboard');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-zinc-500" />
                    Student Classroom
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/admin/dashboard');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    Admin Console
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/review');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Evaluation Pipeline
                  </button>
                </div>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors font-semibold flex items-center gap-2 cursor-pointer"
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

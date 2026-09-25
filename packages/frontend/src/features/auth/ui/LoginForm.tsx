import React, { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { LoginCredentials } from '../../../shared/types';

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading, errorMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left font-sans">
      {errorMessage ? (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {errorMessage}
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Password
          </label>
        </div>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] mt-2"
      >
        <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

      <p className="text-center text-xs text-zinc-500 mt-5">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-bold hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
};

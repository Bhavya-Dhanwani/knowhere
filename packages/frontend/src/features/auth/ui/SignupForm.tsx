import React, { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, Users, Shield, ArrowRight } from 'lucide-react';
import { SignupCredentials } from '../../../shared/types';

export interface SignupFormProps {
  onSubmit: (credentials: SignupCredentials) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSubmit, isLoading, errorMessage }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'trainer' | 'admin'>('student');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    onSubmit({ name, email, password, role });
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
          Full Name
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Rivera"
          className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

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
        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
          I am joining as
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`py-2 px-2 text-xs rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              role === 'student'
                ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs font-bold'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-medium'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px]">Student</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('trainer')}
            className={`py-2 px-2 text-xs rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              role === 'trainer'
                ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs font-bold'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-medium'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[11px]">Trainer</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('admin')}
            className={`py-2 px-2 text-xs rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              role === 'admin'
                ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs font-bold'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-medium'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px]">Admin</span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] mt-2"
      >
        <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

      <p className="text-center text-xs text-zinc-500 mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
};

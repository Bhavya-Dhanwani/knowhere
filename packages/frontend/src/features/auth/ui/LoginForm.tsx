import React, { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Mail } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { LoginCredentials } from '../../../shared/types';
import { FormError, GoogleButton, OrDivider, PasswordInput } from './AuthControls';

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

// accounts created by `pnpm seed` — handy for demos, harmless if not seeded
const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'student@example.com' },
  { label: 'Trainer', email: 'trainer@example.com' },
  { label: 'Admin', email: 'admin@example.com' }
];
const DEMO_PASSWORD = 'Password123!';

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading, errorMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit({ email: email.trim().toLowerCase(), password });
  };

  return (
    <div>
      <GoogleButton />
      <OrDivider />

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        <FormError message={errorMessage} />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          icon={<Mail className="h-4 w-4" />}
          className="h-11"
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="text-[13px] font-medium text-zinc-700">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="h-11"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          {isLoading ? 'Signing in' : 'Sign in'}
          {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </form>

      <div className="mt-6 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200/70">
        <p className="px-1 text-xs text-zinc-500">Try a demo account</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword(DEMO_PASSWORD);
              }}
              className="min-w-0 truncate rounded-lg bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-xs ring-1 ring-inset ring-zinc-200 transition hover:text-brand-700 hover:ring-brand-300"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

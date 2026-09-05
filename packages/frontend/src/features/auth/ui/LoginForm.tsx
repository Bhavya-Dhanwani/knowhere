import React, { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../shared/ui/Button';
import { LoginCredentials } from '../../../shared/types';

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  onDemoLogin?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading,
  errorMessage,
  onDemoLogin
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {errorMessage}
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full px-3.5 py-2.5 bg-background border border-white/10 rounded-lg text-white text-sm placeholder:text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider">
            Password
          </label>
        </div>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="��������"
          className="w-full px-3.5 py-2.5 bg-background border border-white/10 rounded-lg text-white text-sm placeholder:text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full mt-2"
        isLoading={isLoading}
      >
        Sign In
      </Button>

      {onDemoLogin ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-full"
          onClick={onDemoLogin}
          disabled={isLoading}
        >
          Quick Demo Login (Student)
        </Button>
      ) : null}

      <p className="text-center text-xs text-muted mt-6">
        Don&apos;t have an account?{' '}
        <Link
          to="/signup"
          className="text-primary hover:text-primary-hover font-medium underline underline-offset-4"
        >
          Create account
        </Link>
      </p>
    </form>
  );
};

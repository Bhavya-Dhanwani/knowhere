import React, { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../shared/ui/Button';
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
  const [role, setRole] = useState<'student' | 'trainer'>('student');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    onSubmit({ name, email, password, role });
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
          Full Name
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Rivera"
          className="w-full px-3.5 py-2.5 bg-background border border-white/10 rounded-lg text-white text-sm placeholder:text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

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
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="��������"
          className="w-full px-3.5 py-2.5 bg-background border border-white/10 rounded-lg text-white text-sm placeholder:text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
          I am joining as a
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
              role === 'student'
                ? 'bg-primary/20 border-primary text-white shadow-sm shadow-primary/20'
                : 'bg-background border-white/10 text-muted hover:text-white'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole('trainer')}
            className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
              role === 'trainer'
                ? 'bg-primary/20 border-primary text-white shadow-sm shadow-primary/20'
                : 'bg-background border-white/10 text-muted hover:text-white'
            }`}
          >
            Trainer
          </button>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full mt-2"
        isLoading={isLoading}
      >
        Create Account
      </Button>

      <p className="text-center text-xs text-muted mt-6">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-primary hover:text-primary-hover font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
};

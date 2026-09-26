import React, { useMemo, useState } from 'react';
import { ArrowRight, GraduationCap, Mail, Presentation, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { cn } from '../../../shared/lib/cn';
import { SignupCredentials } from '../../../shared/types';
import { FormError, GoogleButton, OrDivider, PasswordInput } from './AuthControls';

export interface SignupFormProps {
  onSubmit: (credentials: SignupCredentials) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

const ROLES = [
  { id: 'student' as const, label: 'Student', hint: 'Learn & practice', icon: GraduationCap },
  { id: 'trainer' as const, label: 'Trainer', hint: 'Teach a cohort', icon: Presentation }
];

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const strengthLabel = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
const strengthColor = [
  'bg-zinc-200',
  'bg-red-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-500'
];

export const SignupForm: React.FC<SignupFormProps> = ({ onSubmit, isLoading, errorMessage }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'trainer'>('student');
  const [touched, setTouched] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);
  const nameError = touched && name.trim().length < 3 ? 'Use at least 3 characters.' : null;
  const pwError = touched && password.length < 6 ? 'Use at least 6 characters.' : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (name.trim().length < 3 || !email || password.length < 6) return;
    onSubmit({ name, email, password, role });
  };

  return (
    <div>
      <GoogleButton label="Sign up with Google" />
      <OrDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={errorMessage} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-zinc-700">
            I&apos;m joining as
          </legend>
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  aria-pressed={active}
                  className={cn(
                    'relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition',
                    active ? 'ring-2 ring-brand-500' : 'ring-zinc-200 hover:ring-zinc-300'
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="role-bg"
                      className="absolute inset-0 rounded-xl bg-brand-50/70"
                      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                      active ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'
                    )}
                  >
                    <r.icon className="h-4 w-4" />
                  </span>
                  <span className="relative min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-900">
                      {r.label}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">{r.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Input
          label="Full name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada Lovelace"
          icon={<UserIcon className="h-4 w-4" />}
          error={nameError}
          className="h-11"
        />

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
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            error={pwError}
            className="h-11"
          />
          {password ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="grid flex-1 grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 rounded-full transition-colors duration-300',
                      i <= score ? strengthColor[score] : 'bg-zinc-200'
                    )}
                  />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-zinc-500">{strengthLabel[score]}</span>
            </div>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          {isLoading ? 'Creating account' : 'Create account'}
          {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>

        <p className="text-center text-xs leading-relaxed text-zinc-400">
          Admin access is granted by an existing admin from the admin console.
        </p>
      </form>
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { FormError, PasswordInput } from './AuthControls';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { authApi } from '../api/authApi';

const BackToLogin = () => (
  <Link to="/login" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
    Back to sign in
  </Link>
);

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const m = useMutation({ mutationFn: authApi.forgotPassword });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new one."
      footer={<BackToLogin />}
    >
      {m.isSuccess ? (
        <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-sm font-medium text-emerald-900">Check your inbox</p>
          <p className="mt-1 text-sm text-emerald-800/80">
            If an account exists for <span className="break-all font-medium">{email}</span>, a reset
            link is on its way.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email) m.mutate(email);
          }}
        >
          <FormError message={m.error instanceof Error ? m.error.message : null} />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            icon={<Mail className="h-4 w-4" />}
            className="h-11"
          />
          <Button type="submit" size="lg" className="w-full" isLoading={m.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const m = useMutation({ mutationFn: () => authApi.resetPassword(token, password) });
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Make it at least 6 characters."
      footer={<BackToLogin />}
    >
      {m.isSuccess ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="mt-3 text-sm font-medium text-emerald-900">Password updated</p>
          </div>
          <Button size="lg" className="w-full" onClick={() => navigate('/login')}>
            Continue to sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length >= 6 && !mismatch) m.mutate();
          }}
        >
          <FormError message={m.error instanceof Error ? m.error.message : null} />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? "Passwords don't match." : null}
            className="h-11"
          />
          <Button type="submit" size="lg" className="w-full" isLoading={m.isPending}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

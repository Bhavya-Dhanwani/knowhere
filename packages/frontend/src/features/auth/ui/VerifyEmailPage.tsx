import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { authApi } from '../api/authApi';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../../shared/ui/Button';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../state/authSlice';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || '');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout title="Verify your email" subtitle="Enter the six-digit code sent to your inbox.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            await authApi.verifyEmail(email, token);
            const session = await authApi.refresh();
            dispatch(setCredentials(session));
            navigate('/dashboard');
          } catch {
            setMessage('The verification code is invalid or expired.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="w-full rounded-lg bg-surface border border-white/10 p-3 text-white"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          className="w-full rounded-lg bg-surface border border-white/10 p-3 text-white"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="6-digit code"
        />
        {message && <p className="text-sm text-red-400">{message}</p>}
        <Button type="submit" isLoading={busy}>
          Verify email
        </Button>
      </form>
    </AuthLayout>
  );
};

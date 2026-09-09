import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { authApi } from '../api/authApi';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../../shared/ui/Button';

export const ResetPasswordPage: React.FC = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout title="Reset password" subtitle="Choose a new password for your account.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            await authApi.resetPassword(token, password);
            navigate('/login');
          } catch {
            setMessage('The reset link is invalid or expired.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="w-full rounded-lg bg-surface border border-white/10 p-3 text-white"
          type="password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
        />
        {message && <p className="text-sm text-red-400">{message}</p>}
        <Button type="submit" isLoading={busy}>
          Set new password
        </Button>
      </form>
    </AuthLayout>
  );
};

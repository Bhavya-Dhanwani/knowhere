import React from 'react';
import { AuthLayout } from './AuthLayout';
import { LoginForm } from './LoginForm';
import { useLogin } from '../hooks/useLogin';

export const LoginPage: React.FC = () => {
  const { mutate: login, isPending, error } = useLogin();

  const errorMessage = error instanceof Error ? error.message : null;

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to continue your learning journey">
      <LoginForm onSubmit={login} isLoading={isPending} errorMessage={errorMessage} />
    </AuthLayout>
  );
};

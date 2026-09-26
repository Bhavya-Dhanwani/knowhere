import React from 'react';
import { Link, useSearchParams } from 'react-router';
import { AuthLayout } from './AuthLayout';
import { LoginForm } from './LoginForm';
import { useLogin } from '../hooks/useLogin';

export const LoginPage: React.FC = () => {
  const { mutate: login, isPending, error } = useLogin();
  const [params] = useSearchParams();

  const errorMessage =
    error instanceof Error
      ? error.message
      : params.get('googleError')
        ? 'Google sign-in was cancelled or failed. Please try again.'
        : null;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to Knowhere?{' '}
          <Link
            to="/signup"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm onSubmit={login} isLoading={isPending} errorMessage={errorMessage} />
    </AuthLayout>
  );
};

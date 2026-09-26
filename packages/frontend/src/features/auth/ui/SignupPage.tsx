import React from 'react';
import { Link } from 'react-router';
import { AuthLayout } from './AuthLayout';
import { SignupForm } from './SignupForm';
import { useSignup } from '../hooks/useSignup';

export const SignupPage: React.FC = () => {
  const { mutate: signup, isPending, error } = useSignup();

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join a cohort, start building, get reviewed."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm
        onSubmit={signup}
        isLoading={isPending}
        errorMessage={error instanceof Error ? error.message : null}
      />
    </AuthLayout>
  );
};

import React from 'react';
import { AuthLayout } from './AuthLayout';
import { SignupForm } from './SignupForm';
import { useSignup } from '../hooks/useSignup';

export const SignupPage: React.FC = () => {
  const { mutate: signup, isPending, error } = useSignup();

  const errorMessage = error instanceof Error ? error.message : null;

  return (
    <AuthLayout
      title="Join Knowhere"
      subtitle="Start learning, practicing, and leveling up your skills"
    >
      <SignupForm onSubmit={signup} isLoading={isPending} errorMessage={errorMessage} />
    </AuthLayout>
  );
};

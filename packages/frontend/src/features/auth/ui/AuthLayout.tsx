import React from 'react';
import { Logo } from '../../../shared/ui/Logo';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size="md" className="mb-4" />
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-sm text-muted mt-1.5">{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  );
};

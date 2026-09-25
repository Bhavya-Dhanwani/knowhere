import React from 'react';
import { Logo } from '../../../shared/ui/Logo';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] text-zinc-900 px-4 py-12 relative overflow-hidden font-sans select-none">
      {/* Decorative subtle background radial */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-zinc-200/90 rounded-2xl shadow-sm p-6 sm:p-8 relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size="md" theme="light" className="mb-3.5" />
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">{title}</h1>
          <p className="text-xs text-zinc-500 mt-1 font-normal">{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  );
};

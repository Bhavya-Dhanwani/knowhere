import React from 'react';
import { Link, useParams } from 'react-router';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { UserRoundX } from 'lucide-react';
import { RootState } from '../../../app/store';
import { lmsApi } from '../../../shared/api/lms';
import { Logo } from '../../../shared/ui/Logo';
import { Button } from '../../../shared/ui/Button';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { ProfileView } from './ProfileView';

// domain.com/<username>: works signed out; the header adapts to whether the viewer is signed in
export const PublicProfilePage: React.FC = () => {
  const { username = '' } = useParams();
  const signedIn = useSelector((s: RootState) => s.auth.isAuthenticated);
  const q = useQuery({
    queryKey: ['public-profile', username.toLowerCase()],
    queryFn: () => lmsApi.publicProfile(username),
    retry: false
  });

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="border-b border-zinc-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <Link to={signedIn ? '/dashboard' : '/login'}>
            <Button size="sm" variant={signedIn ? 'outline' : 'primary'}>
              {signedIn ? 'Dashboard' : 'Sign in'}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {q.isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : q.data ? (
          <ProfileView p={q.data} />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-zinc-200/80 bg-white px-6 py-14 text-center">
            <UserRoundX className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 font-medium text-zinc-900">
              {/sign in/i.test((q.error as Error)?.message || '')
                ? 'Sign in to see this profile'
                : 'This profile does not exist'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Check the link, or ask its owner to share their profile publicly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

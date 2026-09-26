import React from 'react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Home, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';

export const RouteError: React.FC = () => {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'Unexpected error';

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <Logo className="justify-center" />
        <p className="mt-10 font-mono text-sm text-brand-600">{status}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {status === 404 ? 'Page not found' : 'Something broke'}
        </h1>
        <p className="mt-2 break-words text-sm text-zinc-500">{message}</p>
        <div className="mt-8 flex flex-col justify-center gap-2 xs:flex-row">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
          <Link to="/">
            <Button className="w-full">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

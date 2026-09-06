import { createBrowserRouter, redirect } from 'react-router';
import { store } from './store';
import { authApi } from '../features/auth/api/authApi';
import { setAccessToken } from '../features/auth/state/authSlice';
import { LandingPage } from '../features/landing/ui/LandingPage';
import { LoginPage } from '../features/auth/ui/LoginPage';
import { SignupPage } from '../features/auth/ui/SignupPage';
import { DashboardPage } from '../features/dashboard/ui/DashboardPage';
import { CoursePage } from '../features/course/ui/CoursePage';

import { ReviewDashboard } from '../features/review/ui/ReviewDashboard';
import { PublicSubmissionPage } from '../features/review/ui/PublicSubmissionPage';

import { ApiDocsPage } from '../features/docs/ui/ApiDocsPage';

export const requireAuth = async () => {
  const state = store.getState().auth;
  if (state.isAuthenticated && state.accessToken) {
    return null;
  }

  // Attempt silent refresh via HTTP-only cookie
  try {
    const res = await authApi.refresh();
    if (res?.accessToken) {
      store.dispatch(setAccessToken(res.accessToken));
      return null;
    }
  } catch {
    // Refresh failed or no active session
  }

  // Double check in case of reload state
  if (!store.getState().auth.isAuthenticated) {
    throw redirect('/login');
  }

  return null;
};

export const requireGuest = () => {
  const state = store.getState().auth;
  if (state.isAuthenticated && state.accessToken) {
    throw redirect('/dashboard');
  }
  return null;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />
  },
  {
    path: '/login',
    loader: requireGuest,
    element: <LoginPage />
  },
  {
    path: '/signup',
    loader: requireGuest,
    element: <SignupPage />
  },
  {
    path: '/dashboard',
    loader: requireAuth,
    element: <DashboardPage />
  },
  {
    path: '/course/:courseId',
    loader: requireAuth,
    element: <CoursePage />
  },
  {
    path: '/review',
    element: <ReviewDashboard />
  },
  {
    path: '/review/submit/:eventId',
    element: <PublicSubmissionPage />
  },
  {
    path: '/docs',
    element: <ApiDocsPage />
  },
  {
    path: '*',
    loader: () => redirect('/dashboard')
  }
]);

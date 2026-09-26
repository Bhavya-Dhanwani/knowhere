import React from 'react';
import { createBrowserRouter, redirect } from 'react-router';
import { store } from './store';
import { authApi } from '../features/auth/api/authApi';
import { setAccessToken, setUser } from '../features/auth/state/authSlice';
import { AppRole, homePathFor, roleOf } from '../shared/lib/roles';
import { AppShell } from '../shared/layout/AppShell';
import { RouteError } from '../shared/layout/RouteError';
import { LandingPage } from '../features/landing/ui/LandingPage';
import { LoginPage } from '../features/auth/ui/LoginPage';
import { SignupPage } from '../features/auth/ui/SignupPage';
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/ui/PasswordRecoveryPages';
import { DashboardPage } from '../features/dashboard/ui/DashboardPage';
import { CoursesPage } from '../features/course/ui/CoursesPage';
import { CoursePage } from '../features/course/ui/CoursePage';
import { AdminDashboardPage } from '../features/admin/ui/AdminDashboardPage';

// Ensures a session exists, silently refreshing from the HTTP-only cookie when needed
// (this is also how the Google OAuth redirect lands: cookie set, no token in memory yet).
async function ensureSession() {
  const { isAuthenticated, accessToken, user } = store.getState().auth;
  if (isAuthenticated && accessToken && user) return true;

  try {
    const res = await authApi.refresh();
    if (res?.accessToken) {
      store.dispatch(setAccessToken(res.accessToken));
      if (res.user) store.dispatch(setUser(res.user));
      return true;
    }
  } catch {
    // no active session
  }
  return Boolean(store.getState().auth.accessToken && store.getState().auth.user);
}

// sends unauthenticated visitors to sign in, then back to where they were going
const toLogin = (request?: Request) => {
  if (!request) return redirect('/login');
  const url = new URL(request.url);
  return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
};

export const requireAuth = async ({ request }: { request?: Request } = {}) => {
  if (!(await ensureSession())) throw toLogin(request);
  return null;
};

const requireRole =
  (...roles: AppRole[]) =>
  async ({ request }: { request?: Request } = {}) => {
    if (!(await ensureSession())) throw toLogin(request);
    const role = roleOf(store.getState().auth.user);
    if (!roles.includes(role)) throw redirect(homePathFor(role));
    return null;
  };

export const requireGuest = () => {
  const { isAuthenticated, accessToken, user } = store.getState().auth;
  if (isAuthenticated && accessToken && user) {
    throw redirect(homePathFor(roleOf(user)));
  }
  return null;
};

// heavier screens load on demand to keep the first paint small
const lazyPage =
  <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  () =>
    load().then((m) => ({ Component: m[name] }));

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <RouteError /> },
  { path: '/login', loader: requireGuest, element: <LoginPage /> },
  { path: '/signup', loader: requireGuest, element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password/:token', element: <ResetPasswordPage /> },
  {
    path: '/review/submit/:eventId',
    loader: requireAuth,
    lazy: lazyPage(
      () => import('../features/review/ui/PublicSubmissionPage'),
      'PublicSubmissionPage'
    )
  },
  { path: '/docs', lazy: lazyPage(() => import('../features/docs/ui/ApiDocsPage'), 'ApiDocsPage') },
  {
    element: <AppShell />,
    loader: requireAuth,
    errorElement: <RouteError />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/courses', element: <CoursesPage /> },
      { path: '/course/:id', element: <CoursePage /> },
      {
        path: '/course/:id/learn/:itemId',
        lazy: lazyPage(() => import('../features/course/ui/LessonPlayerPage'), 'LessonPlayerPage')
      },
      // legacy lesson URLs from the old viewer land on the course overview
      { path: '/course/:id/submodule/*', loader: ({ params }) => redirect(`/course/${params.id}`) },
      {
        path: '/chat',
        lazy: lazyPage(() => import('../features/chat/ui/CommunitiesPage'), 'CommunitiesPage')
      },
      {
        path: '/course/:id/community',
        lazy: lazyPage(() => import('../features/chat/ui/CommunityPage'), 'CommunityPage')
      },
      {
        path: '/review',
        loader: requireRole('trainer', 'admin'),
        lazy: lazyPage(() => import('../features/review/ui/ReviewDashboard'), 'ReviewDashboard')
      },
      { path: '/admin', loader: () => redirect('/admin/dashboard') },
      { path: '/admin/dashboard', loader: requireRole('admin'), element: <AdminDashboardPage /> },
      { path: '/admin/courses', loader: requireRole('admin'), element: <AdminDashboardPage /> },
      { path: '/admin/people', loader: requireRole('admin'), element: <AdminDashboardPage /> },
      {
        path: '/library',
        loader: requireRole('trainer', 'admin'),
        lazy: lazyPage(
          () => import('../features/admin/ui/library/ContentLibraryPage'),
          'ContentLibraryPage'
        )
      },
      {
        path: '/admin/course/:courseId',
        loader: requireRole('admin', 'trainer'),
        lazy: lazyPage(
          () => import('../features/admin/ui/editor/CourseEditorPage'),
          'CourseEditorPage'
        )
      }
    ]
  },
  { path: '*', loader: () => redirect('/') }
]);

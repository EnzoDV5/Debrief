// Every page and its URL. Pages inside the app load lazily so the first visit stays fast.
import { Navigate, Outlet, ScrollRestoration, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { RedirectIfAuthed } from '@/features/auth/RedirectIfAuthed';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { index: true, element: <Navigate to="/meetings" replace /> },

      {
        element: <RedirectIfAuthed />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },

      {
        element: <AuthLayout />,
        children: [{ path: 'reset-password', element: <ResetPasswordPage /> }],
      },

      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: 'meetings',
                lazy: async () => ({
                  Component: (await import('@/pages/MeetingsPage')).MeetingsPage,
                }),
              },
              { path: 'meetings/new', element: <Navigate to="/meetings" replace /> },
              {
                path: 'meetings/:meetingId',
                lazy: async () => ({
                  Component: (await import('@/pages/MeetingDetailPage')).MeetingDetailPage,
                }),
              },
              {
                path: 'items',
                lazy: async () => ({
                  Component: (await import('@/pages/OpenItemsPage')).OpenItemsPage,
                }),
              },
              {
                path: 'projects',
                lazy: async () => ({
                  Component: (await import('@/pages/ProjectsPage')).ProjectsPage,
                }),
              },
              {
                path: 'projects/:projectId',
                lazy: async () => ({
                  Component: (await import('@/pages/ProjectsPage')).ProjectsPage,
                }),
              },
              {
                path: 'account',
                lazy: async () => ({
                  Component: (await import('@/pages/AccountPage')).AccountPage,
                }),
              },
            ],
          },
        ],
      },

      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];

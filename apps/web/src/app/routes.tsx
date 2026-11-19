import { Navigate, Outlet, ScrollRestoration, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { RedirectIfAuthed } from '@/features/auth/RedirectIfAuthed';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

function RootLayout() {
  return (
    <>
      {/* New page → top; Back button → where you were. */}
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

/**
 * Logged-out entry pages (login/register) are in the main bundle so they paint immediately.
 * Pages inside the app are lazy-loaded: each downloads as its own small chunk on first visit.
 */
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
            ],
          },
        ],
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
              // The old separate page: home (/meetings) is now where meetings start.
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

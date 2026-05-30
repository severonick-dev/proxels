import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/public-layout';
import { LkLayout } from '@/components/layout/lk-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import HomePage from '@/pages/home';
import PricingPage from '@/pages/pricing';
import GuidesPage from '@/pages/guides';
import PrivacyPage from '@/pages/legal/privacy';
import OfferPage from '@/pages/legal/offer';
import CookiesPage from '@/pages/legal/cookies';
import LoginPage from '@/pages/auth/login';
import RegisterPage from '@/pages/auth/register';
import VerifyEmailPage from '@/pages/auth/verify-email';
import ForgotPasswordPage from '@/pages/auth/forgot-password';
import ResetPasswordPage from '@/pages/auth/reset-password';
import LkDashboardPage from '@/pages/lk/dashboard';
import LkPaymentsPage from '@/pages/lk/payments';
import LkSettingsPage from '@/pages/lk/settings';
import AdminDashboardPage from '@/pages/admin/dashboard';
import NotFoundPage from '@/pages/not-found';

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/guides', element: <GuidesPage /> },
      { path: '/legal/privacy', element: <PrivacyPage /> },
      { path: '/legal/offer', element: <OfferPage /> },
      { path: '/legal/cookies', element: <CookiesPage /> },

      // Auth (внутри публичного layout — header/footer как обычно)
      { path: '/auth/login', element: <LoginPage /> },
      { path: '/auth/register', element: <RegisterPage /> },
      { path: '/auth/verify-email', element: <VerifyEmailPage /> },
      { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/auth/reset-password', element: <ResetPasswordPage /> },

      // ЛК (внутри публичного layout + собственный side-nav через LkLayout)
      {
        element: (
          <ProtectedRoute>
            <LkLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/lk', element: <LkDashboardPage /> },
          { path: '/lk/payments', element: <LkPaymentsPage /> },
          { path: '/lk/settings', element: <LkSettingsPage /> },
        ],
      },

      // Админка — только для роли admin (полноценная админ-панель — Этап 12).
      {
        path: '/admin',
        element: (
          <ProtectedRoute requireRole="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);

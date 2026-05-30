import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/public-layout';
import HomePage from '@/pages/home';
import PricingPage from '@/pages/pricing';
import GuidesPage from '@/pages/guides';
import PrivacyPage from '@/pages/legal/privacy';
import OfferPage from '@/pages/legal/offer';
import CookiesPage from '@/pages/legal/cookies';
import LoginPage from '@/pages/auth/login';
import RegisterPage from '@/pages/auth/register';
import VerifyEmailPage from '@/pages/auth/verify-email';
import ResetPasswordPage from '@/pages/auth/reset-password';
import LkDashboardPage from '@/pages/lk/dashboard';
import AdminDashboardPage from '@/pages/admin/dashboard';
import NotFoundPage from '@/pages/not-found';

/**
 * Все маршруты — под PublicLayout (Header + Footer). Guards для /lk и /admin
 * подключатся в Этапе 8 (auth-стора) и Этапе 12 (админка с 2FA).
 */
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
      { path: '/auth/login', element: <LoginPage /> },
      { path: '/auth/register', element: <RegisterPage /> },
      { path: '/auth/verify-email', element: <VerifyEmailPage /> },
      { path: '/auth/reset-password', element: <ResetPasswordPage /> },
      { path: '/lk', element: <LkDashboardPage /> },
      { path: '/admin', element: <AdminDashboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);

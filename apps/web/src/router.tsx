import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/public-layout';
import { LkLayout } from '@/components/layout/lk-layout';
import { AdminLayout } from '@/components/layout/admin-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import HomePage from '@/pages/home';
import PricingPage from '@/pages/pricing';
import GuidesIndexPage from '@/pages/guides/index';
import GuideDetailPage from '@/pages/guides/detail';
import NewsIndexPage from '@/pages/news/index';
import NewsDetailPage from '@/pages/news/detail';
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
import LkSecurityPage from '@/pages/lk/security';
import AdminOverviewPage from '@/pages/admin/overview';
import AdminUsersPage from '@/pages/admin/users';
import AdminPaymentsPage from '@/pages/admin/payments';
import AdminPlansPage from '@/pages/admin/plans';
import AdminPromosPage from '@/pages/admin/promos';
import AdminNodesPage from '@/pages/admin/nodes';
import AdminGuidesPage from '@/pages/admin/guides';
import AdminNewsPage from '@/pages/admin/news';
import AdminLegalPage from '@/pages/admin/legal';
import AdminAuditPage from '@/pages/admin/audit';
import AdminDeployPage from '@/pages/admin/deploy';
import AdminTestsPage from '@/pages/admin/tests';
import NotFoundPage from '@/pages/not-found';

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/guides', element: <GuidesIndexPage /> },
      { path: '/guides/:slug', element: <GuideDetailPage /> },
      { path: '/news', element: <NewsIndexPage /> },
      { path: '/news/:slug', element: <NewsDetailPage /> },
      { path: '/legal/privacy', element: <PrivacyPage /> },
      { path: '/legal/offer', element: <OfferPage /> },
      { path: '/legal/cookies', element: <CookiesPage /> },

      // Auth
      { path: '/auth/login', element: <LoginPage /> },
      { path: '/auth/register', element: <RegisterPage /> },
      { path: '/auth/verify-email', element: <VerifyEmailPage /> },
      { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/auth/reset-password', element: <ResetPasswordPage /> },

      // ЛК
      {
        element: (
          <ProtectedRoute>
            <LkLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/lk', element: <LkDashboardPage /> },
          { path: '/lk/payments', element: <LkPaymentsPage /> },
          { path: '/lk/security', element: <LkSecurityPage /> },
          { path: '/lk/settings', element: <LkSettingsPage /> },
        ],
      },

      // Админка — только для роли admin
      {
        element: (
          <ProtectedRoute requireRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/admin', element: <AdminOverviewPage /> },
          { path: '/admin/users', element: <AdminUsersPage /> },
          { path: '/admin/payments', element: <AdminPaymentsPage /> },
          { path: '/admin/plans', element: <AdminPlansPage /> },
          { path: '/admin/promos', element: <AdminPromosPage /> },
          { path: '/admin/nodes', element: <AdminNodesPage /> },
          { path: '/admin/guides', element: <AdminGuidesPage /> },
          { path: '/admin/news', element: <AdminNewsPage /> },
          { path: '/admin/legal', element: <AdminLegalPage /> },
          { path: '/admin/audit', element: <AdminAuditPage /> },
          { path: '/admin/deploy', element: <AdminDeployPage /> },
          { path: '/admin/tests', element: <AdminTestsPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);

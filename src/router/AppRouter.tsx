import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { AppShell } from '../components/layout/AppShell';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { PendingPage } from '../pages/PendingPage';
import { TermsPage } from '../pages/TermsPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppHomePage } from '../pages/app/AppHomePage';
import { ProfilePage } from '../pages/app/ProfilePage';
import { DirectoryPage } from '../pages/app/DirectoryPage';
import { MemberProfilePage } from '../pages/app/MemberProfilePage';
import { SuperConnectorPage } from '../pages/app/SuperConnectorPage';
import { JobsPage } from '../pages/app/JobsPage';
import { OpenToWorkPage } from '../pages/app/OpenToWorkPage';
import { EventsPage } from '../pages/app/EventsPage';
import { EntrepreneurshipPage } from '../pages/app/EntrepreneurshipPage';
import { NotificationsPage } from '../pages/app/NotificationsPage';
import { AdminIndexPage } from '../pages/app/admin/AdminIndexPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="pending" element={<PendingPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
      </Route>

      <Route
        path="app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppHomePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="directory" element={<DirectoryPage />} />
        <Route path="directory/:uid" element={<MemberProfilePage />} />
        <Route path="superconnector" element={<SuperConnectorPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="open-to-work" element={<OpenToWorkPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="entrepreneurship" element={<EntrepreneurshipPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminIndexPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

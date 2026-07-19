import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { ProjectPage } from './features/project/ProjectPage.js';
import { NewProjectPage } from './features/project/NewProjectPage.js';
import { IntegrationsPage } from './features/project/IntegrationsPage.js';
import { SprintRatingsPage } from './features/project/SprintRatingsPage.js';
import { ContributorsPage } from './features/project/ContributorsPage.js';
import { SegmentsPage } from './features/project/SegmentsPage.js';
import { FeatureCategoriesPage } from './features/project/FeatureCategoriesPage.js';
import { ShareDashboardPage } from './features/project/ShareDashboardPage.js';
import { OrgSettingsPage } from './features/dashboard/OrgSettingsPage.js';
import { ProjectSettingsPage } from './features/project/ProjectSettingsPage.js';
import { UserProfilePage } from './features/dashboard/UserProfilePage.js';
import { Spinner } from './components/Spinner.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Guards a route so unauthenticated users are sent to /login.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialising } = useAuth();

  if (isInitialising) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Guards /login and /register so already-authenticated users skip to /dashboard.
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialising } = useAuth();

  if (isInitialising) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppRoutes() {
  const { initialise } = useAuth();

  // Attempt silent refresh on mount so the session survives a page reload
  useEffect(() => {
    initialise();
  }, [initialise]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/projects/new" element={<RequireAuth><NewProjectPage /></RequireAuth>} />
      <Route path="/projects/:projectId" element={<RequireAuth><ProjectPage /></RequireAuth>} />
      <Route path="/projects/:projectId/integrations" element={<RequireAuth><IntegrationsPage /></RequireAuth>} />
      <Route path="/projects/:projectId/contributors" element={<RequireAuth><ContributorsPage /></RequireAuth>} />
      <Route path="/projects/:projectId/segments" element={<RequireAuth><SegmentsPage /></RequireAuth>} />
      <Route path="/projects/:projectId/feature-categories" element={<RequireAuth><FeatureCategoriesPage /></RequireAuth>} />
      <Route path="/projects/:projectId/sprints/:sprintId/ratings" element={<RequireAuth><SprintRatingsPage /></RequireAuth>} />
      <Route path="/projects/:projectId/settings" element={<RequireAuth><ProjectSettingsPage /></RequireAuth>} />
      <Route path="/settings/org" element={<RequireAuth><OrgSettingsPage /></RequireAuth>} />
      <Route path="/settings/profile" element={<RequireAuth><UserProfilePage /></RequireAuth>} />

      <Route path="/s/:shareToken" element={<ShareDashboardPage />} />

      {/* Catch-all: redirect unknown paths to dashboard (which will itself redirect to login if not authenticated) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

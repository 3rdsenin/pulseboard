import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { ProjectPage } from './features/project/ProjectPage.js';
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
      <Route path="/projects/:projectId" element={<RequireAuth><ProjectPage /></RequireAuth>} />

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

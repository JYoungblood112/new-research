import { createBrowserRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import SsoPage from './pages/SsoPage';
import ProfessorDashboard from './pages/professor/ProfessorDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentResearchDetailPage from './pages/student/StudentResearchDetailPage';
import StudentSetupPage from './pages/student/StudentSetupPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

function ProtectedRoute({
  children,
  allowedRole,
  requireSetupComplete = false,
}: {
  children: React.ReactNode;
  allowedRole?: 'professor' | 'student';
  requireSetupComplete?: boolean;
}) {
  const { user, setupState, loadingSession } = useAuth();

  const hasCompletedStudentOnboarding =
    user?.role === 'student' &&
    typeof window !== 'undefined' &&
    localStorage.getItem(`student_onboarding_${user.id}`) === 'true';

  if (loadingSession) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'professor' ? '/professor/dashboard' : '/student/dashboard'} replace />;
  }

  if (
    requireSetupComplete &&
    user.role === 'student' &&
    (!setupState?.completed || !hasCompletedStudentOnboarding)
  ) {
    return <Navigate to="/student/setup" replace />;
  }

  return <>{children}</>;
}

function Root({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>{children}</DataProvider>
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Root>
        <LoginPage />
      </Root>
    ),
  },
  {
    path: '/professor/dashboard',
    element: (
      <Root>
        <ProtectedRoute allowedRole="professor">
          <ProfessorDashboard />
        </ProtectedRoute>
      </Root>
    ),
  },
  {
    path: '/sso',
    element: (
      <Root>
        <SsoPage />
      </Root>
    ),
  },
  {
    path: '/student/dashboard',
    element: (
      <Root>
        <ProtectedRoute allowedRole="student" requireSetupComplete>
          <StudentDashboard />
        </ProtectedRoute>
      </Root>
    ),
  },
  {
    path: '/student/setup',
    element: (
      <Root>
        <ProtectedRoute allowedRole="student">
          <StudentSetupPage />
        </ProtectedRoute>
      </Root>
    ),
  },
  {
    path: '/student/research/:postingId',
    element: (
      <Root>
        <ProtectedRoute allowedRole="student" requireSetupComplete>
          <StudentResearchDetailPage />
        </ProtectedRoute>
      </Root>
    ),
  },
  {
    path: '*',
    element: (
      <Root>
        <Navigate to="/" replace />
      </Root>
    ),
  },
]);

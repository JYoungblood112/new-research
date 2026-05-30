import { createBrowserRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import SsoPage from './pages/SsoPage';
import ProfessorDashboard from './pages/professor/ProfessorDashboard';
import ProfessorProfilePage from './pages/professor/ProfessorProfilePage';
import ProfessorSetupPage from './pages/professor/ProfessorSetupPage';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentResearchDetailPage from './pages/student/StudentResearchDetailPage';
import StudentSetupPage from './pages/student/StudentSetupPage';
import { useAuth } from './contexts/AuthContext';

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

  const hasCompletedProfessorOnboarding =
    user?.role === 'professor' &&
    typeof window !== 'undefined' &&
    localStorage.getItem(`professor_onboarding_${user.id}`) === 'true';

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

  if (
    requireSetupComplete &&
    user.role === 'professor' &&
    (!setupState?.completed || !hasCompletedProfessorOnboarding)
  ) {
    return <Navigate to="/professor/setup" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/professor/dashboard',
    element: (
      <ProtectedRoute allowedRole="professor" requireSetupComplete>
        <ProfessorDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/professor/setup',
    element: (
      <ProtectedRoute allowedRole="professor">
        <ProfessorSetupPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/professor/profile',
    element: (
      <ProtectedRoute allowedRole="professor" requireSetupComplete>
        <ProfessorProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/sso',
    element: <SsoPage />,
  },
  {
    path: '/student/dashboard',
    element: (
      <ProtectedRoute allowedRole="student" requireSetupComplete>
        <StudentDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/student/setup',
    element: (
      <ProtectedRoute allowedRole="student">
        <StudentSetupPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/student/research/:postingId',
    element: (
      <ProtectedRoute allowedRole="student" requireSetupComplete>
        <StudentResearchDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

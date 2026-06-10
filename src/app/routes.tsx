import { createBrowserRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import SsoPage from './pages/SsoPage';
import ProfessorDashboard from './pages/professor/ProfessorDashboard';
import ApplicantReasoningPage from './pages/professor/ApplicantReasoningPage';
import ProfessorSetupPage from './pages/professor/ProfessorSetupPage';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentRecommendationReasoningPage from './pages/student/StudentRecommendationReasoningPage';
import StudentResearchDetailPage from './pages/student/StudentResearchDetailPage';
import StudentSetupPage from './pages/student/StudentSetupPage';
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard';
import CandidateProfilePage from './pages/recruiter/CandidateProfilePage';
import DeanDashboard from './pages/dean/DeanDashboard';
import { useAuth } from './contexts/AuthContext';
import type { UserRole } from './lib/api';

function dashboardPathForRole(role: UserRole) {
  if (role === 'professor') return '/professor/dashboard';
  if (role === 'student') return '/student/dashboard';
  if (role === 'recruiter') return '/recruiter/dashboard';
  return '/dean/dashboard';
}

function ProtectedRoute({
  children,
  allowedRole,
  requireSetupComplete = false,
}: {
  children: React.ReactNode;
  allowedRole?: UserRole;
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
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
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
    path: '/professor/applicant-insights/:applicantId',
    element: (
      <ProtectedRoute allowedRole="professor" requireSetupComplete>
        <ApplicantReasoningPage />
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
    path: '/sso',
    element: <SsoPage />,
  },
  {
    path: '/recruiter/dashboard',
    element: (
      <ProtectedRoute allowedRole="recruiter">
        <RecruiterDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/recruiter/candidates/:candidateId',
    element: (
      <ProtectedRoute allowedRole="recruiter">
        <CandidateProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dean/dashboard',
    element: (
      <ProtectedRoute allowedRole="dean">
        <DeanDashboard />
      </ProtectedRoute>
    ),
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
    path: '/student/recommendations/:postingId/reasoning',
    element: (
      <ProtectedRoute allowedRole="student" requireSetupComplete>
        <StudentRecommendationReasoningPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

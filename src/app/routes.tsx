import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './contexts/AuthContext';
import type { UserRole } from './lib/api';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SsoPage = lazy(() => import('./pages/SsoPage'));
const ProfessorDashboard = lazy(() => import('./pages/professor/ProfessorDashboard'));
const ApplicantReasoningPage = lazy(() => import('./pages/professor/ApplicantReasoningPage'));
const ProfessorSetupPage = lazy(() => import('./pages/professor/ProfessorSetupPage'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentRecommendationReasoningPage = lazy(() => import('./pages/student/StudentRecommendationReasoningPage'));
const StudentResearchDetailPage = lazy(() => import('./pages/student/StudentResearchDetailPage'));
const StudentSetupPage = lazy(() => import('./pages/student/StudentSetupPage'));
const RecruiterDashboard = lazy(() => import('./pages/recruiter/RecruiterDashboard'));
const CandidateProfilePage = lazy(() => import('./pages/recruiter/CandidateProfilePage'));
const DeanDashboard = lazy(() => import('./pages/dean/DeanDashboard'));

function dashboardPathForRole(role: UserRole) {
  if (role === 'professor') return '/professor/dashboard';
  if (role === 'student') return '/student/dashboard';
  if (role === 'recruiter') return '/recruiter/dashboard';
  return '/dean/dashboard';
}

function PageFallback() {
  return <div className="min-h-screen bg-gray-50" />;
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function ProtectedRoute({
  children,
  allowedRole,
  requireSetupComplete = false,
}: {
  children: ReactNode;
  allowedRole?: UserRole;
  requireSetupComplete?: boolean;
}) {
  const { user, setupState, loadingSession } = useAuth();

  if (loadingSession) {
    return <PageFallback />;
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
    !setupState?.completed
  ) {
    return <Navigate to="/student/setup" replace />;
  }

  if (
    requireSetupComplete &&
    user.role === 'professor' &&
    !setupState?.completed
  ) {
    return <Navigate to="/professor/setup" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <LazyPage>
        <LoginPage />
      </LazyPage>
    ),
  },
  {
    path: '/professor/dashboard',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="professor" requireSetupComplete>
          <ProfessorDashboard />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/professor/applicant-insights/:applicantId',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="professor" requireSetupComplete>
          <ApplicantReasoningPage />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/professor/setup',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="professor">
          <ProfessorSetupPage />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/sso',
    element: (
      <LazyPage>
        <SsoPage />
      </LazyPage>
    ),
  },
  {
    path: '/recruiter/dashboard',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="recruiter">
          <RecruiterDashboard />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/recruiter/dashboard/:tabId',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="recruiter">
          <RecruiterDashboard />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/recruiter/candidates/:candidateId',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="recruiter">
          <CandidateProfilePage />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/dean/dashboard',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="dean">
          <DeanDashboard />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/dean/dashboard/:tabId',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="dean">
          <DeanDashboard />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/student/dashboard',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="student" requireSetupComplete>
          <StudentDashboard />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/student/setup',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="student">
          <StudentSetupPage />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/student/research/:postingId',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="student" requireSetupComplete>
          <StudentResearchDetailPage />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '/student/recommendations/:postingId/reasoning',
    element: (
      <LazyPage>
        <ProtectedRoute allowedRole="student" requireSetupComplete>
          <StudentRecommendationReasoningPage />
        </ProtectedRoute>
      </LazyPage>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

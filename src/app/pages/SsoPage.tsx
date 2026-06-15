import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

export default function SsoPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const role =
    roleParam === 'student' || roleParam === 'professor' || roleParam === 'recruiter' || roleParam === 'dean'
      ? roleParam
      : null;
  const navigate = useNavigate();
  const { login } = useAuth();

  const heading = useMemo(() => {
    if (role === 'student') {
      return 'CMU SSO: Student Login';
    }
    if (role === 'professor') {
      return 'CMU SSO: Professor Login';
    }
    if (role === 'recruiter') {
      return 'CMU SSO: Recruiter Login';
    }
    if (role === 'dean') {
      return 'CMU SSO: Dean Login';
    }
    return 'CMU SSO';
  }, [role]);

  useEffect(() => {
    if (!role) {
      toast.error('Role is missing. Please select a role again.');
      navigate('/');
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const profileByRole = {
          student: {
            email: 'student.demo@andrew.cmu.edu',
            name: 'CMU Student Demo',
          },
          professor: {
            email: 'professor.demo@andrew.cmu.edu',
            name: 'CMU Professor Demo',
          },
          recruiter: {
            email: 'recruiter.demo@andrew.cmu.edu',
            name: 'CMU Recruiter Demo',
          },
          dean: {
            email: 'dean.demo@andrew.cmu.edu',
            name: 'CMU Dean Demo',
          },
        } as const;

        const profile = profileByRole[role];
        const { user, setup } = await login(profile.email, profile.name, role);

        if (user.role === 'student') {
          navigate(
            setup.completed ? '/student/dashboard' : '/student/setup',
            { replace: true }
          );
          return;
        }

        if (user.role === 'recruiter') {
          navigate('/recruiter/dashboard', { replace: true });
          return;
        }

        if (user.role === 'dean') {
          navigate('/dean/dashboard', { replace: true });
          return;
        }

        navigate(
          setup.completed ? '/professor/dashboard' : '/professor/setup',
          { replace: true }
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'SSO redirect failed');
        navigate('/');
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [login, navigate, role]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-red-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{heading}</CardTitle>
          <CardDescription>
            Redirecting to CMU SSO and returning you to your dashboard...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
            Demo mode: this simulates CMU SSO automatically.
          </div>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            Back to role selection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

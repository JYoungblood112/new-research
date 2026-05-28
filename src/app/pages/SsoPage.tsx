import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

export default function SsoPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const role = roleParam === 'student' || roleParam === 'professor' ? roleParam : null;
  const navigate = useNavigate();
  const { login } = useAuth();

  const heading = useMemo(() => {
    if (role === 'student') {
      return 'CMU SSO: Student Login';
    }
    if (role === 'professor') {
      return 'CMU SSO: Professor Login';
    }
    return 'CMU SSO';
  }, [role]);

  useEffect(() => {
    if (!role) {
      toast.error('Role is missing. Please select Student or Professor again.');
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
        } as const;

        const profile = profileByRole[role];
        const user = await login(profile.email, profile.name, role);
        navigate(user.role === 'professor' ? '/professor/dashboard' : '/student/dashboard');
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

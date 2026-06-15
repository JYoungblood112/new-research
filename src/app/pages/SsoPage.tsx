import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type AuthMode = 'login' | 'signup';

function getDashboardPath(role: UserRole, setupCompleted: boolean) {
  if (role === 'student') {
    return setupCompleted ? '/student/dashboard' : '/student/setup';
  }
  if (role === 'professor') {
    return setupCompleted ? '/professor/dashboard' : '/professor/setup';
  }
  if (role === 'recruiter') {
    return '/recruiter/dashboard';
  }
  return '/dean/dashboard';
}

export default function SsoPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const role =
    roleParam === 'student' || roleParam === 'professor' || roleParam === 'recruiter' || roleParam === 'dean'
      ? roleParam
      : null;
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const heading = useMemo(() => {
    if (role === 'student') return 'Student Login';
    if (role === 'professor') return 'Professor Login';
    if (role === 'recruiter') return 'Recruiter Login';
    if (role === 'dean') return 'Dean Login';
    return 'CMU Research Portal';
  }, [role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setConfirmationNotice(null);

    if (!role) {
      setError('Role is missing. Please select a role again.');
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Enter your full name.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const result = await signup({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
        });

        if (result.needsEmailConfirmation) {
          setConfirmationNotice('Check your email to confirm your account, then return here to sign in.');
          return;
        }

        if (result.user && result.setup) {
          toast.success('Account created');
          navigate(getDashboardPath(result.user.role, result.setup.completed), { replace: true });
          return;
        }
      }

      const result = await login(email.trim(), password, role);
      navigate(getDashboardPath(result.user.role, result.setup.completed), { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-red-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{heading}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Sign in with your Supabase-backed account.'
              : 'Create your account and profile for this role.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-gray-50 p-1">
            <Button
              type="button"
              variant={mode === 'login' ? 'default' : 'ghost'}
              className="w-full"
              onClick={() => {
                setMode('login');
                setError(null);
                setConfirmationNotice(null);
              }}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === 'signup' ? 'default' : 'ghost'}
              className="w-full"
              onClick={() => {
                setMode('signup');
                setError(null);
                setConfirmationNotice(null);
              }}
            >
              Sign up
            </Button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Researcher"
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@andrew.cmu.edu"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                {error}
              </div>
            ) : null}

            {confirmationNotice ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                {confirmationNotice}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || !role}>
              {isSubmitting ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
            </Button>
          </form>

          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            Back to role selection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

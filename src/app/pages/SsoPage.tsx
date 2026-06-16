import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type AuthMode = 'login' | 'signup';

type SavedLogin = {
  email: string;
  role: UserRole;
  savedAt: string;
};

const SAVED_LOGINS_STORAGE_KEY = 'cmu_research_saved_logins';

function readSavedLogins(): SavedLogin[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_LOGINS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is SavedLogin =>
            typeof entry?.email === 'string' &&
            ['student', 'professor', 'recruiter', 'dean'].includes(entry?.role)
        )
      : [];
  } catch {
    return [];
  }
}

function writeSavedLogins(logins: SavedLogin[]) {
  window.localStorage.setItem(SAVED_LOGINS_STORAGE_KEY, JSON.stringify(logins));
}

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

function getAuthErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
  const message = rawMessage.trim();

  if (/invalid login credentials/i.test(message) || /authentication failed/i.test(message)) {
    return 'Email or password is incorrect. Re-enter your password or create the account again from Sign up.';
  }

  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email address first, then come back and log in.';
  }

  if (/supabase is not configured/i.test(message)) {
    return message;
  }

  if (/setup_completed/i.test(message)) {
    return 'Your login worked, but the Supabase setup_completed migration has not been applied yet.';
  }

  return message || 'Login failed. Please check your email and password.';
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
  const [rememberLogin, setRememberLogin] = useState(false);
  const [savedLogins, setSavedLogins] = useState<SavedLogin[]>([]);
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

  const savedLoginsForRole = useMemo(
    () => savedLogins.filter((login) => login.role === role),
    [role, savedLogins]
  );

  useEffect(() => {
    setSavedLogins(readSavedLogins());
  }, []);

  const saveCurrentLogin = () => {
    if (!role || !email.trim()) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const nextLogin: SavedLogin = {
      email: normalizedEmail,
      role,
      savedAt: new Date().toISOString(),
    };
    const nextLogins = [
      nextLogin,
      ...savedLogins.filter(
        (login) => !(login.role === role && login.email.toLowerCase() === normalizedEmail)
      ),
    ].slice(0, 8);

    writeSavedLogins(nextLogins);
    setSavedLogins(nextLogins);
  };

  const removeSavedLogin = (loginToRemove: SavedLogin) => {
    const nextLogins = savedLogins.filter(
      (login) =>
        !(
          login.role === loginToRemove.role &&
          login.email.toLowerCase() === loginToRemove.email.toLowerCase()
        )
    );
    writeSavedLogins(nextLogins);
    setSavedLogins(nextLogins);
    if (email.toLowerCase() === loginToRemove.email.toLowerCase()) {
      setRememberLogin(false);
    }
  };

  const selectSavedLogin = (savedLogin: SavedLogin) => {
    setMode('login');
    setEmail(savedLogin.email);
    setPassword('');
    setRememberLogin(true);
    setError(null);
    setConfirmationNotice(null);
  };

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
      if (rememberLogin) {
        saveCurrentLogin();
      }
      navigate(getDashboardPath(result.user.role, result.setup.completed), { replace: true });
    } catch (authError) {
      if (import.meta.env.DEV) {
        console.error('Login error', authError);
      }
      setError(getAuthErrorMessage(authError));
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
            {mode === 'login' && savedLoginsForRole.length > 0 ? (
              <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">Saved logins</p>
                <div className="space-y-2">
                  {savedLoginsForRole.map((savedLogin) => (
                    <div
                      key={`${savedLogin.role}-${savedLogin.email}`}
                      className="flex items-center gap-2 rounded-lg border bg-white p-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => selectSavedLogin(savedLogin)}
                      >
                        <span className="block truncate text-sm font-medium text-gray-900">{savedLogin.email}</span>
                        <span className="text-xs text-gray-500">Click to fill email</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-gray-500 hover:text-red-700"
                        onClick={() => removeSavedLogin(savedLogin)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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

            {mode === 'login' ? (
              <label className="flex items-start gap-2 rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                />
                <span>
                  Save this email on this device so it can be selected next time.
                </span>
              </label>
            ) : null}

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

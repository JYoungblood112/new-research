import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import StudentProfile from '../../components/student/StudentProfile';

export default function StudentSetupPage() {
  const { user, setupState } = useAuth();
  const navigate = useNavigate();

  const onboardingKey = user ? `student_onboarding_${user.id}` : null;
  const onboardingDone = onboardingKey ? localStorage.getItem(onboardingKey) === 'true' : false;

  useEffect(() => {
    if (setupState?.completed && onboardingDone) {
      navigate('/student/dashboard', { replace: true });
    }
  }, [navigate, onboardingDone, setupState?.completed]);

  const handleContinue = () => {
    if (!onboardingKey) {
      return;
    }
    localStorage.setItem(onboardingKey, 'true');
    navigate('/student/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#eeecea]">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Card className="mb-5 border-[#ead8ce] bg-[#f8f1ec] shadow-none">
          <CardHeader>
            <CardTitle>Complete Your Setup</CardTitle>
            <CardDescription>
              Welcome {user?.name}. Please complete your profile and upload your resume before entering
              the student portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[#8a4d3a]">
            You only need to do this once. After setup is complete, the Profile page is for updating your
            information.
          </CardContent>
        </Card>

        <StudentProfile mode="setup" onSetupComplete={handleContinue} />
      </main>
    </div>
  );
}

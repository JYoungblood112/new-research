import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import StudentProfile from '../../components/student/StudentProfile';
import StudentResearchInterestsStep from '../../components/student/StudentResearchInterestsStep';

export default function StudentSetupPage() {
  const { user, setupState } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'profile' | 'interests'>('profile');

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
            <CardTitle>{step === 'profile' ? 'Complete Your Profile' : 'Choose Research Interests'}</CardTitle>
            <CardDescription>
              {step === 'profile'
                ? `Welcome ${user?.name}. First, complete your profile and upload your resume.`
                : `Great progress, ${user?.name}. Now choose at least 1 sub-genre to continue.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[#8a4d3a]">
            Step {step === 'profile' ? '1 of 2' : '2 of 2'} - You only need this flow once. After setup,
            you can edit everything from your profile page.
          </CardContent>
        </Card>

        {step === 'profile' ? (
          <StudentProfile
            mode="setup"
            includeInterestsSection={false}
            setupSubmitLabel="Next: Research Interests"
            onSetupComplete={() => {
              setStep('interests');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          <StudentResearchInterestsStep
            onBack={() => {
              setStep('profile');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onContinue={handleContinue}
          />
        )}
      </main>
    </div>
  );
}

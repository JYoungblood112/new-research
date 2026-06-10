import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', "Master's", 'PhD'];

interface WelcomeDialogProps {
  onComplete: () => void;
}

export default function WelcomeDialog({ onComplete }: WelcomeDialogProps) {
  const { user, updateStudentProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'welcome' | 'profile' | 'resume'>('welcome');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [gpa, setGpa] = useState('');
  const [skills, setSkills] = useState('');

  useEffect(() => {
    // Check if this is the first time the student is logging in
    const hasCompletedOnboarding = localStorage.getItem(`onboarding_${user?.id}`);

    if (!hasCompletedOnboarding && user?.role === 'student') {
      setOpen(true);
    }
  }, [user]);

  const handleProfileSubmit = () => {
    if (!major.trim() || !year) {
      toast.error('Please fill in your major and academic year');
      return;
    }

    updateStudentProfile({
      major: major.trim(),
      graduationYear: year,
      skills: skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });

    setStep('resume');
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.name.endsWith('.pdf')) {
        toast.error('Only PDF files are accepted');
        return;
      }

      updateStudentProfile({
        resume: {
          name: file.name,
          uploadDate: new Date().toISOString(),
        },
      });

      toast.success('Profile completed successfully!');
      handleComplete();
    }
  };

  const handleSkipResume = () => {
    toast.info('You can upload your resume later from the Profile tab');
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(`onboarding_${user?.id}`, 'true');
    setOpen(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleSkipResume()}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        {step === 'welcome' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Welcome to CMU Research Portal!</DialogTitle>
              <DialogDescription>
                Let's set up your profile so you can start applying to research opportunities
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0 text-4xl">🎓</div>
                <div className="flex-1">
                  <h3 className="font-medium mb-1">Complete Your Profile</h3>
                  <p className="text-sm text-gray-600">
                    Professors want to know about your background, skills, and experience. A
                    complete profile helps you stand out!
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Add your academic information</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">List your skills and interests</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Upload your resume</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleSkipResume}>
                  Skip for now
                </Button>
                <Button onClick={() => setStep('profile')}>Get Started</Button>
              </div>
            </div>
          </>
        )}

        {step === 'profile' && (
          <>
            <DialogHeader>
              <DialogTitle>Tell us about yourself</DialogTitle>
              <DialogDescription>
                This information helps professors understand your background
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="major">
                    Major <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="major"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Computer Science"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gpa">GPA (Optional)</Label>
                <Input
                  id="gpa"
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                  placeholder="3.8"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Python, Machine Learning, React"
                />
                <p className="text-xs text-gray-500">
                  List programming languages, frameworks, and relevant skills
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep('welcome')}>
                  Back
                </Button>
                <Button onClick={handleProfileSubmit}>Continue</Button>
              </div>
            </div>
          </>
        )}

        {step === 'resume' && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Your Resume</DialogTitle>
              <DialogDescription>
                A resume is required to apply to research opportunities
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {studentProfile?.resume ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm">{studentProfile.resume.name}</p>
                      <p className="text-xs text-gray-500">Resume uploaded successfully!</p>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="onboarding-resume-upload"
                  className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer transition-colors"
                >
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Click to upload resume</p>
                  <p className="text-xs text-gray-500">PDF only, max 5MB</p>
                </label>
              )}
              <input
                id="onboarding-resume-upload"
                type="file"
                accept=".pdf"
                onChange={handleResumeUpload}
                className="hidden"
              />

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  💡 <strong>Tip:</strong> Make sure your resume includes your contact
                  information, relevant coursework, projects, and any prior research experience.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleSkipResume}>
                  Skip for now
                </Button>
                {studentProfile?.resume && (
                  <Button onClick={handleComplete}>Complete Setup</Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

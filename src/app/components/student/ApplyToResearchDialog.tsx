import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { FileText, Calendar, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ApplyToResearchDialogProps {
  postingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export default function ApplyToResearchDialog({
  postingId,
  open,
  onOpenChange,
}: ApplyToResearchDialogProps) {
  const { user, setupState } = useAuth();
  const { postings, addApplication, getApplicationsByStudent } = useData();
  const posting = postings.find((p) => p.id === postingId);
  const studentProfile = setupState?.profile as
    | {
        resume?: { name: string; uploadDate: string } | null;
      }
    | undefined;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [resumeNameOverride, setResumeNameOverride] = useState<string | null>(null);

  const existingApplications = getApplicationsByStudent(user!.id);
  const alreadyApplied = existingApplications.some((app) => app.postingId === postingId);

  const handleSubmit = () => {
    if (!setupState?.completed || !studentProfile?.resume) {
      toast.error('Complete student setup (profile, resume, skills) before applying.');
      return;
    }

    if (posting?.questions) {
      const unanswered = posting.questions.filter((q) => !answers[q.question]?.trim());
      if (unanswered.length > 0) {
        toast.error('Please answer all questions');
        return;
      }

      // Check word limits
      const exceedingLimit = posting.questions.filter((q) => {
        if (q.wordLimit) {
          const wordCount = countWords(answers[q.question] || '');
          return wordCount > q.wordLimit;
        }
        return false;
      });

      if (exceedingLimit.length > 0) {
        toast.error('Some answers exceed the word limit');
        return;
      }
    }

    addApplication({
      postingId: posting!.id,
      studentId: user!.id,
      studentName: user!.name,
      studentEmail: user!.email,
      studentMajor: (setupState?.profile as { major?: string } | null)?.major ?? 'Undeclared',
      resume: {
        ...studentProfile!.resume!,
        name: resumeNameOverride ?? studentProfile!.resume!.name,
      },
      answers: posting?.questions ? answers : undefined,
      quickNote: note.trim(),
      status: 'Pending',
    });

    toast.success('Application submitted successfully!');
    onOpenChange(false);
    setAnswers({});
    setNote('');
  };

  if (!posting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply to Research Opportunity</DialogTitle>
          <DialogDescription>
            Submit your application and materials for this research position
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h3 className="text-lg">{posting.title}</h3>
              <p className="text-sm text-gray-600">{posting.professorName}</p>
              <div className="flex gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {posting.duration}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Deadline: {new Date(posting.applicationDeadline).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {alreadyApplied ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm">You have already applied to this position.</p>
                <p className="text-sm text-gray-600">
                  Check the "My Applications" tab to track your application status.
                </p>
              </div>
            </div>
          ) : !studentProfile?.resume ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm">Please upload your resume in your profile before applying.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Your Resume
                </Label>
                <div className="p-3 bg-gray-50 rounded text-sm">
                  {resumeNameOverride ?? studentProfile.resume.name}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    if (!file.name.toLowerCase().endsWith('.pdf')) {
                      toast.error('Resume override must be a PDF file.');
                      return;
                    }
                    setResumeNameOverride(file.name);
                  }}
                  className="text-sm"
                />
              </div>

              {posting.questions && posting.questions.length > 0 && (
                <div className="space-y-3">
                  <Label>Application Questions</Label>
                  {posting.questions.map((q, index) => {
                    const answer = answers[q.question] || '';
                    const wordCount = countWords(answer);
                    const isOverLimit = q.wordLimit && wordCount > q.wordLimit;

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-start justify-between">
                          <Label className="text-sm flex-1">{q.question}</Label>
                          {q.wordLimit && (
                            <span
                              className={`text-xs ${
                                isOverLimit ? 'text-red-600' : 'text-gray-500'
                              }`}
                            >
                              {wordCount}/{q.wordLimit} words
                            </span>
                          )}
                        </div>
                        <Textarea
                          value={answer}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.question]: e.target.value })
                          }
                          placeholder="Your answer..."
                          rows={3}
                          className={isOverLimit ? 'border-red-500' : ''}
                        />
                        {isOverLimit && (
                          <p className="text-xs text-red-600">
                            Answer exceeds word limit by {wordCount - q.wordLimit!} words
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Label>Quick Note to Professor (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Briefly explain your fit and motivation for this project."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>Submit Application</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

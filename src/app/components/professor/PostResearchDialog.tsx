import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData, ApplicationQuestion, ResearchPosting } from '../../contexts/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PlusCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface PostResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postingToEdit?: ResearchPosting | null;
}

const CATEGORIES = [
  'Machine Learning',
  'Human-Computer Interaction',
  'Robotics',
  'Computer Systems',
  'Cybersecurity',
  'Software Engineering',
  'Natural Language Processing',
  'Computer Vision',
  'Computational Biology',
  'Other',
];

const COMPENSATION_OPTIONS: Array<ResearchPosting['compensation']> = [
  'stipend',
  'volunteer',
  'course credit',
  'tbd',
];

export default function PostResearchDialog({
  open,
  onOpenChange,
  postingToEdit,
}: PostResearchDialogProps) {
  const { user, setupState } = useAuth();
  const { addPosting, updatePosting } = useData();
  const isEditing = !!postingToEdit;
  const [step, setStep] = useState(1);
  const professorProfile = (setupState?.profile as { department?: string; bioUrl?: string } | null) ?? null;

  const [category, setCategory] = useState(postingToEdit?.category ?? '');
  const [title, setTitle] = useState(postingToEdit?.title ?? '');
  const [overview, setOverview] = useState(postingToEdit?.overview ?? '');
  const [professorBioUrl, setProfessorBioUrl] = useState(postingToEdit?.professorBioUrl ?? professorProfile?.bioUrl ?? '');
  const [studentRoleDescription, setStudentRoleDescription] = useState(postingToEdit?.studentRoleDescription ?? '');
  const [studentGain, setStudentGain] = useState(postingToEdit?.studentGain ?? '');
  const [requiredQualifications, setRequiredQualifications] = useState(postingToEdit?.requiredQualifications ?? '');
  const [preferredQualifications, setPreferredQualifications] = useState(postingToEdit?.preferredQualifications ?? '');
  const [timeCommitmentExpected, setTimeCommitmentExpected] = useState(postingToEdit?.timeCommitmentExpected ?? '');
  const [startDate, setStartDate] = useState(postingToEdit?.startDate ?? '');
  const [endDate, setEndDate] = useState(postingToEdit?.duration ?? '');
  const [applicationDeadline, setApplicationDeadline] = useState(postingToEdit?.applicationDeadline ?? '');
  const [compensation, setCompensation] = useState<ResearchPosting['compensation']>(postingToEdit?.compensation ?? 'tbd');
  const [questions, setQuestions] = useState<ApplicationQuestion[]>(postingToEdit?.questions ?? []);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentWordLimit, setCurrentWordLimit] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    if (postingToEdit) {
      setStep(1);
      setCategory(postingToEdit.category ?? '');
      setTitle(postingToEdit.title ?? '');
      setOverview(postingToEdit.overview ?? '');
      setProfessorBioUrl(postingToEdit.professorBioUrl ?? professorProfile?.bioUrl ?? '');
      setStudentRoleDescription(postingToEdit.studentRoleDescription ?? '');
      setStudentGain(postingToEdit.studentGain ?? '');
      setRequiredQualifications(postingToEdit.requiredQualifications ?? '');
      setPreferredQualifications(postingToEdit.preferredQualifications ?? '');
      setTimeCommitmentExpected(postingToEdit.timeCommitmentExpected ?? '');
      setStartDate(postingToEdit.startDate ?? '');
      setEndDate(postingToEdit.duration ?? '');
      setApplicationDeadline(postingToEdit.applicationDeadline ?? '');
      setCompensation(postingToEdit.compensation ?? 'tbd');
      setQuestions(postingToEdit.questions ?? []);
      setCurrentQuestion('');
      setCurrentWordLimit('');
      return;
    }

    resetForm();
  }, [open, postingToEdit]);

  const handleAddQuestion = () => {
    if (currentQuestion.trim()) {
      const wordLimit = currentWordLimit.trim() ? parseInt(currentWordLimit) : undefined;
      setQuestions([
        ...questions,
        {
          question: currentQuestion.trim(),
          wordLimit: wordLimit && wordLimit > 0 ? wordLimit : undefined,
        },
      ]);
      setCurrentQuestion('');
      setCurrentWordLimit('');
    }
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!setupState?.completed) {
      toast.error('Complete professor setup before posting a project');
      return;
    }

    const requiredFieldChecks: Array<{ label: string; valid: boolean }> = [
      { label: 'Category', valid: Boolean(category) },
      { label: 'Project Title', valid: Boolean(title.trim()) },
      { label: 'Overview / Description', valid: Boolean(overview.trim()) },
      { label: 'Student Role Description', valid: Boolean(studentRoleDescription.trim()) },
      { label: 'What the Student Will Gain', valid: Boolean(studentGain.trim()) },
      { label: 'Required Qualifications', valid: Boolean(requiredQualifications.trim()) },
      { label: 'Preferred Qualifications', valid: Boolean(preferredQualifications.trim()) },
      { label: 'Expected Time Commitment', valid: Boolean(timeCommitmentExpected.trim()) },
      { label: 'Start Date', valid: Boolean(startDate) },
      { label: 'End Date', valid: Boolean(endDate) },
      { label: 'Application Deadline', valid: Boolean(applicationDeadline) },
    ];

    const missingFields = requiredFieldChecks
      .filter((field) => !field.valid)
      .map((field) => field.label);

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    if (questions.length < 1 || questions.length > 4) {
      toast.error('Please include between 1 and 4 application questions.');
      return;
    }

    const payload = {
      professorId: user!.id,
      professorName: user!.name,
      professorEmail: user!.email,
      professorBioUrl: professorBioUrl.trim() || undefined,
      professorDepartment: professorProfile?.department ?? 'Unknown Department',
      category,
      title,
      overview,
      studentRoleDescription,
      studentGain,
      requiredQualifications,
      preferredQualifications,
      timeCommitmentExpected,
      startDate,
      duration: endDate,
      applicationDeadline,
      compensation,
      questions,
      status: 'published' as const,
    };

    if (isEditing && postingToEdit) {
      updatePosting(postingToEdit.id, payload);
      toast.success('Research posting updated successfully!');
    } else {
      addPosting(payload);
      toast.success('Research opportunity posted successfully!');
    }

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setCategory('');
    setTitle('');
    setOverview('');
    setProfessorBioUrl(professorProfile?.bioUrl ?? '');
    setStudentRoleDescription('');
    setStudentGain('');
    setRequiredQualifications('');
    setPreferredQualifications('');
    setTimeCommitmentExpected('');
    setStartDate('');
    setEndDate('');
    setApplicationDeadline('');
    setCompensation('tbd');
    setQuestions([]);
    setCurrentQuestion('');
    setCurrentWordLimit('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Research Posting' : 'Post Research Opportunity'}</DialogTitle>
          <DialogDescription>
            Step {step} of 4
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overview">Overview / Description *</Label>
                <Textarea id="overview" rows={4} value={overview} onChange={(e) => setOverview(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="professorBioUrl">Professor Bio URL</Label>
                <Input
                  id="professorBioUrl"
                  type="url"
                  placeholder="https://..."
                  value={professorBioUrl}
                  onChange={(e) => setProfessorBioUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Student Role Description *</Label>
                <Textarea
                  id="role"
                  rows={3}
                  value={studentRoleDescription}
                  onChange={(e) => setStudentRoleDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gain">What the Student Will Gain *</Label>
                <Textarea id="gain" rows={3} value={studentGain} onChange={(e) => setStudentGain(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Required Qualifications *</Label>
                <Textarea rows={3} value={requiredQualifications} onChange={(e) => setRequiredQualifications(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Preferred Qualifications *</Label>
                <Textarea rows={3} value={preferredQualifications} onChange={(e) => setPreferredQualifications(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expected Time Commitment *</Label>
                <Input value={timeCommitmentExpected} onChange={(e) => setTimeCommitmentExpected(e.target.value)} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Application Deadline *</Label>
                <Input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Compensation *</Label>
                <Select value={compensation} onValueChange={(value) => setCompensation(value as ResearchPosting['compensation'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPENSATION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <Label>Application Questions * (up to 4)</Label>
              <div className="space-y-2">
                {questions.map((q, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-gray-50 rounded">
                      <p className="text-sm">{q.question}</p>
                      {q.wordLimit && <p className="text-xs text-gray-500 mt-1">Word limit: {q.wordLimit}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveQuestion(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="space-y-2">
                  <Input
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    placeholder="Add a question for applicants..."
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddQuestion()}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={currentWordLimit}
                      onChange={(e) => setCurrentWordLimit(e.target.value)}
                      placeholder="Word limit (optional)"
                      className="w-48"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                    />
                    <Button onClick={handleAddQuestion} variant="outline" className="flex-shrink-0" disabled={questions.length >= 4}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Question
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={() => setStep((current) => current + 1)}>Next</Button>
            ) : (
              <Button onClick={handleSubmit}>{isEditing ? 'Save Changes' : 'Post Research Opportunity'}</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

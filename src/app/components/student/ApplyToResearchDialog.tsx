import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { BookOpen, FileText, Calendar, Clock, AlertCircle, AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ApplyToResearchDialogProps {
  postingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (postingId: string) => void;
}

const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

type FitRecommendation = 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit' | null;

type RequirementAssessment = {
  requirement: string;
  importance: 'required' | 'preferred';
  support: 'strong' | 'partial' | 'none';
  sources: string[];
  evidence: string;
  gap: string;
};

type FitScore = {
  postingId: string;
  confidence: number;
  reason: string;
  score_breakdown: {
    base_score: number;
    github_bonus: number;
    github_available: boolean;
    github_sparse: boolean;
    linkedin_bonus: number;
    linkedin_available: boolean;
    linkedin_sparse: boolean;
  } | null;
  qualifications: string[];
  fit_reasoning: string[];
  gaps: string[];
  recommendation: FitRecommendation;
  requirement_assessments: RequirementAssessment[];
};

type FitStatus = 'idle' | 'loading' | 'ready' | 'error';

function toDisplayPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function getFitBadgeClass(value: FitRecommendation) {
  if (value === 'Strong Fit') {
    return 'border-green-200 bg-green-50 text-green-700 hover:bg-green-50';
  }
  if (value === 'Good Fit') {
    return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50';
  }
  if (value === 'Possible Fit') {
    return 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50';
  }
  return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50';
}

function getSupportMeta(support: RequirementAssessment['support']) {
  if (support === 'strong') {
    return {
      label: 'Strong',
      badge: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-50',
      icon: <CheckCircle2 className="h-4 w-4 text-green-700" />,
    };
  }
  if (support === 'partial') {
    return {
      label: 'Partial',
      badge: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50',
      icon: <AlertTriangle className="h-4 w-4 text-amber-700" />,
    };
  }
  return {
    label: 'Missing',
    badge: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50',
    icon: <AlertTriangle className="h-4 w-4 text-red-700" />,
  };
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function formatCourseworkEntry(course: string | { courseNumber?: string; courseName?: string; semester?: string }) {
  if (typeof course === 'string') {
    return course.trim();
  }

  const courseNumber = course.courseNumber?.trim();
  const courseName = course.courseName?.trim();
  return [courseNumber, courseName].filter(Boolean).join(' - ');
}

function normalizeFitScore(item: Record<string, any>): FitScore {
  const recommendationValue = item?.recommendation;
  const recommendation =
    recommendationValue === 'Strong Fit' ||
    recommendationValue === 'Good Fit' ||
    recommendationValue === 'Possible Fit' ||
    recommendationValue === 'Weak Fit'
      ? recommendationValue
      : null;

  const requirementAssessments = Array.isArray(item?.requirement_assessments)
    ? item.requirement_assessments
        .map((entry: Record<string, unknown>) => {
          const support = entry?.support === 'strong' || entry?.support === 'partial' || entry?.support === 'none' ? entry.support : 'none';
          const importance = entry?.importance === 'preferred' ? 'preferred' : 'required';
          return {
            requirement: String(entry?.requirement ?? '').trim(),
            importance,
            support,
            sources: toStringList(entry?.sources),
            evidence: String(entry?.evidence ?? '').trim(),
            gap: String(entry?.gap ?? '').trim(),
          };
        })
        .filter((entry: RequirementAssessment) => entry.requirement.length > 0)
    : [];

  return {
    postingId: String(item?.postingId ?? ''),
    confidence: Number(item?.confidence ?? 0),
    reason: typeof item?.reason === 'string' ? item.reason : '',
    score_breakdown:
      item?.score_breakdown && typeof item.score_breakdown === 'object'
        ? {
            base_score: Number(item.score_breakdown.base_score ?? 0),
            github_bonus: Number(item.score_breakdown.github_bonus ?? 0),
            github_available: Boolean(item.score_breakdown.github_available),
            github_sparse: Boolean(item.score_breakdown.github_sparse),
            linkedin_bonus: Number(item.score_breakdown.linkedin_bonus ?? 0),
            linkedin_available: Boolean(item.score_breakdown.linkedin_available),
            linkedin_sparse: Boolean(item.score_breakdown.linkedin_sparse),
          }
        : null,
    qualifications: toStringList(item?.qualifications),
    fit_reasoning: toStringList(item?.fit_reasoning),
    gaps: toStringList(item?.gaps),
    recommendation,
    requirement_assessments: requirementAssessments,
  };
}

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with ${response.status}`);
  }

  return payload;
}

async function getAuthHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  return data.session?.access_token
    ? {
        Authorization: `Bearer ${data.session.access_token}`,
      }
    : undefined;
}

export default function ApplyToResearchDialog({
  postingId,
  open,
  onOpenChange,
  onSubmitted,
}: ApplyToResearchDialogProps) {
  const navigate = useNavigate();
  const { user, setupState } = useAuth();
  const { postings, addApplication, getApplicationsByStudent } = useData();
  const posting = postings.find((p) => p.id === postingId);
  const studentProfile = setupState?.profile as
    | {
        resume?: { name: string; uploadDate: string } | null;
        coursework?: Array<string | { courseNumber?: string; courseName?: string; semester?: string }>;
      }
    | undefined;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [resumeNameOverride, setResumeNameOverride] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fitScore, setFitScore] = useState<FitScore | null>(null);
  const [fitStatus, setFitStatus] = useState<FitStatus>('idle');
  const [fitError, setFitError] = useState('');
  const fitPollRef = useRef<{ intervalId: number; timeoutId: number } | null>(null);

  const existingApplications = getApplicationsByStudent(user?.id ?? '');
  const alreadyApplied = existingApplications.some((app) => app.postingId === postingId);
  const quickNoteEnabled = posting?.quickNoteEnabled ?? true;

  const stopFitPolling = () => {
    if (!fitPollRef.current) {
      return;
    }

    window.clearInterval(fitPollRef.current.intervalId);
    window.clearTimeout(fitPollRef.current.timeoutId);
    fitPollRef.current = null;
  };

  useEffect(() => {
    stopFitPolling();

    if (!open || !posting || !user?.id || alreadyApplied || !studentProfile?.resume) {
      setFitStatus('idle');
      setFitScore(null);
      setFitError('');
      return;
    }

    let cancelled = false;

    const setReady = (result: Record<string, any>) => {
      if (cancelled) {
        return;
      }
      setFitScore(normalizeFitScore(result));
      setFitStatus('ready');
      setFitError('');
      stopFitPolling();
    };

    const pollForScore = () => {
      const intervalId = window.setInterval(async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`/api/ai/recommendations/get-score?postingId=${encodeURIComponent(posting.id)}`, {
            credentials: 'include',
            headers,
          });
          const data = await readJsonResponse(res);

          if (data.status === 'ready' && data.result) {
            setReady(data.result);
          }
        } catch (error) {
          if (!cancelled) {
            setFitStatus('error');
            setFitError(error instanceof Error ? error.message : 'Unable to load fit score.');
            stopFitPolling();
          }
        }
      }, 2000);

      const timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          setFitStatus('error');
          setFitError('Fit scoring is taking longer than expected. You can still submit your application.');
        }
        stopFitPolling();
      }, 1000 * 60);

      fitPollRef.current = { intervalId, timeoutId };
    };

    const fetchFitScore = async () => {
      setFitStatus('loading');
      setFitScore(null);
      setFitError('');

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/ai/recommendations/score-one?postingId=${encodeURIComponent(posting.id)}`, {
          credentials: 'include',
          headers,
        });
        const data = await readJsonResponse(res);

        if (data.status === 'ready' && data.result) {
          setReady(data.result);
          return;
        }

        if (data.status === 'scoring') {
          pollForScore();
          return;
        }

        setFitStatus('error');
        setFitError('Unable to calculate a fit score for this application.');
      } catch (error) {
        if (!cancelled) {
          setFitStatus('error');
          setFitError(error instanceof Error ? error.message : 'Unable to calculate a fit score.');
        }
      }
    };

    void fetchFitScore();

    return () => {
      cancelled = true;
      stopFitPolling();
    };
  }, [open, posting?.id, user?.id, alreadyApplied, Boolean(studentProfile?.resume)]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in before applying.');
      return;
    }

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

    setIsSubmitting(true);
    try {
      await addApplication({
        postingId: posting!.id,
        studentId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        studentMajor: (setupState?.profile as { major?: string } | null)?.major ?? 'Undeclared',
        coursework: Array.isArray(studentProfile?.coursework) ? studentProfile.coursework : [],
        resume: {
          ...studentProfile!.resume!,
          name: resumeNameOverride ?? studentProfile!.resume!.name,
        },
        answers: posting?.questions ? answers : undefined,
        quickNote: quickNoteEnabled ? note.trim() : '',
        status: 'Pending',
      });

      onSubmitted?.(posting!.id);

      toast.success('Application submitted successfully!');
      onOpenChange(false);
      setAnswers({});
      setNote('');
      setResumeNameOverride(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Application submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!posting) return null;

  const scorePercent = fitScore ? toDisplayPercent(fitScore.confidence) : 0;
  const visibleRequirementAssessments = fitScore?.requirement_assessments.slice(0, 5) ?? [];
  const fallbackEvidence = fitScore?.fit_reasoning.slice(0, 3) ?? [];
  const fallbackGaps = fitScore?.gaps.slice(0, 2) ?? [];
  const profileCoursework = Array.isArray(studentProfile?.coursework)
    ? studentProfile.coursework.map(formatCourseworkEntry).filter(Boolean)
    : [];

  const openFullReasoning = () => {
    if (!fitScore) {
      return;
    }
    const params = new URLSearchParams({
      confidence: String(fitScore.confidence ?? ''),
      reason: fitScore.reason ?? '',
    });
    onOpenChange(false);
    navigate(`/student/recommendations/${posting.id}/reasoning?${params.toString()}`, {
      state: { recommendation: fitScore },
    });
  };

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

          {!alreadyApplied && studentProfile?.resume ? (
            <Card className="border-[#e5ddd7] bg-[#fffdfa] shadow-none">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-red-700" />
                      <h3 className="text-base font-semibold text-foreground">Your fit for this role</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Confidence is based on your saved profile, resume signals, and this position&apos;s requirements.
                    </p>
                  </div>

                  {fitStatus === 'ready' && fitScore ? (
                    <div className="min-w-[132px] rounded-xl border border-[#eadfd8] bg-white p-3 text-center shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Confidence</p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{scorePercent}%</p>
                      <Badge className={`mt-2 rounded-full border px-2.5 py-0.5 text-xs ${getFitBadgeClass(fitScore.recommendation)}`}>
                        {fitScore.recommendation ?? 'Fit Analysis'}
                      </Badge>
                    </div>
                  ) : null}
                </div>

                {fitStatus === 'loading' ? (
                  <div className="flex items-center gap-3 rounded-lg border border-[#efe7e2] bg-white p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-red-700" />
                    Calculating your confidence score and requirement alignment...
                  </div>
                ) : null}

                {fitStatus === 'error' ? (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div>
                      <p className="font-semibold">Fit reasoning is unavailable right now.</p>
                      <p>{fitError || 'You can still submit your application.'}</p>
                    </div>
                  </div>
                ) : null}

                {fitStatus === 'ready' && fitScore ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">Overall match</span>
                        <span className="font-semibold text-foreground">{scorePercent}/100</span>
                      </div>
                      <Progress value={scorePercent} className="h-2" indicatorClassName={scorePercent >= 70 ? 'bg-green-600' : scorePercent >= 45 ? 'bg-amber-500' : 'bg-red-500'} />
                    </div>

                    {fitScore.reason ? <p className="text-sm leading-6 text-foreground/80">{fitScore.reason}</p> : null}

                    {visibleRequirementAssessments.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-foreground">Requirement alignment</p>
                        {visibleRequirementAssessments.map((item, index) => {
                          const support = getSupportMeta(item.support);
                          const body = item.evidence || item.gap || 'No specific evidence was found for this requirement.';
                          return (
                            <div key={`${item.requirement}-${index}`} className="rounded-lg border border-[#efe7e2] bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  <span className="mt-0.5 shrink-0">{support.icon}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{item.requirement}</p>
                                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{body}</p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Badge variant="outline" className="rounded-full capitalize">
                                    {item.importance}
                                  </Badge>
                                  <Badge className={`rounded-full border ${support.badge}`}>{support.label}</Badge>
                                </div>
                              </div>
                              {item.sources.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.sources.slice(0, 4).map((source) => (
                                    <Badge key={source} variant="secondary" className="rounded-full bg-[#f4f1ef] text-[#555]">
                                      {source}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : fallbackEvidence.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">Fit reasoning</p>
                        {fallbackEvidence.map((item) => (
                          <div key={item} className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50/60 p-3 text-sm text-green-950">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {fallbackGaps.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">Areas to address</p>
                        {fallbackGaps.map((item) => (
                          <div key={item} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <Button type="button" variant="outline" className="w-full" onClick={openFullReasoning}>
                      View full score reasoning
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Coursework from Profile
                </Label>
                {profileCoursework.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded bg-gray-50 p-3">
                    {profileCoursework.slice(0, 12).map((course) => (
                      <Badge key={course} variant="secondary" className="rounded-full bg-white text-gray-700">
                        {course}
                      </Badge>
                    ))}
                    {profileCoursework.length > 12 ? (
                      <Badge variant="outline" className="rounded-full">
                        +{profileCoursework.length - 12} more
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded bg-gray-50 p-3 text-sm text-gray-500">
                    No coursework is saved on your profile yet.
                  </div>
                )}
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

              {quickNoteEnabled ? (
                <div className="space-y-2">
                  <Label>Quick Note to Professor (optional)</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Briefly explain your fit and motivation for this project."
                    rows={3}
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

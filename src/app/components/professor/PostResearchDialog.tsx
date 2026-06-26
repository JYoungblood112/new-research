import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData, ApplicationQuestion, ResearchPosting } from '../../contexts/DataContext';
import { getStudentInterestCounts } from '../../lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { PlusCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  IMPORTANCE_TO_WEIGHT,
  buildDefaultRequirements,
  type OpportunityRequirement,
  type RequirementImportance,
  type RequirementType,
} from '../../lib/opportunityScoring';
import ResearchMetadataPicker, { normalizeResearchInterests } from './ResearchMetadataPicker';
import {
  getResearchAreasForPostingCategory,
  RESEARCH_AREA_OPTIONS,
  RESEARCH_POSTING_CATEGORY_OPTIONS,
  RESEARCH_SKILL_OPTIONS,
} from '../../lib/researchTaxonomy';

interface PostResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postingToEdit?: ResearchPosting | null;
}

const COMPENSATION_OPTIONS: Array<ResearchPosting['compensation']> = [
  'stipend',
  'volunteer',
  'course credit',
  'tbd',
];

const COMPENSATION_LABELS: Record<ResearchPosting['compensation'], string> = {
  stipend: 'Stipend',
  volunteer: 'Volunteer',
  'course credit': 'Course Credit',
  tbd: 'To Be Determined',
};

const MAX_START_DATE_YEARS_AHEAD = 2;
const IMPORTANCE_OPTIONS: RequirementImportance[] = ['Low', 'Medium', 'High', 'Critical'];
const REQUIREMENT_TYPE_OPTIONS: Array<{ value: RequirementType; label: string }> = [
  { value: 'must_have', label: 'Must-have' },
  { value: 'preferred', label: 'Preferred' },
];

const BLANK_REQUIREMENT: OpportunityRequirement = {
  title: '',
  description: '',
  requirementType: 'preferred',
  importance: 'Medium',
  weight: IMPORTANCE_TO_WEIGHT.Medium,
  minimumThreshold: '',
  evidenceSources: ['Resume', 'Transcript'],
  displayOrder: 0,
};

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSafeOptionalHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return undefined;
    }
    return trimmed;
  } catch {
    return undefined;
  }
}

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
  const [researchAreas, setResearchAreas] = useState<string[]>(normalizeResearchInterests(postingToEdit?.researchAreas ?? []));
  const [skillsNeeded, setSkillsNeeded] = useState<string[]>(normalizeResearchInterests(postingToEdit?.skillsNeeded ?? []));
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
  const [requirements, setRequirements] = useState<OpportunityRequirement[]>(postingToEdit?.requirements ?? []);
  const [quickNoteEnabled, setQuickNoteEnabled] = useState(postingToEdit?.quickNoteEnabled ?? true);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentWordLimit, setCurrentWordLimit] = useState('');
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxStartDate = new Date(today);
  maxStartDate.setFullYear(maxStartDate.getFullYear() + MAX_START_DATE_YEARS_AHEAD);
  const minEndDate = startDate
    ? (() => {
        const parsedStart = parseDateInput(startDate);
        if (!parsedStart) return undefined;
        const nextDay = new Date(parsedStart);
        nextDay.setDate(nextDay.getDate() + 1);
        return toLocalDateInputValue(nextDay);
      })()
    : undefined;

  const selectedInterestTerms = [category, ...researchAreas]
    .map((term) => term.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
  const predictedInterestedStudents = selectedInterestTerms.reduce(
    (total, term) => total + (interestCounts[term] ?? 0),
    0
  );
  const researchAreaOptions = category ? getResearchAreasForPostingCategory(category) : RESEARCH_AREA_OPTIONS;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (postingToEdit) {
      setStep(1);
      setCategory(postingToEdit.category ?? '');
      setResearchAreas(normalizeResearchInterests(postingToEdit.researchAreas ?? []));
      setSkillsNeeded(normalizeResearchInterests(postingToEdit.skillsNeeded ?? []));
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
      setRequirements(
        postingToEdit.requirements?.length
          ? postingToEdit.requirements
          : buildDefaultRequirements(postingToEdit)
      );
      setQuickNoteEnabled(postingToEdit.quickNoteEnabled ?? true);
      setCurrentQuestion('');
      setCurrentWordLimit('');
      return;
    }

    resetForm();
  }, [open, postingToEdit]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void getStudentInterestCounts()
      .then((payload) => {
        if (!cancelled) {
          setInterestCounts(payload.counts ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInterestCounts({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const validateStep = (stepToValidate: number) => {
    if (stepToValidate === 1) {
      const missingFields: string[] = [];
      if (!category) missingFields.push('Category');
      if (!title.trim()) missingFields.push('Project Title');
      if (!overview.trim()) missingFields.push('Overview / Description');
      if (!studentRoleDescription.trim()) missingFields.push('Student Role Description');
      if (!studentGain.trim()) missingFields.push('What the Student Will Gain');

      if (missingFields.length > 0) {
        toast.error(`Please fill in: ${missingFields.join(', ')}`);
        return false;
      }

      return true;
    }

    if (stepToValidate === 2) {
      const missingFields: string[] = [];
      if (!requiredQualifications.trim()) missingFields.push('Required Qualifications');
      if (!preferredQualifications.trim()) missingFields.push('Preferred Qualifications');
      if (!timeCommitmentExpected.trim()) missingFields.push('Expected Time Commitment');

      if (missingFields.length > 0) {
        toast.error(`Please fill in: ${missingFields.join(', ')}`);
        return false;
      }

      return true;
    }

    if (stepToValidate === 3) {
      const missingFields: string[] = [];
      if (!startDate) missingFields.push('Start Date');
      if (!endDate) missingFields.push('End Date');
      if (!applicationDeadline) missingFields.push('Application Deadline');
      if (!compensation) missingFields.push('Compensation');

      if (missingFields.length > 0) {
        toast.error(`Please fill in: ${missingFields.join(', ')}`);
        return false;
      }

      const parsedStartDate = parseDateInput(startDate);
      const parsedEndDate = parseDateInput(endDate);
      const parsedApplicationDeadline = parseDateInput(applicationDeadline);

      if (!parsedStartDate || !parsedEndDate || !parsedApplicationDeadline) {
        toast.error('Please enter valid start, end, and application deadline dates.');
        return false;
      }

      if (parsedStartDate < tomorrow) {
        toast.error('Start Date must be in the future.');
        return false;
      }

      if (parsedStartDate > maxStartDate) {
        toast.error(`Start Date cannot be more than ${MAX_START_DATE_YEARS_AHEAD} years in the future.`);
        return false;
      }

      if (parsedEndDate <= parsedStartDate) {
        toast.error('End Date must be after Start Date.');
        return false;
      }

      if (parsedApplicationDeadline < today) {
        toast.error('Application Deadline cannot be in the past.');
        return false;
      }

      if (parsedApplicationDeadline > parsedStartDate) {
        toast.error('Application Deadline must be on or before Start Date.');
        return false;
      }

      return true;
    }

    if (stepToValidate === 4) {
      if (questions.length > 4) {
        toast.error('Please include no more than 4 application questions.');
        return false;
      }

      return true;
    }

    return true;
  };

  const handleNextStep = () => {
    if (!validateStep(step)) {
      return;
    }

    setStep((current) => current + 1);
  };

  const handleSubmit = async () => {
    if (!user || user.role !== 'professor') {
      toast.error('Only professor accounts can create research opportunities.');
      return;
    }

    if (!professorProfile?.department) {
      toast.error('Professor profile is missing. Complete your professor profile before posting a project.');
      return;
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    const payload = {
      professorId: user!.id,
      professorName: user!.name,
      professorEmail: user!.email,
      professorBioUrl: toSafeOptionalHttpUrl(professorBioUrl),
      professorDepartment: professorProfile.department,
      category,
      researchAreas,
      skillsNeeded,
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
      quickNoteEnabled,
      requirements: requirements
        .map((requirement, index) => ({
          ...requirement,
          title: requirement.title.trim(),
          description: requirement.description.trim(),
          minimumThreshold: requirement.minimumThreshold?.trim() || undefined,
          evidenceSources: requirement.evidenceSources.map((source) => source.trim()).filter(Boolean),
          displayOrder: index,
        }))
        .filter((requirement) => requirement.title),
      status: 'published' as const,
    };

    setIsSaving(true);
    try {
      if (isEditing && postingToEdit) {
        await updatePosting(postingToEdit.id, payload);
        toast.success('Research posting updated successfully!');
      } else {
        await addPosting(payload);
        toast.success('Research opportunity posted successfully!');
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save research posting.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setCategory('');
    setResearchAreas([]);
    setSkillsNeeded([]);
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
    setRequirements([]);
    setQuickNoteEnabled(true);
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
              <div className="rounded-xl border border-[#ecd6cc] bg-[#fff5ef] px-4 py-3 text-sm text-[#8a4d3a]">
                <span className="font-semibold">{predictedInterestedStudents}</span> student interest signals overlap with this category and research area selection.
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category / Broad Field *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a broad research field" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESEARCH_POSTING_CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ResearchMetadataPicker
                label="Research Areas"
                value={researchAreas}
                onChange={setResearchAreas}
                options={researchAreaOptions}
                allowCustom
                placeholder={category ? `Search ${category} areas` : 'Select a category first or search all areas'}
              />

              <ResearchMetadataPicker
                label="Skills Needed"
                value={skillsNeeded}
                onChange={setSkillsNeeded}
                options={RESEARCH_SKILL_OPTIONS}
                allowCustom
                placeholder="Search skills or add a custom skill"
              />

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
                  <Input
                    type="date"
                    min={toLocalDateInputValue(tomorrow)}
                    max={toLocalDateInputValue(maxStartDate)}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    min={minEndDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Application Deadline *</Label>
                <Input
                  type="date"
                  min={toLocalDateInputValue(today)}
                  max={startDate || toLocalDateInputValue(maxStartDate)}
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                />
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
                        {COMPENSATION_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <div className="rounded-lg border border-[#eadbd4] bg-[#fffaf7] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#3f342f]">Weighted requirements</p>
                    <p className="text-xs text-[#76665f]">Students see names, descriptions, and public thresholds. Internal weights stay professor-only.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const draftPosting = {
                        id: postingToEdit?.id ?? 'draft',
                        professorId: user?.id ?? '',
                        professorName: user?.name ?? '',
                        professorEmail: user?.email ?? '',
                        professorDepartment: professorProfile?.department ?? '',
                        category,
                        researchAreas,
                        skillsNeeded,
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
                        quickNoteEnabled,
                        createdAt: new Date().toISOString(),
                        status: 'published' as const,
                      };
                      setRequirements(buildDefaultRequirements(draftPosting));
                    }}
                  >
                    Generate from qualifications
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  {requirements.map((requirement, index) => (
                    <div key={`${requirement.id ?? 'draft'}-${index}`} className="rounded-lg border border-[#e6ded9] bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_150px_130px_auto]">
                        <Input
                          value={requirement.title}
                          placeholder="Requirement title"
                          onChange={(event) => setRequirements((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry))}
                        />
                        <Select
                          value={requirement.requirementType}
                          onValueChange={(value) => setRequirements((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, requirementType: value as RequirementType } : entry))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REQUIREMENT_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select
                          value={requirement.importance}
                          onValueChange={(value) => {
                            const importance = value as RequirementImportance;
                            setRequirements((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, importance, weight: IMPORTANCE_TO_WEIGHT[importance] } : entry));
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {IMPORTANCE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRequirements((current) => current.filter((_, entryIndex) => entryIndex !== index))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        className="mt-2"
                        rows={2}
                        value={requirement.description}
                        placeholder="What evidence should satisfy this requirement?"
                        onChange={(event) => setRequirements((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry))}
                      />
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                        <Input
                          value={requirement.minimumThreshold ?? ''}
                          placeholder="Public threshold, optional"
                          onChange={(event) => setRequirements((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, minimumThreshold: event.target.value } : entry))}
                        />
                        <Input
                          value={requirement.evidenceSources.join(', ')}
                          placeholder="Evidence sources"
                          onChange={(event) => setRequirements((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, evidenceSources: event.target.value.split(',') } : entry))}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => setRequirements((current) => {
                          const next = [...current];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })}>Up</Button>
                        <Button type="button" variant="outline" size="sm" disabled={index === requirements.length - 1} onClick={() => setRequirements((current) => {
                          const next = [...current];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          return next;
                        })}>Down</Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setRequirements((current) => [...current, { ...BLANK_REQUIREMENT, displayOrder: current.length }])}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Requirement
                  </Button>
                  {requirements.length > 0 ? (
                    <div className="rounded-lg border border-[#e6ded9] bg-white p-3 text-xs leading-5 text-[#5f5651]">
                      Preview formula: each requirement contributes <span className="font-semibold">weight x evidence match x evidence confidence</span>, then the total is normalized to 100. Current total raw weight: {requirements.reduce((sum, requirement) => sum + requirement.weight, 0)}.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between rounded-lg border border-[#e7e7e7] bg-[#fafafa] p-3">
                <div>
                  <p className="text-sm font-medium">Ask for quick note from students</p>
                  <p className="text-xs text-[#6f6f6f]">If off, students can apply without sending a quick note.</p>
                </div>
                <Switch checked={quickNoteEnabled} onCheckedChange={setQuickNoteEnabled} />
              </div>

              <Label>Application Questions (optional, up to 4)</Label>
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
                {questions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-3 text-sm text-[#6f6f6f]">
                    No custom questions added. Students can still apply using the standard application flow.
                  </p>
                ) : null}
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
              <Button onClick={handleNextStep}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Post Research Opportunity'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

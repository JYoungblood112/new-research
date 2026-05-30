import { Camera, CheckCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { parseResumeWithAi } from '../../lib/api';
import { RESEARCH_SUBJECT_GROUPS } from '../../lib/researchTaxonomy';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
const SKILL_SUGGESTIONS = [
  'Python',
  'Java',
  'C++',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Machine Learning',
  'Data Analysis',
  'Data Visualization',
  'SQL',
  'Pandas',
  'NumPy',
  'TensorFlow',
  'PyTorch',
  'Computer Vision',
  'Natural Language Processing',
  'Research Writing',
  'Technical Communication',
  'Leadership',
  'Teamwork',
  'Public Speaking',
  'Git',
  'Docker',
  'Linux',
  'Figma',
  'UI Design',
  'User Research',
  'Project Management',
  'Statistics',
];

const RESEARCH_INTEREST_GROUPS = RESEARCH_SUBJECT_GROUPS;

type ResumeFileState = {
  name: string;
  base64: string;
};

interface StudentProfileProps {
  mode?: 'edit' | 'setup';
  onSetupComplete?: () => void;
  includeInterestsSection?: boolean;
  setupSubmitLabel?: string;
}

export default function StudentProfile({
  mode = 'edit',
  onSetupComplete,
  includeInterestsSection = true,
  setupSubmitLabel,
}: StudentProfileProps) {
  const { user, setupState, updateStudentProfile } = useAuth();
  const studentProfile = setupState?.profile as
    | {
        name?: string;
        photoBase64?: string;
        major?: string;
        graduationYear?: string;
        skills?: string[];
        interests?: string[];
        resume?: { name: string; uploadDate: string } | null;
      }
    | undefined;

  const [displayName, setDisplayName] = useState(user?.name || studentProfile?.name || '');
  const [displayEmail, setDisplayEmail] = useState(user?.email || '');
  const [major, setMajor] = useState(studentProfile?.major || '');
  const [year, setYear] = useState(studentProfile?.graduationYear || '');
  const [interests, setInterests] = useState(studentProfile?.interests || []);
  const [draftInterests, setDraftInterests] = useState(studentProfile?.interests || []);
  const [isEditingResearchInterests, setIsEditingResearchInterests] = useState(mode === 'setup');
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [skills, setSkills] = useState(studentProfile?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [debouncedSkillInput, setDebouncedSkillInput] = useState('');
  const [resumeFile, setResumeFile] = useState<ResumeFileState | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(studentProfile?.photoBase64 ?? null);
  const [aiAction, setAiAction] = useState<null | 'autofill' | 'skills'>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [resumeFormatError, setResumeFormatError] = useState(false);
  const [photoFormatError, setPhotoFormatError] = useState(false);
  const trimmedDisplayName = displayName.trim();
  const trimmedDisplayEmail = displayEmail.trim();
  const trimmedMajor = major.trim();
  const hasResume = Boolean(studentProfile?.resume || resumeFile);
  const missingDisplayName = showValidationErrors && !trimmedDisplayName;
  const missingDisplayEmail = showValidationErrors && !trimmedDisplayEmail;
  const missingMajor = showValidationErrors && !trimmedMajor;
  const missingYear = showValidationErrors && !year;
  const shouldRequireInterests = includeInterestsSection;
  const missingInterests = shouldRequireInterests && showValidationErrors && interests.length === 0;
  const missingResume = showValidationErrors && !hasResume;
  const hasInvalidDisplayEmail = Boolean(trimmedDisplayEmail) && !isValidEmail(trimmedDisplayEmail);
  const initials = (() => {
    const parts = (displayName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return 'U';
    }

    const firstInitial = parts[0][0]?.toUpperCase() ?? 'U';
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() ?? '' : '';
    return `${firstInitial}${lastInitial}`;
  })();

  const inputClassName =
    'h-12 rounded-2xl border-[#d9d9d9] bg-white px-4 text-[#111111] shadow-none placeholder:text-[#9b9b9b] disabled:cursor-default disabled:bg-[#fafafa] disabled:opacity-100 disabled:text-[#111111]';
  const labelClassName = 'text-sm font-semibold text-[#575757]';
  const tagInputRef = useRef<HTMLDivElement | null>(null);
  const isAiBusy = aiAction !== null;
  const normalizedSkillSet = new Set(skills.map((skill) => skill.toLowerCase()));
  const normalizedInterestSet = new Set(interests.map((interest) => interest.toLowerCase()));
  const normalizedDraftInterestSet = new Set(draftInterests.map((interest) => interest.toLowerCase()));
  const filteredSuggestions = SKILL_SUGGESTIONS.filter((suggestion) => {
    if (!debouncedSkillInput.trim()) {
      return !normalizedSkillSet.has(suggestion.toLowerCase());
    }

    return (
      !normalizedSkillSet.has(suggestion.toLowerCase()) &&
      suggestion.toLowerCase().includes(debouncedSkillInput.trim().toLowerCase())
    );
  }).slice(0, 8);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSkillInput(skillInput);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [skillInput]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setDebouncedSkillInput('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const addSkill = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    setSkills((current) => {
      if (current.some((skill) => skill.toLowerCase() === normalized.toLowerCase())) {
        return current;
      }
      return [...current, normalized];
    });
    setSkillInput('');
    setDebouncedSkillInput('');
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills((current) => current.filter((skill) => skill !== skillToRemove));
  };

  const toggleInterest = (subject: string) => {
    setInterests((current) => {
      const exists = current.some((interest) => interest.toLowerCase() === subject.toLowerCase());
      if (exists) {
        return current.filter((interest) => interest.toLowerCase() !== subject.toLowerCase());
      }
      return [...current, subject];
    });
  };

  const removeInterest = (interestToRemove: string) => {
    setInterests((current) => current.filter((interest) => interest !== interestToRemove));
  };

  const toggleDraftInterest = (subject: string) => {
    setDraftInterests((current) => {
      const exists = current.some((interest) => interest.toLowerCase() === subject.toLowerCase());
      if (exists) {
        return current.filter((interest) => interest.toLowerCase() !== subject.toLowerCase());
      }
      return [...current, subject];
    });
  };

  const removeDraftInterest = (interestToRemove: string) => {
    setDraftInterests((current) => current.filter((interest) => interest !== interestToRemove));
  };

  const addCustomInterest = () => {
    const next = customInterestInput.trim();
    if (!next) {
      return;
    }

    setInterests((current) => {
      if (current.some((interest) => interest.toLowerCase() === next.toLowerCase())) {
        return current;
      }
      return [...current, next];
    });
    setCustomInterestInput('');
  };

  const addCustomDraftInterest = () => {
    const next = customInterestInput.trim();
    if (!next) {
      return;
    }

    setDraftInterests((current) => {
      if (current.some((interest) => interest.toLowerCase() === next.toLowerCase())) {
        return current;
      }
      return [...current, next];
    });
    setCustomInterestInput('');
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.name.endsWith('.pdf')) {
        setResumeFormatError(true);
        return;
      }

      setResumeFormatError(false);

      const base64 = await fileToBase64(file);
      const fileState: ResumeFileState = { name: file.name, base64 };
      setResumeFile(fileState);

      try {
        await updateStudentProfile({
          resume: { name: file.name, uploadDate: new Date().toISOString() },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload resume');
        return;
      }

      // Auto-parse the resume immediately after upload
      setAiAction('autofill');
      try {
        const response = await parseResumeWithAi({
          resumeBase64: fileState.base64,
          fileName: fileState.name,
          mode: 'autofill',
        });

        if (!Array.isArray(response.result)) {
          const parsed = response.result;
          if (!major.trim() && parsed.major) setMajor(parsed.major);
          if (!year && parsed.academicYear && YEARS.includes(parsed.academicYear)) setYear(parsed.academicYear);
          mergeSkills(parsed.skills);
          toast.success('Resume uploaded — fields filled automatically.');
        } else {
          toast.success('Resume uploaded successfully.');
        }
      } catch {
        // Parsing failing shouldn't block the upload
        toast.success('Resume uploaded. (AI parsing unavailable)');
      } finally {
        setAiAction(null);
      }
    }
  };

  const handleSaveProfile = async () => {
    setShowValidationErrors(true);

    const missingRequiredFields: string[] = [];
    if (!trimmedDisplayName) missingRequiredFields.push('Full Name');
    if (!trimmedDisplayEmail) missingRequiredFields.push('Email');
    if (!trimmedMajor) missingRequiredFields.push('Major');
    if (!year) missingRequiredFields.push('Academic Year');
    if (shouldRequireInterests && interests.length === 0) missingRequiredFields.push('Research Interests');
    if (!hasResume) missingRequiredFields.push('Resume');

    if (missingRequiredFields.length > 0) {
      toast.error(`Please fill in: ${missingRequiredFields.join(', ')}`);
      return false;
    }

    if (hasInvalidDisplayEmail) {
      toast.error('Please enter a valid email address.');
      return false;
    }

    try {
      await updateStudentProfile({
        name: trimmedDisplayName || user?.name,
        email: trimmedDisplayEmail || undefined,
        photoBase64: photoBase64 ?? undefined,
        major: trimmedMajor || undefined,
        graduationYear: year || undefined,
        interests: includeInterestsSection ? interests : undefined,
        skills,
      });
      setResumeFormatError(false);
      setShowValidationErrors(false);
      if (mode === 'setup') {
        toast.success(
          includeInterestsSection ? 'Setup completed successfully!' : 'Profile saved. Continue to research interests.'
        );
      } else {
        toast.success('Profile updated successfully!');
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
      return false;
    }
  };

  const handleResetForm = () => {
    setDisplayName(user?.name || studentProfile?.name || '');
    setDisplayEmail(user?.email || '');
    setPhotoBase64(studentProfile?.photoBase64 ?? null);
    setMajor(studentProfile?.major || '');
    setYear(studentProfile?.graduationYear || '');
    setInterests(studentProfile?.interests || []);
    setDraftInterests(studentProfile?.interests || []);
    setIsEditingResearchInterests(false);
    setCustomInterestInput('');
    setSkills(studentProfile?.skills || []);
    setSkillInput('');
    setDebouncedSkillInput('');
    setResumeFormatError(false);
    setPhotoFormatError(false);
  };

  const handleSetupSubmit = async () => {
    const saved = await handleSaveProfile();
    if (saved) {
      onSetupComplete?.();
    }
  };

  const handleSaveResearchInterests = async () => {
    if (draftInterests.length < 1) {
      toast.error('Please choose at least 1 sub-genre to continue.');
      return;
    }

    try {
      await updateStudentProfile({ interests: draftInterests });
      setInterests(draftInterests);
      setIsEditingResearchInterests(false);
      setCustomInterestInput('');
      toast.success('Research interests saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save research interests');
    }
  };

  const handleCancelResearchInterests = () => {
    setDraftInterests(interests);
    setCustomInterestInput('');
    setIsEditingResearchInterests(false);
  };

  const handleSkillKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill(skillInput);
    }

    if (event.key === 'Backspace' && !skillInput && skills.length > 0) {
      event.preventDefault();
      removeSkill(skills[skills.length - 1]);
    }
  };

  const handleInterestKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addCustomInterest();
    }
  };

  const handleDraftInterestKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addCustomDraftInterest();
    }
  };

  const mergeSkills = (incomingSkills: string[]) => {
    setSkills((current) => {
      const seen = new Set(current.map((skill) => skill.toLowerCase()));
      const merged = [...current];
      for (const skill of incomingSkills) {
        const normalized = skill.trim();
        if (!normalized || seen.has(normalized.toLowerCase())) {
          continue;
        }
        seen.add(normalized.toLowerCase());
        merged.push(normalized);
      }
      return merged;
    });
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#d9d9d9] bg-white text-[#111111] shadow-[0_18px_36px_rgba(15,15,15,0.06)]">
      <div className="relative h-28 bg-[linear-gradient(120deg,#faf1ef_0%,#f7f4f1_55%,#f2f2f0_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff90,transparent_58%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="relative -mt-10 px-6 pb-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-5 border-b border-[#ececec] pb-7 md:flex-row md:items-end md:gap-6 md:pb-6">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div data-interactive="true" className="relative group flex cursor-pointer" onClick={() => document.getElementById('photo-upload')?.click()}>
              <div className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 bg-[linear-gradient(145deg,#d86666,#b4232f)] text-2xl font-medium text-white shadow-[0_12px_24px_rgba(180,35,47,0.18)] ${photoFormatError ? 'border-destructive/80' : 'border-white'}`}>
                {photoBase64 ? (
                  <img src={`data:image/jpeg;base64,${photoBase64}`} alt="Profile" className="size-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-6 text-white" />
              </div>
              {photoBase64 && (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 z-10 inline-flex size-6 items-center justify-center rounded-full bg-red-700 text-white shadow hover:bg-red-800"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPhotoBase64(null);
                    setPhotoFormatError(false);
                  }}
                  aria-label="Remove profile photo"
                >
                  <X className="size-3.5" />
                </button>
              )}
              </div>
              {photoFormatError && <p className="text-xs text-destructive">Only JPG, PNG, or WEBP files are accepted</p>}
            </div>

            <div className="flex-1 space-y-2 text-center md:text-left">
              <p className="text-xs font-medium uppercase tracking-[0.32em] text-[#8c8c8c]">Student Profile</p>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[#111111]">Edit your profile</h2>
                <p className="mt-2 max-w-2xl text-sm text-[#6f6f6f]">
                  Keep your academic details current and maintain a resume ready for research applications.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className={labelClassName}>Full Name <span className="text-red-700">*</span></Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isAiBusy}
                  placeholder="Your full name"
                  aria-invalid={missingDisplayName}
                  className={`${inputClassName} ${
                    missingDisplayName
                      ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                      : ''
                  }`}
                />
                {missingDisplayName && <p className="mt-2 text-xs text-destructive">This field is required</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="major" className={labelClassName}>
                  Major <span className="text-red-700">*</span>
                </Label>
                <Input
                  id="major"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Computer Science"
                  aria-invalid={missingMajor}
                  className={`${inputClassName} ${
                    missingMajor
                      ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                      : ''
                  }`}
                  disabled={isAiBusy}
                />
                {missingMajor && <p className="mt-2 text-xs text-destructive">This field is required</p>}
              </div>

              <div className="space-y-2">
                <Label className={labelClassName}>Email <span className="text-red-700">*</span></Label>
                <Input
                  value={displayEmail}
                  onChange={(e) => setDisplayEmail(e.target.value)}
                  disabled={isAiBusy}
                  placeholder="your@andrew.cmu.edu"
                  aria-invalid={missingDisplayEmail || hasInvalidDisplayEmail}
                  className={`${inputClassName} ${
                    missingDisplayEmail || hasInvalidDisplayEmail
                      ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                      : ''
                  }`}
                />
                {missingDisplayEmail && <p className="mt-2 text-xs text-destructive">This field is required</p>}
                {hasInvalidDisplayEmail && (
                  <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                    Email is invalid
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="year" className={labelClassName}>
                  Academic Year <span className="text-red-700">*</span>
                </Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger
                    id="year"
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none data-[placeholder]:text-[#9b9b9b] ${
                      missingYear
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                    disabled={isAiBusy}
                  >
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
                {missingYear && <p className="mt-2 text-xs text-destructive">This field is required</p>}
              </div>

              {includeInterestsSection ? (
                <div className="space-y-2 md:col-span-2">
                  <Label className={labelClassName}>Research Interests <span className="text-red-700">*</span></Label>
                  <p className="text-xs text-[#8a8a8a]">
                    Select all research areas you are interested in. You can update this anytime.
                  </p>

                  {mode === 'edit' && !isEditingResearchInterests ? (
                    <div
                      className={`cursor-pointer rounded-2xl border p-4 ${missingInterests ? 'border-destructive/80' : 'border-[#d9d9d9]'}`}
                      onClick={() => {
                        setDraftInterests(interests);
                        setCustomInterestInput('');
                        setIsEditingResearchInterests(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setDraftInterests(interests);
                          setCustomInterestInput('');
                          setIsEditingResearchInterests(true);
                        }
                      }}
                    >
                      {interests.length > 0 ? (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {interests.map((interest) => (
                            <span
                              key={interest}
                              className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-4 text-sm text-[#7a7a7a]">No research interests saved yet.</p>
                      )}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-[#d8d8d8] bg-white px-4 text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
                          onClick={() => {
                            setDraftInterests(interests);
                            setCustomInterestInput('');
                            setIsEditingResearchInterests(true);
                          }}
                          disabled={isAiBusy}
                        >
                          Edit Research Interests
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-2xl border p-4 ${missingInterests ? 'border-destructive/80' : 'border-[#d9d9d9]'}`}>
                      {(mode === 'edit' ? draftInterests : interests).length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {(mode === 'edit' ? draftInterests : interests).map((interest) => (
                            <span
                              key={interest}
                              className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700"
                            >
                              {interest}
                              <button
                                type="button"
                                className="text-red-500 transition-colors hover:text-red-700"
                                onClick={() =>
                                  mode === 'edit' ? removeDraftInterest(interest) : removeInterest(interest)
                                }
                                disabled={isAiBusy}
                                aria-label={`Remove ${interest}`}
                              >
                                <X className="size-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mb-4 flex gap-2">
                        <Input
                          value={customInterestInput}
                          onChange={(e) => setCustomInterestInput(e.target.value)}
                          onKeyDown={mode === 'edit' ? handleDraftInterestKeyDown : handleInterestKeyDown}
                          placeholder="Add custom interest (e.g. Health AI)"
                          className="h-10 rounded-xl"
                          disabled={isAiBusy}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={mode === 'edit' ? addCustomDraftInterest : addCustomInterest}
                          disabled={isAiBusy}
                        >
                          Add
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {RESEARCH_INTEREST_GROUPS.map((group) => (
                          <div key={group.title} className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b7b7b]">{group.title}</p>
                            <div className="flex flex-wrap gap-2">
                              {group.subjects.map((subject) => {
                                const selected = mode === 'edit'
                                  ? normalizedDraftInterestSet.has(subject.toLowerCase())
                                  : normalizedInterestSet.has(subject.toLowerCase());
                                return (
                                  <button
                                    key={subject}
                                    type="button"
                                    onClick={() =>
                                      mode === 'edit' ? toggleDraftInterest(subject) : toggleInterest(subject)
                                    }
                                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                      selected
                                        ? 'border-red-600 bg-red-600 text-white'
                                        : 'border-[#d2d2d2] bg-[#f8f8f8] text-[#3f3f3f] hover:bg-red-50 hover:border-red-300'
                                    }`}
                                    disabled={isAiBusy}
                                  >
                                    {subject}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {mode === 'edit' ? (
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-[#d8d8d8] bg-white px-4 text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
                            onClick={handleCancelResearchInterests}
                            disabled={isAiBusy}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="rounded-2xl bg-red-700 px-4 text-white hover:bg-red-800"
                            onClick={handleSaveResearchInterests}
                            disabled={isAiBusy}
                          >
                            Save Research Interests
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {missingInterests && <p className="mt-2 text-xs text-destructive">This field is required</p>}
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="skills" className={labelClassName}>
                  Skills
                </Label>
                <div className="space-y-3">
                  <div ref={tagInputRef} className="relative">
                    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-[22px] border border-[#d9d9d9] bg-white px-3 py-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700"
                        >
                          {skill}
                          <button
                            type="button"
                            className="text-red-500 transition-colors hover:text-red-700"
                            onClick={() => removeSkill(skill)}
                            disabled={isAiBusy}
                            aria-label={`Remove ${skill}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                      <input
                        id="skills"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={handleSkillKeyDown}
                        placeholder={skills.length ? 'Add another skill' : 'Type to add skills'}
                        className="h-8 min-w-[180px] flex-1 border-0 bg-transparent p-0 text-sm text-[#111111] outline-none placeholder:text-[#9b9b9b]"
                        disabled={isAiBusy}
                      />
                    </div>

                    {filteredSuggestions.length > 0 && debouncedSkillInput.trim() ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-[#e5e5e5] bg-white p-2 shadow-[0_12px_30px_rgba(15,15,15,0.08)]">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[#333333] transition-colors hover:bg-red-50 hover:text-red-700"
                            onClick={() => addSkill(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className={labelClassName}>Resume <span className="text-red-700">*</span></Label>
                  <div className="flex items-center gap-2">
                    {isAiBusy && (
                      <span className="flex items-center gap-1.5 text-xs text-[#8a8a8a]">
                        <Loader2 className="size-3.5 animate-spin" />
                        Analyzing resume…
                      </span>
                    )}
                    <p className="text-xs text-[#9b9b9b]">PDF only, max 5MB</p>
                  </div>
                </div>

                {studentProfile?.resume ? (
                  <div className="flex flex-col gap-4 rounded-[22px] border border-[#e5e5e5] bg-[#fcfcfc] p-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-[#eef8f0] text-[#2d7a42]">
                        <CheckCircle className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#111111]">{studentProfile.resume.name}</p>
                        <p className="text-xs text-[#8a8a8a]">
                          Uploaded {new Date(studentProfile.resume.uploadDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-[#d8d8d8] bg-white text-red-700 hover:bg-red-50 hover:text-red-700"
                      onClick={() => document.getElementById('resume-upload')?.click()}
                      disabled={isAiBusy}
                    >
                      <Upload className="size-4" />
                      Replace Resume
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="resume-upload"
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed bg-[#fcfcfc] px-6 py-9 text-center transition-colors hover:border-red-300 hover:bg-red-50/30 ${
                      missingResume || resumeFormatError ? 'border-destructive/80' : 'border-[#d8d8d8]'
                    }`}
                  >
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                      <FileText className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#111111]">Upload your resume</p>
                      <p className="text-xs text-[#8a8a8a]">Use your latest PDF before applying to research opportunities.</p>
                    </div>
                  </label>
                )}
                {resumeFormatError ? (
                  <p className="mt-2 text-xs text-destructive">Resume must be uploaded as a PDF</p>
                ) : (
                  missingResume && <p className="mt-2 text-xs text-destructive">This field is required</p>
                )}
              </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#ececec] bg-[#fcfcfc] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
          {mode === 'setup' ? (
            <Button
              type="button"
              className="rounded-2xl bg-red-700 px-6 text-white shadow-[0_10px_20px_rgba(185,28,28,0.16)] hover:bg-red-800"
              onClick={handleSetupSubmit}
              disabled={isAiBusy}
            >
              {setupSubmitLabel ?? 'Complete Setup'}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-[#d8d8d8] bg-white px-6 text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
                onClick={handleResetForm}
                disabled={isAiBusy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-2xl bg-red-700 px-6 text-white shadow-[0_10px_20px_rgba(185,28,28,0.16)] hover:bg-red-800"
                onClick={handleSaveProfile}
                disabled={isAiBusy}
              >
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        id="photo-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const isSupportedImageType =
            ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
            /\.(jpe?g|png|webp)$/i.test(file.name);

          if (!isSupportedImageType) {
            setPhotoFormatError(true);
            e.target.value = '';
            return;
          }

          setPhotoFormatError(false);
          if (file.size > 5 * 1024 * 1024) {
            toast.error('Photo must be under 5 MB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.replace(/^data:image\/[a-z]+;base64,/, '');
            setPhotoBase64(base64);
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        id="resume-upload"
        type="file"
        accept=".pdf"
        onChange={handleResumeUpload}
        className="hidden"
      />
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read the uploaded file.'));
        return;
      }
      resolve(reader.result.replace(/^data:application\/pdf;base64,/, ''));
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the uploaded file.'));
    };
    reader.readAsDataURL(file);
  });
}

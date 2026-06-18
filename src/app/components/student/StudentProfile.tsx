import { BookOpen, Camera, CheckCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { RESEARCH_SUBJECT_GROUPS } from '../../lib/researchTaxonomy';
import { supabase } from '../../lib/supabase';
import ResumeUpload, { type ResumeFields, type ResumeUploadHandle } from '../../../components/profile/ResumeUpload';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeProfileUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidLinkedInUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const normalized = normalizeProfileUrl(value);
    const url = new URL(normalized);
    return /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/in\/[^/]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isValidGithubUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const normalized = normalizeProfileUrl(value);
    const url = new URL(normalized);
    return /(^|\.)github\.com$/i.test(url.hostname) && /^\/[A-Za-z0-9-]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function normalizeDisplaySkill(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => {
      if (/^[A-Z0-9+#.]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', "Master's", 'PhD'];
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

type ResumeFormValues = {
  name: string;
  email: string;
  linkedin: string;
  github: string;
  degree: string;
  major: string;
};

type CourseworkEntry = string | { courseNumber?: string; courseName?: string; semester?: string };

function formatCourseworkEntry(course: CourseworkEntry) {
  if (typeof course === 'string') {
    return course;
  }

  const courseNumber = course.courseNumber?.trim() ?? '';
  const courseName = course.courseName?.trim() ?? '';
  return [courseNumber, courseName].filter(Boolean).join(' - ');
}

function getCourseworkKey(course: CourseworkEntry, index: number) {
  return `${formatCourseworkEntry(course)}-${index}`;
}

function getCourseworkSemester(course: CourseworkEntry) {
  if (typeof course === 'string') {
    return 'Extracted coursework';
  }

  return course.semester?.trim() || 'Extracted coursework';
}

function groupCourseworkBySemester(coursework: CourseworkEntry[]) {
  return coursework.reduce<Array<{ semester: string; courses: CourseworkEntry[] }>>((groups, course) => {
    const semester = getCourseworkSemester(course);
    const existing = groups.find((group) => group.semester === semester);
    if (existing) {
      existing.courses.push(course);
      return groups;
    }

    groups.push({ semester, courses: [course] });
    return groups;
  }, []);
}

function ProfileSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e6e1dd] bg-white p-4 shadow-none">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#111111]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[#6f6a66]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ValidationMessage({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{children}</p>;
}

function StatusPill({ tone, children }: { tone: 'success' | 'warning' | 'neutral' | 'danger'; children: React.ReactNode }) {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>{children}</span>;
}

function DocumentCard({
  title,
  fileName,
  uploadDate,
  required,
  uploading,
  onReplace,
  onRemove,
}: {
  title: string;
  fileName?: string;
  uploadDate?: string;
  required?: boolean;
  uploading?: boolean;
  onReplace: () => void;
  onRemove?: () => void;
}) {
  const hasFile = Boolean(fileName);
  return (
    <div className="rounded-lg border border-[#e6e1dd] bg-[#fcfbfa] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`rounded-lg p-2 ${hasFile ? 'bg-emerald-50' : required ? 'bg-amber-50' : 'bg-slate-100'}`}>
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
            ) : hasFile ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <FileText className="h-4 w-4 text-slate-500" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[#111111]">{title}</p>
              <StatusPill tone={uploading ? 'warning' : hasFile ? 'success' : required ? 'warning' : 'neutral'}>
                {uploading ? 'Processing' : hasFile ? 'Uploaded' : required ? 'Missing' : 'Optional'}
              </StatusPill>
            </div>
            <p className="mt-1 truncate text-sm text-[#625c57]">{fileName || (required ? 'Required for stronger matching' : 'Upload to improve match evidence')}</p>
            {uploadDate ? <p className="mt-0.5 text-xs text-[#8a8580]">Uploaded {new Date(uploadDate).toLocaleDateString()}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasFile && onRemove ? (
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-md border-[#e2d8d2] bg-white text-[#6b625d]" onClick={onRemove}>
              Remove
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-md border-[#e2d8d2] bg-white text-[#6b625d]" onClick={onReplace} disabled={uploading}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {hasFile ? 'Replace' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StudentProfileProps {
  mode?: 'edit' | 'setup';
  onSetupComplete?: () => void;
  includeInterestsSection?: boolean;
  setupSubmitLabel?: string;
  onRegisterLeaveGuard?: (handler: () => Promise<boolean>) => void;
}

export default function StudentProfile({
  mode = 'edit',
  onSetupComplete,
  includeInterestsSection = true,
  setupSubmitLabel,
  onRegisterLeaveGuard,
}: StudentProfileProps) {
  const { user, setupState, updateStudentProfile, refreshSession } = useAuth();
  const studentProfile = setupState?.profile as
    | {
        name?: string;
        photoBase64?: string;
        phone?: string;
        location?: string;
        linkedin?: string;
        github?: string;
        major?: string;
        university?: string;
        degree?: string;
        gpa?: string;
        graduationDate?: string;
        graduationType?: string;
        jobTitle?: string;
        employer?: string;
        yearsOfExperience?: string;
        workAuthorization?: string;
        summary?: string;
        graduationYear?: string;
        linkedInUrl?: string;
        githubUrl?: string;
        skills?: string[];
        interests?: string[];
        resume?: { name: string; uploadDate: string } | null;
        transcript?: { name: string; uploadDate: string } | null;
        coursework?: CourseworkEntry[];
      }
    | undefined;

  const {
    register,
    setValue,
    getValues,
    reset,
  } = useForm<ResumeFormValues>({
    defaultValues: {
      name: user?.name || studentProfile?.name || '',
      email: user?.email || '',
      linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
      github: studentProfile?.github || studentProfile?.githubUrl || '',
      degree: studentProfile?.degree || '',
      major: studentProfile?.major || '',
    },
  });

  const [displayName, setDisplayName] = useState(user?.name || studentProfile?.name || '');
  const [displayEmail, setDisplayEmail] = useState(user?.email || '');
  const [major, setMajor] = useState(studentProfile?.major || '');
  const [year, setYear] = useState(studentProfile?.graduationYear || '');
  const [linkedInUrl, setLinkedInUrl] = useState(studentProfile?.linkedInUrl || '');
  const [githubUrl, setGithubUrl] = useState(studentProfile?.githubUrl || '');
  const [interests, setInterests] = useState(studentProfile?.interests || []);
  const [draftInterests, setDraftInterests] = useState(studentProfile?.interests || []);
  const [isEditingResearchInterests, setIsEditingResearchInterests] = useState(mode === 'setup');
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [skills, setSkills] = useState(studentProfile?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [debouncedSkillInput, setDebouncedSkillInput] = useState('');
  const [coursework, setCoursework] = useState(studentProfile?.coursework || []);
  const [uploadedResume, setUploadedResume] = useState(studentProfile?.resume ?? null);
  const [isUploadingTranscript, setIsUploadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(studentProfile?.photoBase64 ?? null);
  const [hasUploadedResume, setHasUploadedResume] = useState(Boolean(studentProfile?.resume));
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [photoFormatError, setPhotoFormatError] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showAllCoursework, setShowAllCoursework] = useState(false);
  const resumeUploadRef = useRef<ResumeUploadHandle | null>(null);
  const transcriptInputRef = useRef<HTMLInputElement | null>(null);
  const trimmedDisplayName = displayName.trim();
  const trimmedDisplayEmail = displayEmail.trim();
  const trimmedMajor = major.trim();
  const hasResume = Boolean(studentProfile?.resume) || Boolean(uploadedResume) || hasUploadedResume;
  const hasInvalidDisplayEmail = Boolean(trimmedDisplayEmail) && !isValidEmail(trimmedDisplayEmail);
  const isSetupMode = mode === 'setup';
  const isSetupFormReady =
    Boolean(trimmedDisplayName) &&
    Boolean(trimmedDisplayEmail) &&
    !hasInvalidDisplayEmail &&
    Boolean(trimmedMajor) &&
    Boolean(year) &&
    hasResume;
  const missingDisplayName = showValidationErrors && !trimmedDisplayName;
  const missingDisplayEmail = showValidationErrors && !trimmedDisplayEmail;
  const missingMajor = showValidationErrors && !trimmedMajor;
  const missingYear = showValidationErrors && !year;
  const shouldRequireInterests = includeInterestsSection;
  const missingInterests = shouldRequireInterests && showValidationErrors && interests.length === 0;
  const missingResume = showValidationErrors && !hasResume;
  const normalizedLinkedInUrl = normalizeProfileUrl(linkedInUrl);
  const normalizedGithubUrl = normalizeProfileUrl(githubUrl);
  const hasInvalidLinkedInUrl = Boolean(linkedInUrl.trim()) && !isValidLinkedInUrl(linkedInUrl);
  const hasInvalidGithubUrl = Boolean(githubUrl.trim()) && !isValidGithubUrl(githubUrl);
  const profileCompletionItems = [
    Boolean(trimmedDisplayName),
    Boolean(trimmedDisplayEmail) && !hasInvalidDisplayEmail,
    Boolean(trimmedMajor),
    Boolean(year),
    interests.length > 0,
    skills.length > 0,
    hasResume,
    Boolean(studentProfile?.transcript),
  ];
  const profileCompletion = Math.round((profileCompletionItems.filter(Boolean).length / profileCompletionItems.length) * 100);
  const hasUnsavedChanges = Boolean(
    displayName !== (user?.name || studentProfile?.name || '') ||
      displayEmail !== (user?.email || '') ||
      major !== (studentProfile?.major || '') ||
      year !== (studentProfile?.graduationYear || '') ||
      linkedInUrl !== (studentProfile?.linkedInUrl || '') ||
      githubUrl !== (studentProfile?.githubUrl || '') ||
      JSON.stringify(interests) !== JSON.stringify(studentProfile?.interests || []) ||
      JSON.stringify(skills) !== JSON.stringify(studentProfile?.skills || []) ||
      uploadedResume !== (studentProfile?.resume ?? null) ||
      photoBase64 !== (studentProfile?.photoBase64 ?? null)
  );
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
    'h-10 rounded-lg border-[#d9d9d9] bg-white px-3 text-sm text-[#111111] shadow-none placeholder:text-[#9b9b9b] disabled:cursor-default disabled:bg-[#fafafa] disabled:opacity-100 disabled:text-[#111111]';
  const labelClassName = 'text-xs font-semibold uppercase tracking-[0.08em] text-[#6c6560]';
  const tagInputRef = useRef<HTMLDivElement | null>(null);
  const isAiBusy = false;
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
  const courseworkGroups = useMemo(() => {
    const groups = [
      { title: 'Relevant to AI/ML', pattern: /ai|artificial|machine|learning|deep|neural|nlp|natural language|vision/i, courses: [] as CourseworkEntry[] },
      { title: 'Relevant to Data/Statistics', pattern: /data|stat|probability|analytics|model|linear|database|sql/i, courses: [] as CourseworkEntry[] },
      { title: 'Relevant to Business', pattern: /business|econ|marketing|accounting|operations|strategy|management|finance/i, courses: [] as CourseworkEntry[] },
      { title: 'Other coursework', pattern: /.*/i, courses: [] as CourseworkEntry[] },
    ];

    coursework.forEach((course) => {
      const label = formatCourseworkEntry(course);
      const group = groups.find((entry) => entry.title !== 'Other coursework' && entry.pattern.test(label)) ?? groups[3];
      group.courses.push(course);
    });

    return groups.filter((group) => group.courses.length > 0);
  }, [coursework]);
  const visibleCourseworkGroups = useMemo(() => {
    if (showAllCoursework) return courseworkGroups;
    let remaining = 10;
    return courseworkGroups
      .map((group) => {
        const courses = group.courses.slice(0, remaining);
        remaining -= courses.length;
        return { ...group, courses };
      })
      .filter((group) => group.courses.length > 0);
  }, [courseworkGroups, showAllCoursework]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSkillInput(skillInput);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [skillInput]);

  useEffect(() => {
    setDisplayName(user?.name || studentProfile?.name || '');
    setDisplayEmail(user?.email || '');
    setPhotoBase64(studentProfile?.photoBase64 ?? null);
    setMajor(studentProfile?.major || '');
    setYear(studentProfile?.graduationYear || '');
    setLinkedInUrl(studentProfile?.linkedInUrl || '');
    setGithubUrl(studentProfile?.githubUrl || '');
    setInterests(studentProfile?.interests || []);
    setDraftInterests(studentProfile?.interests || []);
    setSkills(studentProfile?.skills || []);
    setCoursework(studentProfile?.coursework || []);
    setUploadedResume(studentProfile?.resume ?? null);
    setHasUploadedResume(Boolean(studentProfile?.resume));
  }, [
    user?.name,
    user?.email,
    studentProfile?.name,
    studentProfile?.photoBase64,
    studentProfile?.major,
    studentProfile?.graduationYear,
    studentProfile?.linkedInUrl,
    studentProfile?.githubUrl,
    studentProfile?.interests,
    studentProfile?.skills,
    studentProfile?.coursework,
    studentProfile?.resume,
  ]);

  useEffect(() => {
    reset({
      name: user?.name || studentProfile?.name || '',
      email: user?.email || '',
      linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
      github: studentProfile?.github || studentProfile?.githubUrl || '',
      degree: studentProfile?.degree || '',
      major: studentProfile?.major || '',
    });
  }, [
    reset,
    user?.name,
    user?.email,
    studentProfile?.name,
    studentProfile?.linkedin,
    studentProfile?.github,
    studentProfile?.major,
    studentProfile?.degree,
    studentProfile?.linkedInUrl,
    studentProfile?.githubUrl,
  ]);

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
    const normalized = normalizeDisplaySkill(value);
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

  const handleAutofill = (fields: ResumeFields) => {
    if (fields.full_name) {
      setValue('name', fields.full_name, { shouldDirty: true, shouldTouch: true });
      setDisplayName(fields.full_name);
    }
    if (fields.email) {
      setValue('email', fields.email, { shouldDirty: true, shouldTouch: true });
      setDisplayEmail(fields.email);
    }
    if (fields.linkedin) {
      setValue('linkedin', fields.linkedin, { shouldDirty: true, shouldTouch: true });
      setLinkedInUrl(fields.linkedin);
    }
    if (fields.github) {
      setValue('github', fields.github, { shouldDirty: true, shouldTouch: true });
      setGithubUrl(fields.github);
    }
    if (fields.major) {
      setValue('major', fields.major, { shouldDirty: true, shouldTouch: true });
      setMajor(fields.major);
    }
    if (fields.skills) {
      mergeSkills(
        fields.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean)
      );
    }
    if (fields.degree) setValue('degree', fields.degree, { shouldDirty: true, shouldTouch: true });
    if (fields.academic_year) {
      const valid = ['Freshman', 'Sophomore', 'Junior', 'Senior', "Master's", 'PhD'];
      if (valid.includes(fields.academic_year)) {
        setYear(fields.academic_year);
      }
    }
    // researchInterests is intentionally not set here.
  };

  const handleRemoveResume = async () => {
    try {
      await updateStudentProfile({ resume: null });
      setHasUploadedResume(false);
      toast.success('Resume removed.');
    } catch (error) {
      console.error('[student profile] remove resume failed:', error);
      toast.error('Could not remove resume. Please try again.');
    }
  };

  const handleTranscriptFile = async (file: File) => {
    setTranscriptError('');
    setIsUploadingTranscript(true);

    try {
      if (!/\.(pdf|txt)$/i.test(file.name)) {
        throw new Error('Unsupported transcript file type.');
      }
      if (file.size === 0) {
        throw new Error('Transcript file is empty.');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Transcript file is too large.');
      }
      const formData = new FormData();
      formData.append('transcript', file);
      const { data: sessionData } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      const accessToken = sessionData.session?.access_token;

      const response = await fetch('/api/profile/transcript', {
        method: 'POST',
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Transcript upload failed.');
      }

      setCoursework(Array.isArray(payload?.coursework) ? payload.coursework : []);
      await refreshSession();
      toast.success('Transcript uploaded and coursework extracted.');
    } catch (error) {
      console.error('[student profile] transcript upload failed:', error);
      const message = error instanceof Error && error.message === 'Unsupported transcript file type.'
        ? 'Upload a PDF or text transcript.'
        : error instanceof Error && error.message === 'Transcript file is empty.'
          ? 'Choose a transcript file that is not empty.'
          : error instanceof Error && error.message === 'Transcript file is too large.'
            ? 'Transcript must be under 10 MB.'
            : 'Could not upload transcript. Please try again.';
      setTranscriptError(message);
      toast.error(message);
    } finally {
      setIsUploadingTranscript(false);
    }
  };

  const handleRemoveTranscript = async () => {
    try {
      await updateStudentProfile({ transcript: null, transcriptText: null, coursework: [] });
      setCoursework([]);
      toast.success('Transcript removed.');
    } catch (error) {
      console.error('[student profile] remove transcript failed:', error);
      toast.error('Could not remove transcript. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    setShowValidationErrors(true);
    const resumeValues = getValues();

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

    if (hasInvalidLinkedInUrl) {
      toast.error('Enter a valid LinkedIn profile URL, such as https://linkedin.com/in/your-name');
      return false;
    }

    if (hasInvalidGithubUrl) {
      toast.error('Enter a valid GitHub profile URL, such as https://github.com/your-username');
      return false;
    }

    try {
      setIsSavingProfile(true);
      await updateStudentProfile({
        name: resumeValues.name.trim() || trimmedDisplayName || user?.name,
        email: resumeValues.email.trim() || trimmedDisplayEmail || undefined,
        photoBase64: photoBase64 ?? undefined,
        linkedin: normalizedLinkedInUrl || undefined,
        github: normalizedGithubUrl || undefined,
        major: resumeValues.major.trim() || trimmedMajor || undefined,
        degree: resumeValues.degree.trim() || undefined,
        graduationYear: year || undefined,
        linkedInUrl: normalizedLinkedInUrl || undefined,
        githubUrl: normalizedGithubUrl || undefined,
        interests: includeInterestsSection ? interests : undefined,
        skills,
        resume: uploadedResume ?? studentProfile?.resume ?? undefined,
        setupCompleted: mode === 'setup' && includeInterestsSection ? true : setupState?.completed ?? false,
      });
      setShowValidationErrors(false);
      if (mode === 'setup') {
        toast.success(
          includeInterestsSection ? 'Setup completed successfully!' : 'Profile saved. Continue to research interests.'
        );
      } else {
        toast.success('Profile saved.');
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      console.error('[student profile] save failed:', error);
      if (message.toLowerCase().includes('session expired') || message.toLowerCase() === 'unauthorized') {
        toast.error('Your session expired. Please sign in again.');
        window.location.assign('/');
        return false;
      }
      toast.error('Could not save profile. Please try again.');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetForm = () => {
    setDisplayName(user?.name || studentProfile?.name || '');
    setDisplayEmail(user?.email || '');
    setPhotoBase64(studentProfile?.photoBase64 ?? null);
    setMajor(studentProfile?.major || '');
    setYear(studentProfile?.graduationYear || '');
    setLinkedInUrl(studentProfile?.linkedInUrl || '');
    setGithubUrl(studentProfile?.githubUrl || '');
    setInterests(studentProfile?.interests || []);
    setDraftInterests(studentProfile?.interests || []);
    setIsEditingResearchInterests(false);
    setCustomInterestInput('');
    setSkills(studentProfile?.skills || []);
    setCoursework(studentProfile?.coursework || []);
    setUploadedResume(studentProfile?.resume ?? null);
    setSkillInput('');
    setDebouncedSkillInput('');
    setTranscriptError('');
    setPhotoFormatError(false);
    reset({
      name: user?.name || studentProfile?.name || '',
      email: user?.email || '',
      linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
      github: studentProfile?.github || studentProfile?.githubUrl || '',
      degree: studentProfile?.degree || '',
      major: studentProfile?.major || '',
    });
  };

  const handleSetupSubmit = async () => {
    const saved = await handleSaveProfile();
    if (saved) {
      onSetupComplete?.();
    }
  };

  useEffect(() => {
    if (!onRegisterLeaveGuard) {
      return;
    }

    onRegisterLeaveGuard(handleSaveProfile);
  }, [onRegisterLeaveGuard, handleSaveProfile]);

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
    <section className="pb-20 text-[#111111]">
      <div className="rounded-xl border border-[#e6e1dd] bg-white p-5 shadow-[0_12px_28px_rgba(15,15,15,0.05)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div data-interactive="true" className="group relative flex cursor-pointer" onClick={() => document.getElementById('photo-upload')?.click()}>
              <div className={`flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[linear-gradient(145deg,#d86666,#b4232f)] text-xl font-semibold text-white shadow-sm ${photoFormatError ? 'border-destructive/80' : 'border-white'}`}>
                {photoBase64 ? <img src={`data:image/jpeg;base64,${photoBase64}`} alt="Profile" className="size-full object-cover" /> : initials}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-4 text-white" />
              </div>
              {photoBase64 ? (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 z-10 inline-flex size-5 items-center justify-center rounded-full bg-red-700 text-white shadow hover:bg-red-800"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPhotoBase64(null);
                    setPhotoFormatError(false);
                  }}
                  aria-label="Remove profile photo"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a8580]">Student Profile</p>
              <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[#111111]">
                {trimmedDisplayName || 'Complete your profile'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6f6a66]">
                <span>{trimmedMajor || 'Major missing'}</span>
                <span className="text-[#b8aaa4]">•</span>
                <span>{year || 'Academic year missing'}</span>
                <span className="text-[#b8aaa4]">•</span>
                <span>{profileCompletion}% complete</span>
              </div>
              {photoFormatError ? <ValidationMessage>Only JPG, PNG, or WEBP files are accepted</ValidationMessage> : null}
            </div>
          </div>

          <div className="min-w-[220px] rounded-lg border border-[#ebe4df] bg-[#fcfbfa] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#4d4743]">Profile completeness</span>
              <span className="font-semibold text-[#111111]">{profileCompletion}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#eee8e4]">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${profileCompletion}%` }} />
            </div>
            <p className="mt-2 text-xs text-[#756f6a]">
              {studentProfile?.resume?.uploadDate || studentProfile?.transcript?.uploadDate
                ? `Last updated ${new Date(studentProfile?.resume?.uploadDate || studentProfile?.transcript?.uploadDate || '').toLocaleDateString()}`
                : 'Add documents and interests to improve matches.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <ProfileSection title="Status">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#625c57]">Resume</span>
                  <StatusPill tone={hasResume ? 'success' : 'warning'}>{hasResume ? 'Uploaded' : 'Missing'}</StatusPill>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#625c57]">Transcript</span>
                  <StatusPill tone={studentProfile?.transcript ? 'success' : 'neutral'}>{studentProfile?.transcript ? 'Uploaded' : 'Optional'}</StatusPill>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#625c57]">Research interests</span>
                  <StatusPill tone={interests.length ? 'success' : 'warning'}>{interests.length || 'Missing'}</StatusPill>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#625c57]">Skills</span>
                  <StatusPill tone={skills.length ? 'success' : 'warning'}>{skills.length || 'Recommended'}</StatusPill>
                </div>
              </div>
            </div>
          </ProfileSection>

          <ProfileSection title="Quick actions">
            <div className="space-y-2">
              <Button type="button" variant="outline" className="w-full justify-start rounded-md border-[#e2d8d2] bg-white" onClick={() => resumeUploadRef.current?.triggerReplace()}>
                <Upload className="mr-2 h-4 w-4" />
                Replace resume
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start rounded-md border-[#e2d8d2] bg-white" onClick={() => transcriptInputRef.current?.click()}>
                <BookOpen className="mr-2 h-4 w-4" />
                Upload transcript
              </Button>
            </div>
          </ProfileSection>
        </aside>

        <main className="space-y-4">
          <ProfileSection title="Basic Information" description="Keep your contact details accurate for research applications.">
            <div className="grid gap-4 md:grid-cols-2">
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
                <ValidationMessage>{missingDisplayName ? 'Full name is required.' : null}</ValidationMessage>
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
                <ValidationMessage>{missingDisplayEmail ? 'Email is required.' : hasInvalidDisplayEmail ? 'Enter a valid email address.' : null}</ValidationMessage>
              </div>

              <div className="space-y-2">
                <Label className={labelClassName}>LinkedIn</Label>
                <Input
                  value={linkedInUrl}
                  onChange={(e) => setLinkedInUrl(e.target.value.trimStart())}
                  disabled={isAiBusy}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  aria-invalid={showValidationErrors && hasInvalidLinkedInUrl}
                  className={`${inputClassName} ${showValidationErrors && hasInvalidLinkedInUrl ? 'border-destructive/80' : ''}`}
                />
                <ValidationMessage>{showValidationErrors && hasInvalidLinkedInUrl ? 'Enter a valid LinkedIn profile URL, such as https://linkedin.com/in/your-name' : null}</ValidationMessage>
              </div>

              <div className="space-y-2">
                <Label className={labelClassName}>GitHub</Label>
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value.trimStart())}
                  disabled={isAiBusy}
                  placeholder="https://github.com/your-username"
                  aria-invalid={showValidationErrors && hasInvalidGithubUrl}
                  className={`${inputClassName} ${showValidationErrors && hasInvalidGithubUrl ? 'border-destructive/80' : ''}`}
                />
                <ValidationMessage>{showValidationErrors && hasInvalidGithubUrl ? 'Enter a valid GitHub profile URL, such as https://github.com/your-username' : null}</ValidationMessage>
              </div>
            </div>
          </ProfileSection>

          <ProfileSection title="Academic Information" description="These fields help faculty understand your academic context.">
            <div className="grid gap-4 md:grid-cols-2">
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
                  className={`${inputClassName} ${missingMajor ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20' : ''}`}
                  disabled={isAiBusy}
                />
                <ValidationMessage>{missingMajor ? 'Major is required.' : null}</ValidationMessage>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year" className={labelClassName}>
                  Academic Year <span className="text-red-700">*</span>
                </Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger
                    id="year"
                    className={`h-10 rounded-lg bg-white px-3 text-sm text-[#111111] shadow-none data-[placeholder]:text-[#9b9b9b] ${missingYear ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20' : 'border-[#d9d9d9]'}`}
                    disabled={isAiBusy}
                  >
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ValidationMessage>{missingYear ? 'Academic year is required.' : null}</ValidationMessage>
              </div>

              <div className="space-y-2">
                <Label className={labelClassName}>Degree</Label>
                <Input {...register('degree')} className={inputClassName} placeholder="B.S., M.S., PhD" />
              </div>
            </div>
          </ProfileSection>

          {includeInterestsSection ? (
            <ProfileSection title="Research Interests" description="Selected interests help prioritize recommendations.">
              {mode === 'edit' && !isEditingResearchInterests ? (
                <div className={`rounded-lg border p-3 ${missingInterests ? 'border-destructive/80' : 'border-[#e6e1dd]'}`}>
                  {interests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {interests.map((interest) => (
                        <span key={interest} className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#7a7470]">No research interests saved yet.</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 rounded-md border-[#e2d8d2] bg-white"
                    onClick={() => {
                      setDraftInterests(interests);
                      setCustomInterestInput('');
                      setIsEditingResearchInterests(true);
                    }}
                    disabled={isAiBusy}
                  >
                    Edit interests
                  </Button>
                </div>
              ) : (
                <div className={`rounded-lg border p-3 ${missingInterests ? 'border-destructive/80' : 'border-[#e6e1dd]'}`}>
                  {(mode === 'edit' ? draftInterests : interests).length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {(mode === 'edit' ? draftInterests : interests).map((interest) => (
                        <span key={interest} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                          {interest}
                          <button
                            type="button"
                            className="text-red-600 transition-colors hover:text-red-700"
                            onClick={() => mode === 'edit' ? removeDraftInterest(interest) : removeInterest(interest)}
                            disabled={isAiBusy}
                            aria-label={`Remove ${interest}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mb-4 flex gap-2">
                    <Input
                      value={customInterestInput}
                      onChange={(e) => setCustomInterestInput(e.target.value)}
                      onKeyDown={mode === 'edit' ? handleDraftInterestKeyDown : handleInterestKeyDown}
                      placeholder="Add custom interest"
                      className="h-10 rounded-lg"
                      disabled={isAiBusy}
                    />
                    <Button type="button" variant="outline" onClick={mode === 'edit' ? addCustomDraftInterest : addCustomInterest} disabled={isAiBusy}>
                      Add
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {RESEARCH_INTEREST_GROUPS.map((group) => (
                      <div key={group.title} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7772]">{group.title}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.subjects.map((subject) => {
                            const selected = mode === 'edit'
                              ? normalizedDraftInterestSet.has(subject.toLowerCase())
                              : normalizedInterestSet.has(subject.toLowerCase());
                            return (
                              <button
                                key={subject}
                                type="button"
                                onClick={() => mode === 'edit' ? toggleDraftInterest(subject) : toggleInterest(subject)}
                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                  selected
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-[#d8d2cd] bg-white text-[#4d4743] hover:bg-slate-50'
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
                      <Button type="button" variant="outline" className="rounded-md border-[#e2d8d2] bg-white" onClick={handleCancelResearchInterests} disabled={isAiBusy}>
                        Cancel
                      </Button>
                      <Button type="button" className="rounded-md bg-red-700 text-white hover:bg-red-800" onClick={handleSaveResearchInterests} disabled={isAiBusy}>
                        Save interests
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              <ValidationMessage>{missingInterests ? 'Choose at least one research interest.' : null}</ValidationMessage>
            </ProfileSection>
          ) : null}

          <ProfileSection title="Skills" description="Add technical and research skills. Press Enter to add a skill.">
            <div ref={tagInputRef} className="relative">
              <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-[#d9d9d9] bg-white px-3 py-2">
                {skills.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                    {skill}
                    <button type="button" className="text-red-600 transition-colors hover:text-red-700" onClick={() => removeSkill(skill)} disabled={isAiBusy} aria-label={`Remove ${skill}`}>
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
                  className="h-7 min-w-[180px] flex-1 border-0 bg-transparent p-0 text-sm text-[#111111] outline-none placeholder:text-[#9b9b9b]"
                  disabled={isAiBusy}
                />
              </div>

              {filteredSuggestions.length > 0 && debouncedSkillInput.trim() ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-lg border border-[#e5e5e5] bg-white p-2 shadow-[0_12px_30px_rgba(15,15,15,0.08)]">
                  {filteredSuggestions.map((suggestion) => (
                    <button key={suggestion} type="button" className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-[#333333] transition-colors hover:bg-blue-50 hover:text-blue-700" onClick={() => addSkill(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {skills.length === 0 ? <p className="mt-2 text-xs text-amber-700">Adding at least one skill is recommended for better matches.</p> : null}
          </ProfileSection>

          <ProfileSection title="Documents" description="Documents help power resume autofill, coursework extraction, and match scoring.">
            <div className="space-y-3">
              <DocumentCard
                title="Resume"
                fileName={(uploadedResume ?? studentProfile?.resume ?? undefined)?.name}
                uploadDate={(uploadedResume ?? studentProfile?.resume ?? undefined)?.uploadDate}
                required
                onReplace={() => resumeUploadRef.current?.triggerReplace()}
                onRemove={handleRemoveResume}
              />
              <ResumeUpload
                ref={resumeUploadRef}
                onAutofill={handleAutofill}
                onResumeUploaded={(resume) => {
                  setUploadedResume(resume);
                  setHasUploadedResume(true);
                  toast.success('Resume updated profile fields.');
                }}
              />
              <ValidationMessage>{missingResume ? 'Resume is required for stronger profile matching.' : null}</ValidationMessage>

              <DocumentCard
                title="Transcript"
                fileName={studentProfile?.transcript?.name}
                uploadDate={studentProfile?.transcript?.uploadDate}
                uploading={isUploadingTranscript}
                onReplace={() => transcriptInputRef.current?.click()}
                onRemove={studentProfile?.transcript ? handleRemoveTranscript : undefined}
              />
              {transcriptError ? <ValidationMessage>{transcriptError}</ValidationMessage> : null}
            </div>
          </ProfileSection>

          <ProfileSection title="Extracted Coursework" description="Showing the most relevant extracted courses by default.">
            {coursework.length > 0 ? (
              <div className="space-y-4">
                {visibleCourseworkGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7772]">{group.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.courses.map((course, index) => (
                        <span key={getCourseworkKey(course, index)} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                          {formatCourseworkEntry(course)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {coursework.length > 10 ? (
                  <Button type="button" variant="outline" className="rounded-md border-[#e2d8d2] bg-white" onClick={() => setShowAllCoursework((open) => !open)}>
                    {showAllCoursework ? 'Show fewer courses' : `View all ${coursework.length} courses`}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[#777777]">No transcript coursework stored yet.</p>
            )}
          </ProfileSection>
        </main>
      </div>

      {(hasUnsavedChanges || isSetupMode) ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6e1dd] bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,15,15,0.06)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[#625c57]">{isSetupMode ? 'Complete required profile fields to continue.' : 'Unsaved changes'}</p>
            <div className="flex justify-end gap-2">
              {!isSetupMode ? (
                <Button type="button" variant="outline" className="rounded-md border-[#d8d0ca] bg-white" onClick={handleResetForm} disabled={isAiBusy || isSavingProfile}>
                  Discard Changes
                </Button>
              ) : null}
              <Button
                type="button"
                className="rounded-md bg-red-700 text-white hover:bg-red-800"
                onClick={isSetupMode ? handleSetupSubmit : handleSaveProfile}
                disabled={isAiBusy || isSavingProfile || (isSetupMode && !isSetupFormReady)}
              >
                {isSavingProfile ? 'Saving...' : isSetupMode ? setupSubmitLabel ?? 'Complete Setup' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
        ref={transcriptInputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            await handleTranscriptFile(file);
          }
          event.target.value = '';
        }}
        className="hidden"
      />
    </section>
  );
}

import { Camera, CheckCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { parseResumeWithAi } from '../../lib/api';
import { RESEARCH_SUBJECT_GROUPS } from '../../lib/researchTaxonomy';
import ResumeUpload, { type ResumeFields } from '../../../components/profile/ResumeUpload';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
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

type ResumeFormValues = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  university: string;
  degree: string;
  major: string;
  gpa: string;
  graduationDate: string;
  graduationType: string;
  jobTitle: string;
  employer: string;
  yearsOfExperience: string;
  workAuthorization: string;
  skills: string;
  summary: string;
};

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
  const { user, setupState, updateStudentProfile } = useAuth();
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
      }
    | undefined;

  const {
    register,
    setValue,
    getValues,
    watch,
    reset,
  } = useForm<ResumeFormValues>({
    defaultValues: {
      name: user?.name || studentProfile?.name || '',
      email: user?.email || '',
      phone: studentProfile?.phone || '',
      location: studentProfile?.location || '',
      linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
      github: studentProfile?.github || studentProfile?.githubUrl || '',
      university: studentProfile?.university || '',
      degree: studentProfile?.degree || '',
      major: studentProfile?.major || '',
      gpa: studentProfile?.gpa || '',
      graduationDate: studentProfile?.graduationDate || '',
      graduationType: studentProfile?.graduationType || '',
      jobTitle: studentProfile?.jobTitle || '',
      employer: studentProfile?.employer || '',
      yearsOfExperience: studentProfile?.yearsOfExperience || '',
      workAuthorization: studentProfile?.workAuthorization || '',
      skills: (studentProfile?.skills || []).join(', '),
      summary: studentProfile?.summary || '',
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
  const graduationTypeValue = watch('graduationType');
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
  ]);

  useEffect(() => {
    reset({
      name: user?.name || studentProfile?.name || '',
      email: user?.email || '',
      phone: studentProfile?.phone || '',
      location: studentProfile?.location || '',
      linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
      github: studentProfile?.github || studentProfile?.githubUrl || '',
      university: studentProfile?.university || '',
      degree: studentProfile?.degree || '',
      major: studentProfile?.major || '',
      gpa: studentProfile?.gpa || '',
      graduationDate: studentProfile?.graduationDate || '',
      graduationType: studentProfile?.graduationType || '',
      jobTitle: studentProfile?.jobTitle || '',
      employer: studentProfile?.employer || '',
      yearsOfExperience: studentProfile?.yearsOfExperience || '',
      workAuthorization: studentProfile?.workAuthorization || '',
      skills: (studentProfile?.skills || []).join(', '),
      summary: studentProfile?.summary || '',
    });
  }, [
    reset,
    user?.name,
    user?.email,
    studentProfile?.name,
    studentProfile?.phone,
    studentProfile?.location,
    studentProfile?.linkedin,
    studentProfile?.github,
    studentProfile?.major,
    studentProfile?.university,
    studentProfile?.degree,
    studentProfile?.gpa,
    studentProfile?.graduationDate,
    studentProfile?.graduationType,
    studentProfile?.jobTitle,
    studentProfile?.employer,
    studentProfile?.yearsOfExperience,
    studentProfile?.workAuthorization,
    studentProfile?.linkedInUrl,
    studentProfile?.githubUrl,
    studentProfile?.skills,
    studentProfile?.summary,
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

        const parsedByOllama = response.source !== 'fallback';

        if (!Array.isArray(response.result)) {
          const parsed = response.result;
          if (parsed.fullName) setDisplayName(parsed.fullName);
          if (parsed.email) setDisplayEmail(parsed.email);
          if (parsed.major) setMajor(parsed.major);
          if (parsed.academicYear && YEARS.includes(parsed.academicYear)) setYear(parsed.academicYear);
          mergeSkills(parsed.skills);

          // Persist parsed fields immediately so profile state updates without waiting for manual Save.
          const mergedSkills = [
            ...new Set([...(skills || []), ...((parsed.skills || []).map((s) => s.trim()).filter(Boolean))]),
          ];
          await updateStudentProfile({
            name: parsed.fullName || trimmedDisplayName || undefined,
            email: parsed.email || trimmedDisplayEmail || undefined,
            major: parsed.major || trimmedMajor || undefined,
            graduationYear:
              parsed.academicYear && YEARS.includes(parsed.academicYear)
                ? parsed.academicYear
                : year || undefined,
            skills: mergedSkills,
          });

          if (parsedByOllama) {
            toast.success('Resume uploaded — fields filled automatically (parsed by Ollama).');
          } else {
            toast.success('Resume uploaded — parsing fallback used.');
          }
        } else {
          if (parsedByOllama) {
            toast.success('Resume uploaded successfully (parsed by Ollama).');
          } else {
            toast.success('Resume uploaded successfully (fallback used).');
          }
        }
      } catch {
        // Parsing failing shouldn't block the upload
        toast.success('Resume uploaded successfully.');
      } finally {
        setAiAction(null);
      }
    }
  };

  const handleAutofill = (fields: ResumeFields) => {
    console.log('handleAutofill called with:', fields);
    if (fields.full_name) setValue('name', fields.full_name, { shouldDirty: true, shouldTouch: true });
    if (fields.email) setValue('email', fields.email, { shouldDirty: true, shouldTouch: true });
    if (fields.phone) setValue('phone', fields.phone, { shouldDirty: true, shouldTouch: true });
    if (fields.location) setValue('location', fields.location, { shouldDirty: true, shouldTouch: true });
    if (fields.linkedin) setValue('linkedin', fields.linkedin, { shouldDirty: true, shouldTouch: true });
    if (fields.github_or_portfolio) setValue('github', fields.github_or_portfolio, { shouldDirty: true, shouldTouch: true });
    if (fields.university) setValue('university', fields.university, { shouldDirty: true, shouldTouch: true });
    if (fields.degree) setValue('degree', fields.degree, { shouldDirty: true, shouldTouch: true });
    if (fields.major) setValue('major', fields.major, { shouldDirty: true, shouldTouch: true });
    if (fields.gpa) setValue('gpa', fields.gpa, { shouldDirty: true, shouldTouch: true });
    if (fields.graduation_date) setValue('graduationDate', fields.graduation_date, { shouldDirty: true, shouldTouch: true });
    if (fields.graduation_type) setValue('graduationType', fields.graduation_type, { shouldDirty: true, shouldTouch: true });
    if (fields.most_recent_job_title) setValue('jobTitle', fields.most_recent_job_title, { shouldDirty: true, shouldTouch: true });
    if (fields.most_recent_employer) setValue('employer', fields.most_recent_employer, { shouldDirty: true, shouldTouch: true });
    if (fields.years_of_experience) setValue('yearsOfExperience', fields.years_of_experience, { shouldDirty: true, shouldTouch: true });
    if (fields.work_authorization) setValue('workAuthorization', fields.work_authorization, { shouldDirty: true, shouldTouch: true });
    if (fields.skills) setValue('skills', fields.skills, { shouldDirty: true, shouldTouch: true });
    if (fields.professional_summary) setValue('summary', fields.professional_summary, { shouldDirty: true, shouldTouch: true });
  };

  const handleRemoveResume = async () => {
    try {
      await updateStudentProfile({ resume: null });
      setResumeFile(null);
      setResumeFormatError(false);
      toast.success('Resume removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove resume');
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

    try {
      const parsedSkills = resumeValues.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);

      await updateStudentProfile({
        name: resumeValues.name.trim() || trimmedDisplayName || user?.name,
        email: resumeValues.email.trim() || trimmedDisplayEmail || undefined,
        photoBase64: photoBase64 ?? undefined,
        phone: resumeValues.phone.trim() || undefined,
        location: resumeValues.location.trim() || undefined,
        linkedin: resumeValues.linkedin.trim() || undefined,
        github: resumeValues.github.trim() || undefined,
        major: resumeValues.major.trim() || trimmedMajor || undefined,
        university: resumeValues.university.trim() || undefined,
        degree: resumeValues.degree.trim() || undefined,
        gpa: resumeValues.gpa.trim() || undefined,
        graduationYear: year || undefined,
        graduationDate: resumeValues.graduationDate.trim() || undefined,
        graduationType: resumeValues.graduationType.trim() || undefined,
        jobTitle: resumeValues.jobTitle.trim() || undefined,
        employer: resumeValues.employer.trim() || undefined,
        yearsOfExperience: resumeValues.yearsOfExperience.trim() || undefined,
        workAuthorization: resumeValues.workAuthorization.trim() || undefined,
        linkedInUrl: linkedInUrl.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        interests: includeInterestsSection ? interests : undefined,
        skills: parsedSkills.length > 0 ? parsedSkills : skills,
        summary: resumeValues.summary.trim() || undefined,
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
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      if (message.toLowerCase().includes('session expired') || message.toLowerCase() === 'unauthorized') {
        toast.error('Your session expired. Please sign in again.');
        window.location.assign('/');
        return false;
      }
      toast.error(message);
      return false;
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
    setSkillInput('');
    setDebouncedSkillInput('');
    setResumeFormatError(false);
    setPhotoFormatError(false);
    reset({
      name: user?.name || studentProfile?.name || '',
      email: user?.email || '',
      phone: studentProfile?.phone || '',
      location: studentProfile?.location || '',
      linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
      github: studentProfile?.github || studentProfile?.githubUrl || '',
      university: studentProfile?.university || '',
      degree: studentProfile?.degree || '',
      major: studentProfile?.major || '',
      gpa: studentProfile?.gpa || '',
      graduationDate: studentProfile?.graduationDate || '',
      graduationType: studentProfile?.graduationType || '',
      jobTitle: studentProfile?.jobTitle || '',
      employer: studentProfile?.employer || '',
      yearsOfExperience: studentProfile?.yearsOfExperience || '',
      workAuthorization: studentProfile?.workAuthorization || '',
      skills: (studentProfile?.skills || []).join(', '),
      summary: studentProfile?.summary || '',
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
                <h2 className="text-3xl font-semibold tracking-tight text-[#111111]">
                  {mode === 'setup' ? 'Input Information' : 'Edit your profile'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[#6f6f6f]">
                  Keep your academic details current and maintain a resume ready for research applications.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-6">
            <div className="rounded-[24px] border border-[#ece3dc] bg-[#fcfbfa] p-5 shadow-[0_8px_20px_rgba(0,0,0,0.03)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Resume Autofill</p>
                  <h3 className="text-xl font-semibold text-[#111111]">Upload a resume to populate your profile</h3>
                  <p className="text-sm text-[#6f6f6f]">
                    Fields from the parsed resume will fill into the profile form below so you can review them before saving.
                  </p>
                </div>

                <ResumeUpload onAutofill={handleAutofill} />

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className={labelClassName}>Full Name</Label>
                    <Input {...register('name')} className={inputClassName} placeholder="Full name from resume" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Email</Label>
                    <Input {...register('email')} className={inputClassName} placeholder="Email from resume" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Phone</Label>
                    <Input {...register('phone')} className={inputClassName} placeholder="(123) 456-7890" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Location</Label>
                    <Input {...register('location')} className={inputClassName} placeholder="City, State" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>LinkedIn</Label>
                    <Input {...register('linkedin')} className={inputClassName} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>GitHub / Portfolio</Label>
                    <Input {...register('github')} className={inputClassName} placeholder="https://github.com/..." />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>University</Label>
                    <Input {...register('university')} className={inputClassName} placeholder="Carnegie Mellon University" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Degree</Label>
                    <Input {...register('degree')} className={inputClassName} placeholder="B.S., M.S., PhD" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Major</Label>
                    <Input {...register('major')} className={inputClassName} placeholder="Computer Science" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>GPA</Label>
                    <Input {...register('gpa')} className={inputClassName} placeholder="3.8" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Graduation Date</Label>
                    <Input {...register('graduationDate')} className={inputClassName} placeholder="May 2027" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Graduation Type</Label>
                    <Select
                      value={graduationTypeValue}
                      onValueChange={(value) => setValue('graduationType', value, { shouldDirty: true, shouldTouch: true })}
                    >
                      <SelectTrigger className={inputClassName}>
                        <SelectValue placeholder="Expected or Actual" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Expected">Expected</SelectItem>
                        <SelectItem value="Actual">Actual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Most Recent Job Title</Label>
                    <Input {...register('jobTitle')} className={inputClassName} placeholder="Software Engineering Intern" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Most Recent Employer</Label>
                    <Input {...register('employer')} className={inputClassName} placeholder="Company Name" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Years of Experience</Label>
                    <Input {...register('yearsOfExperience')} className={inputClassName} placeholder="2" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClassName}>Work Authorization</Label>
                    <Input {...register('workAuthorization')} className={inputClassName} placeholder="US citizen, CPT, OPT" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className={labelClassName}>Skills</Label>
                    <Input {...register('skills')} className={inputClassName} placeholder="Python, React, SQL" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className={labelClassName}>Professional Summary</Label>
                    <Textarea
                      {...register('summary')}
                      className="min-h-32 rounded-2xl border-[#d9d9d9] bg-white px-4 py-3 text-[#111111] shadow-none"
                      placeholder="Short professional summary from your resume"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
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

              <div className="space-y-2">
                <Label className={labelClassName}>LinkedIn</Label>
                <Input
                  value={linkedInUrl}
                  onChange={(e) => setLinkedInUrl(e.target.value)}
                  disabled={isAiBusy}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label className={labelClassName}>GitHub</Label>
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={isAiBusy}
                  placeholder="https://github.com/your-username"
                  className={inputClassName}
                />
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

                    <div className="flex items-center gap-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full border-[#d8d8d8] bg-white text-[#7b7b7b] hover:bg-red-50 hover:text-red-700"
                        onClick={handleRemoveResume}
                        disabled={isAiBusy}
                        aria-label="Remove resume"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
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

      </div>

      <div className="border-t border-[#ececec] bg-[#fcfcfc] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
          {isSetupMode ? (
            <Button
              type="button"
              className="rounded-2xl bg-red-700 px-6 text-white shadow-[0_10px_20px_rgba(185,28,28,0.16)] hover:bg-red-800"
              onClick={handleSetupSubmit}
              disabled={isAiBusy || !isSetupFormReady}
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

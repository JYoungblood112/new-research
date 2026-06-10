import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Command,
  Eye,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  PlusCircle,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserCircle,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../contexts/AuthContext';
import { useData, type Application } from '../../contexts/DataContext';
import { getStudentInterestCounts } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';

import PostResearchDialog from '../../components/professor/PostResearchDialog';
import ResearchImpactPipeline from '../../components/professor/ResearchImpactPipeline';
import ViewApplicationsDialog from '../../components/professor/ViewApplicationsDialog';

type SectionKey =
  | 'dashboard'
  | 'opportunities'
  | 'applicants'
  | 'messages'
  | 'lab-profile'
  | 'impact'
  | 'analytics'
  | 'settings';

type MessageFolder = 'inbox' | 'sent' | 'archived';
type MessageTemplateKind = 'interview' | 'request-info' | 'accept' | 'reject';
type MessageTemplateContent = {
  title: string;
  subject: string;
  body: string;
};

type CustomTemplateToken = {
  id: string;
  label: string;
  value: string;
};

const TEMPLATE_TOKENS = ['[Student Name]', '[Opportunity Title]', '[Professor Name]'] as const;

const MESSAGE_TEMPLATE_STORAGE_KEY = 'professor-message-templates-v1';
const MESSAGE_TEMPLATE_CUSTOM_TOKENS_STORAGE_KEY = 'professor-message-custom-tokens-v1';

const DEFAULT_MESSAGE_TEMPLATES: Record<MessageTemplateKind, MessageTemplateContent> = {
  interview: {
    title: 'Interview Invitation Template',
    subject: 'Interview Invitation - [Opportunity Title]',
    body:
      'Hi [Student Name],\n\nThank you for your application to [Opportunity Title]. We would like to invite you to an interview. Please share your availability for next week and your preferred format (virtual or in-person).\n\nBest,\nProfessor [Professor Name]',
  },
  'request-info': {
    title: 'Request Information Template',
    subject: 'Additional Information Requested - [Opportunity Title]',
    body:
      'Hi [Student Name],\n\nThank you for applying to [Opportunity Title]. We are interested in learning more about your experience with relevant coursework/projects. Please reply with:\n- 1-2 examples of related work\n- Your current time availability\n- Any links to code, publications, or project artifacts\n\nBest,\nProfessor [Professor Name]',
  },
  accept: {
    title: 'Acceptance Template',
    subject: 'Offer to Join [Opportunity Title]',
    body:
      'Hi [Student Name],\n\nWe are pleased to share that we would like to move forward with your application for [Opportunity Title]. Your background aligns well with the role requirements, and we would be excited to have you join the lab.\n\nPlease confirm your interest and availability so we can share onboarding details.\n\nBest,\nProfessor [Professor Name]',
  },
  reject: {
    title: 'Rejection Template',
    subject: 'Application Update - [Opportunity Title]',
    body:
      'Hi [Student Name],\n\nThank you for taking the time to apply to [Opportunity Title]. After review, we are moving forward with other candidates whose current profile is a closer fit for this cycle.\n\nWe appreciate your interest and encourage you to apply again in future cycles.\n\nBest,\nProfessor [Professor Name]',
  },
};

const NAV_ITEMS: Array<{ key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'applicants', label: 'Applicants', icon: Users },
  { key: 'opportunities', label: 'Research Opportunities', icon: Briefcase },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'lab-profile', label: 'Profile', icon: UserCircle },
];

const TREND_DATA = [42, 46, 40, 53, 61, 58, 67];
const MONTHLY_APPLICATIONS = [18, 21, 24, 19, 29, 34, 31, 42, 39, 44, 47, 52];
const SKILL_DISTRIBUTION = [
  { skill: 'Python', count: 35 },
  { skill: 'PyTorch', count: 22 },
  { skill: 'Data Analysis', count: 19 },
  { skill: 'React', count: 16 },
  { skill: 'SQL', count: 14 },
];
const TOP_MAJORS = [
  { major: 'Computer Science', count: 21 },
  { major: 'AI + Business', count: 10 },
  { major: 'Robotics', count: 7 },
  { major: 'HCI', count: 6 },
];

function normalizeInterestKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function computeMatchScore(application: Application) {
  const source = `${application.studentName}-${application.id}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 997;
  }
  return 65 + (hash % 36);
}

function getScoreBadgeClass(score: number) {
  if (score >= 90) {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (score >= 75) {
    return 'border border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border border-red-200 bg-red-50 text-red-700';
}

function buildAiInsights(score: number) {
  const strengths = [
    'Strong Python experience',
    'Relevant ML coursework',
    'High quality resume and role alignment',
  ];
  const concerns = [
    'No publication experience listed',
    'Limited prior lab research background',
  ];

  if (score < 80) {
    strengths[2] = 'Clear motivation for research growth';
    concerns[1] = 'Portfolio depth appears early-stage';
  }

  return {
    strengths,
    concerns,
    summary:
      score >= 90
        ? 'Candidate is a strong fit based on technical alignment, consistency, and applied project depth.'
        : score >= 75
          ? 'Candidate shows promising fit with good baseline alignment and clear potential with mentorship.'
          : 'Candidate may fit selective roles with support; recommend clarifying readiness during screening.',
  };
}

type RequirementStatus = 'met' | 'partial' | 'missing';

type StudentEvidenceProfile = {
  skills: string[];
  coursework: string[];
  githubProfileUrl: string;
  linkedinUrl?: string;
  githubRepos: Array<{ name: string; description: string; url?: string }>;
  personalStatement: string;
};

type EvidenceProof = {
  label: string;
  detail: string;
  href?: string;
};

const STUDENT_EVIDENCE_OVERRIDES: Record<string, StudentEvidenceProfile> = {
  mock_app_1: {
    skills: ['Python', 'ML', 'SQL', 'Research Writing', 'Pandas'],
    coursework: [
      '10-601 Machine Learning',
      '15-210 Parallel and Sequential Data Structures',
      '10-315 Introduction to Computer Vision',
    ],
    githubRepos: [
      {
        name: 'ml-research-portfolio',
        description: 'Model benchmarking and experiment tracking toolkit built in Python.',
        url: 'https://github.com/student-profile/ml-research-portfolio',
      },
      {
        name: 'llm-eval-lab',
        description: 'Evaluation scripts for instruction-tuned models on scientific text tasks.',
        url: 'https://github.com/student-profile/llm-eval-lab',
      },
    ],
    githubProfileUrl: 'https://github.com/student-profile',
    linkedinUrl: 'https://www.linkedin.com/in/student-profile',
    personalStatement:
      'I want to join this lab to apply machine learning to real, high-impact research problems while growing my experimental design and publication skills.',
  },
  mock_app_2: {
    skills: ['Python', 'Computer Vision', 'PyTorch', 'Experiment Design'],
    coursework: ['10-315 Introduction to Computer Vision', '10-601 Machine Learning', '21-325 Probability'],
    githubRepos: [
      {
        name: 'satellite-self-supervision',
        description: 'Self-supervised pretraining experiments for multi-spectral satellite imagery.',
        url: 'https://github.com/student-profile/satellite-self-supervision',
      },
    ],
    githubProfileUrl: 'https://github.com/student-profile',
    linkedinUrl: 'https://www.linkedin.com/in/student-profile',
    personalStatement:
      'I am interested in reproducible computer vision research and careful error analysis for remote sensing systems.',
  },
  mock_app_3: {
    skills: ['Python', 'UX Research', 'Data Analysis'],
    coursework: ['05-410 User-Centered Research and Evaluation', '36-401 Modern Regression'],
    githubRepos: [
      {
        name: 'adaptive-learning-ui',
        description: 'Interface experiments for novice programmers with analytics dashboards.',
        url: 'https://github.com/student-profile/adaptive-learning-ui',
      },
    ],
    githubProfileUrl: 'https://github.com/student-profile',
    linkedinUrl: 'https://www.linkedin.com/in/student-profile',
    personalStatement:
      'I want to strengthen my research foundations and learn to run structured studies that improve first-time learner outcomes.',
  },
};

function getStudentEvidenceProfile(application: Application): StudentEvidenceProfile {
  const override = STUDENT_EVIDENCE_OVERRIDES[application.id];
  if (override) {
    return override;
  }

  const major = application.studentMajor.toLowerCase();
  const statement = application.quickNote?.trim() || 'Interested in applying coursework to research deliverables.';

  if (major.includes('computer') || major.includes('ai')) {
    return {
      skills: ['Python', 'Machine Learning', 'Data Analysis'],
      coursework: ['10-601 Machine Learning', '15-210 Parallel and Sequential Data Structures'],
      githubRepos: [
        {
          name: 'research-ml-tooling',
          description: 'Python notebooks and scripts for model training, evaluation, and reporting.',
          url: 'https://github.com/student-profile/research-ml-tooling',
        },
      ],
      githubProfileUrl: 'https://github.com/student-profile',
      linkedinUrl: 'https://www.linkedin.com/in/student-profile',
      personalStatement: statement,
    };
  }

  return {
    skills: ['Python', 'Data Analysis', 'Research Communication'],
    coursework: ['36-401 Modern Regression', '70-311 Organizational Design and Implementation'],
    githubRepos: [
      {
        name: 'research-workflow-notes',
        description: 'Project organization templates and experimental writeups for course research.',
        url: 'https://github.com/student-profile/research-workflow-notes',
      },
    ],
    githubProfileUrl: 'https://github.com/student-profile',
    linkedinUrl: 'https://www.linkedin.com/in/student-profile',
    personalStatement: statement,
  };
}

function parseRequirementList(requirements?: string, fallback?: string[]) {
  const parsed = (requirements ?? '')
    .split(/\n|;|\.|\|/)
    .map((entry) => entry.replace(/^[-*\d)\s]+/, '').trim())
    .filter((entry) => entry.length >= 4);

  if (parsed.length > 0) {
    return parsed;
  }

  return fallback ?? [];
}

function getStatusDisplay(status: RequirementStatus) {
  if (status === 'met') {
    return {
      Icon: CheckCircle,
      iconClass: 'text-emerald-600',
      chipClass: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
      label: 'Met',
    };
  }

  if (status === 'partial') {
    return {
      Icon: AlertCircle,
      iconClass: 'text-amber-600',
      chipClass: 'border border-amber-200 bg-amber-50 text-amber-700',
      label: 'Partial',
    };
  }

  return {
    Icon: XCircle,
    iconClass: 'text-red-600',
    chipClass: 'border border-red-200 bg-red-50 text-red-700',
    label: 'Missing',
  };
}

function analyzeRequirement(
  requirement: string,
  profile: StudentEvidenceProfile,
  application: Application
): { requirement: string; status: RequirementStatus; assessment: string; proof: EvidenceProof[] } {
  const req = requirement.toLowerCase();
  const major = application.studentMajor;
  const statement = profile.personalStatement;
  const resumeName = application.resume.name;
  const resumeHref = '#resume-viewer';

  const skillMatches = profile.skills.filter((skill) => req.includes(skill.toLowerCase()));
  const courseMatches = profile.coursework.filter((course) => {
    const normalized = course.toLowerCase();
    return (
      (req.includes('machine learning') && (normalized.includes('machine learning') || normalized.includes('10-601'))) ||
      (req.includes('python') && normalized.includes('program')) ||
      (req.includes('vision') && normalized.includes('vision')) ||
      (req.includes('stat') && (normalized.includes('regression') || normalized.includes('probability'))) ||
      (req.includes('research') && normalized.includes('research'))
    );
  });

  const repoMatches = profile.githubRepos.filter((repo) => {
    const text = `${repo.name} ${repo.description}`.toLowerCase();
    return (
      (req.includes('python') && text.includes('python')) ||
      (req.includes('ml') && (text.includes('model') || text.includes('machine'))) ||
      (req.includes('research') && text.includes('experiment')) ||
      (req.includes('data') && text.includes('data')) ||
      (req.includes('vision') && text.includes('vision'))
    );
  });

  const mentionsPublication = req.includes('publication') || req.includes('published work') || req.includes('paper');
  if (mentionsPublication) {
    return {
      requirement,
      status: 'missing',
      assessment: `No publications are listed in ${resumeName}; recommend asking for preprints or writing samples if publication experience is required.`,
      proof: [
        {
          label: 'Resume',
          detail: `${resumeName} does not list accepted publications.`,
          href: resumeHref,
        },
      ],
    };
  }

  const asksForCoursework = /\b(coursework|course|class|taken)\b/i.test(req);
  const asksForPriorResearch = /\bprior\b.*\b(research|lab|experience)\b|\bresearch experience\b|\blab research\b/i.test(req);
  const hasDirectPriorResearch = /\b(research assistant|lab|publication|published|paper|poster|study)\b/i.test(statement);
  const hasAnyEvidence = skillMatches.length > 0 || courseMatches.length > 0 || repoMatches.length > 0;
  const hasStrongEvidence =
    asksForCoursework
      ? courseMatches.length > 0
      : asksForPriorResearch
        ? hasDirectPriorResearch
        : hasAnyEvidence;
  const hasIntentSignal = /research|experiment|independent|study|publication/i.test(statement);

  const evidenceParts: string[] = [];
  const proof: EvidenceProof[] = [];
  if (skillMatches.length > 0) {
    evidenceParts.push(`resume skills list ${skillMatches.join(', ')}`);
    proof.push({
      label: 'Resume skills',
      detail: `${resumeName} lists ${skillMatches.join(', ')}.`,
      href: resumeHref,
    });
  }
  if (courseMatches.length > 0) {
    evidenceParts.push(`coursework includes ${courseMatches.slice(0, 2).join(', ')}`);
    proof.push({
      label: 'Coursework',
      detail: courseMatches.slice(0, 2).join(', '),
      href: resumeHref,
    });
  }
  if (repoMatches.length > 0) {
    evidenceParts.push(`GitHub project ${repoMatches[0].name} shows related implementation work`);
    proof.push({
      label: 'GitHub project',
      detail: `${repoMatches[0].name}: ${repoMatches[0].description}`,
      href: repoMatches[0].url ?? profile.githubProfileUrl,
    });
  }

  if (hasStrongEvidence) {
    const assessment =
      courseMatches.length > 0 && asksForCoursework
        ? `Direct coursework evidence found: ${courseMatches.slice(0, 2).join(', ')}.`
        : repoMatches.length > 0 && skillMatches.length > 0
          ? `${skillMatches.join(', ')} appears in the resume skills, and ${repoMatches[0].name} provides project-level support.`
          : evidenceParts.length > 0
            ? evidenceParts.join('; ') + '.'
            : 'Direct supporting evidence found in submitted materials.';

    return {
      requirement,
      status: 'met',
      assessment,
      proof,
    };
  }

  if (hasAnyEvidence || hasIntentSignal || req.includes('research') || req.includes('experience')) {
    const partialProof = proof.length > 0
      ? proof
      : [
          {
            label: 'Application note',
            detail: statement,
          },
          {
            label: 'Resume',
            detail: `${resumeName} should be reviewed for deeper supporting examples.`,
            href: resumeHref,
          },
        ];
    const partialAssessment =
      asksForCoursework
        ? `Supporting signals exist, but no specific matching course is listed for this coursework requirement.`
        : asksForPriorResearch
          ? `Related project or motivation signals exist, but prior lab/research experience is not directly proven.`
          : hasAnyEvidence
            ? `Some supporting evidence found: ${evidenceParts.join('; ')}.`
            : `No direct credential listed, but the personal statement suggests transferable research habits from project-based work.`;

    return {
      requirement,
      status: 'partial',
      assessment: partialAssessment,
      proof: partialProof,
    };
  }

  return {
    requirement,
    status: 'missing',
    assessment: `This requirement is not explicitly supported by listed skills, coursework, or repository evidence; collect specific examples during interview.`,
    proof: [
      {
        label: 'Evidence gap',
        detail: `No direct match found in ${resumeName}, listed coursework, GitHub projects, or application note.`,
      },
    ],
  };
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'NA';
  }

  const first = parts[0][0]?.toUpperCase() ?? 'N';
  const second = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() ?? '' : '';
  return `${first}${second}`;
}

function getAvatarTone(seed: string) {
  const tones = [
    'bg-[#d8d4fb] text-[#3f3a8a]',
    'bg-[#bdeee3] text-[#155746]',
    'bg-[#f8d7c7] text-[#6e3a27]',
    'bg-[#d7e8fb] text-[#254a77]',
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }

  return tones[Math.abs(hash) % tones.length];
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export default function ProfessorDashboard() {
  const { user, logout, setupState, updateProfessorProfile } = useAuth();
  const { applications, getApplicationsByPosting, getPostingsByProfessor, updateApplicationStatus, addPosting } = useData();
  const navigate = useNavigate();

  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [editingPosting, setEditingPosting] = useState<any | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('dashboard');
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});
  const [messageFolder, setMessageFolder] = useState<MessageFolder>('inbox');
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateRecipients, setTemplateRecipients] = useState<string[]>([]);
  const [isSendingQueue, setIsSendingQueue] = useState(false);
  const [sendQueueProgress, setSendQueueProgress] = useState<{ sent: number; total: number; recipient: string } | null>(null);
  const [activeComposeField, setActiveComposeField] = useState<'subject' | 'body'>('body');
  const [openTemplateEditorDialog, setOpenTemplateEditorDialog] = useState(false);
  const [editingTemplateKind, setEditingTemplateKind] = useState<MessageTemplateKind>('interview');
  const [editingTemplateSubject, setEditingTemplateSubject] = useState('');
  const [editingTemplateBody, setEditingTemplateBody] = useState('');
  const [activeEditorField, setActiveEditorField] = useState<'subject' | 'body'>('body');
  const [templateOverrides, setTemplateOverrides] = useState<Partial<Record<MessageTemplateKind, MessageTemplateContent>>>({});
  const [customTemplateTokens, setCustomTemplateTokens] = useState<CustomTemplateToken[]>([]);
  const [newCustomTokenLabel, setNewCustomTokenLabel] = useState('');
  const [newCustomTokenValue, setNewCustomTokenValue] = useState('');
  const composeSubjectRef = useRef<HTMLInputElement | null>(null);
  const composeBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const editorSubjectRef = useRef<HTMLInputElement | null>(null);
  const editorBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantStatusFilter, setApplicantStatusFilter] = useState<'all' | Application['status']>('all');
  const [applicantSort, setApplicantSort] = useState<'score' | 'date' | 'project'>('score');
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [openCommandPalette, setOpenCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfileValidationErrors, setShowProfileValidationErrors] = useState(false);
  const initializedDefaultSection = useRef(false);

  const professorProfile =
    (setupState?.profile as
      | {
          department?: string;
          title?: string;
          contactEmail?: string;
          bioUrl?: string;
          researchAreas?: string;
          professorWebsite?: string;
          publicationsLink?: string;
          researchInterests?: string;
        }
      | undefined) ?? {};

  const createProfileFormState = () => ({
    name: user?.name ?? '',
    department: professorProfile.department ?? '',
    title: professorProfile.title ?? '',
    contactEmail: professorProfile.contactEmail ?? user?.email ?? '',
    bioUrl: professorProfile.bioUrl ?? '',
    researchAreas: professorProfile.researchAreas ?? '',
    professorWebsite: professorProfile.professorWebsite ?? '',
    publicationsLink: professorProfile.publicationsLink ?? '',
    researchInterests: professorProfile.researchInterests ?? '',
  });

  const [labForm, setLabForm] = useState(createProfileFormState);

  const trimmedProfileName = labForm.name.trim();
  const trimmedProfileDepartment = labForm.department.trim();
  const trimmedProfileTitle = labForm.title.trim();
  const trimmedProfileContactEmail = labForm.contactEmail.trim();
  const trimmedProfileBioUrl = labForm.bioUrl.trim();
  const trimmedProfileProfessorWebsite = labForm.professorWebsite.trim();
  const trimmedProfilePublicationsLink = labForm.publicationsLink.trim();
  const missingProfileName = showProfileValidationErrors && !trimmedProfileName;
  const missingProfileDepartment = showProfileValidationErrors && !trimmedProfileDepartment;
  const missingProfileTitle = showProfileValidationErrors && !trimmedProfileTitle;
  const missingProfileContactEmail = showProfileValidationErrors && !trimmedProfileContactEmail;
  const hasInvalidProfileContactEmail = Boolean(trimmedProfileContactEmail) && !isValidEmail(trimmedProfileContactEmail);
  const hasInvalidProfileBioUrl = Boolean(trimmedProfileBioUrl) && !isValidUrl(trimmedProfileBioUrl);
  const hasInvalidProfileProfessorWebsite = Boolean(trimmedProfileProfessorWebsite) && !isValidUrl(trimmedProfileProfessorWebsite);
  const hasInvalidProfilePublicationsLink = Boolean(trimmedProfilePublicationsLink) && !isValidUrl(trimmedProfilePublicationsLink);

  const handleCancelDashboardProfile = () => {
    setLabForm(createProfileFormState());
    setShowProfileValidationErrors(false);
    toast.success('Profile edits cleared');
  };

  const hasUnsavedDashboardProfileChanges = () => {
    const saved = createProfileFormState();
    return (
      labForm.name !== saved.name ||
      labForm.department !== saved.department ||
      labForm.title !== saved.title ||
      labForm.contactEmail !== saved.contactEmail ||
      labForm.bioUrl !== saved.bioUrl ||
      labForm.researchAreas !== saved.researchAreas ||
      labForm.professorWebsite !== saved.professorWebsite ||
      labForm.publicationsLink !== saved.publicationsLink ||
      labForm.researchInterests !== saved.researchInterests
    );
  };

  const handleSaveDashboardProfile = async ({ showSuccessToast = true }: { showSuccessToast?: boolean } = {}) => {
    setShowProfileValidationErrors(true);

    const trimmedName = labForm.name.trim();
    const trimmedDepartment = labForm.department.trim();
    const trimmedTitle = labForm.title.trim();
    const trimmedContactEmail = labForm.contactEmail.trim();
    const trimmedBioUrl = labForm.bioUrl.trim();
    const trimmedProfessorWebsite = labForm.professorWebsite.trim();
    const trimmedPublicationsLink = labForm.publicationsLink.trim();

    if (!trimmedName || !trimmedDepartment || !trimmedTitle || !trimmedContactEmail) {
      toast.error('Please complete all required fields before saving.');
      return false;
    }

    if (!isValidEmail(trimmedContactEmail)) {
      toast.error('Please enter a valid contact email.');
      return false;
    }

    if (trimmedBioUrl && !isValidUrl(trimmedBioUrl)) {
      toast.error('Bio link must start with http:// or https://');
      return false;
    }

    if (trimmedProfessorWebsite && !isValidUrl(trimmedProfessorWebsite)) {
      toast.error("Professor's website must start with http:// or https://");
      return false;
    }

    if (trimmedPublicationsLink && !isValidUrl(trimmedPublicationsLink)) {
      toast.error('Publications link must start with http:// or https://');
      return false;
    }

    setIsSavingProfile(true);
    try {
      await updateProfessorProfile({
        name: trimmedName,
        department: trimmedDepartment,
        title: trimmedTitle,
        contactEmail: trimmedContactEmail,
        bioUrl: trimmedBioUrl || undefined,
        researchAreas: labForm.researchAreas.trim() || undefined,
        professorWebsite: trimmedProfessorWebsite || undefined,
        publicationsLink: trimmedPublicationsLink || undefined,
        researchInterests: labForm.researchInterests.trim() || undefined,
      });
      setShowProfileValidationErrors(false);
      if (showSuccessToast) {
        toast.success('Profile changes saved');
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile changes');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSectionChange = async (nextSection: SectionKey) => {
    if (nextSection === activeSection || isSavingProfile) {
      return false;
    }

    if (activeSection === 'lab-profile' && hasUnsavedDashboardProfileChanges()) {
      const saved = await handleSaveDashboardProfile({ showSuccessToast: false });
      if (!saved) {
        return false;
      }
      toast.success('Profile changes saved');
    }

    setActiveSection(nextSection);
    return true;
  };

  const myPostings = getPostingsByProfessor(user!.id);
  const myPostingIds = useMemo(() => new Set(myPostings.map((posting) => posting.id)), [myPostings]);
  const myApplications = useMemo(
    () => applications.filter((application) => myPostingIds.has(application.postingId)),
    [applications, myPostingIds]
  );
  const fallbackApplicantRows = useMemo(
    () => [
      {
        application: {
          id: 'mock_app_1',
          postingId: 'mock_post_1',
          studentId: 'mock_student_1',
          studentName: 'Jonathan Youngblood',
          studentEmail: 'jyounb2@andrew.cmu.edu',
          studentMajor: 'AI + Business',
          resume: { name: 'jonathan_youngblood_resume.pdf', uploadDate: '2026-05-21T14:00:00.000Z' },
          answers: {},
          quickNote: 'Excited to contribute to model evaluation and applied research.',
          status: 'Shortlisted' as const,
          submittedAt: '2026-05-21T14:00:00.000Z',
        },
        posting: { id: 'mock_post_1', title: 'Efficient LLM Fine-Tuning for Scientific Text' },
        score: 92,
      },
      {
        application: {
          id: 'mock_app_2',
          postingId: 'mock_post_2',
          studentId: 'mock_student_2',
          studentName: 'Sarah Chen',
          studentEmail: 'schen2@andrew.cmu.edu',
          studentMajor: 'Computer Science',
          resume: { name: 'sarah_chen_resume.pdf', uploadDate: '2026-05-19T10:30:00.000Z' },
          answers: {},
          quickNote: 'Strong fit for computer vision workflows and experiment design.',
          status: 'Interview' as const,
          submittedAt: '2026-05-19T10:30:00.000Z',
        },
        posting: { id: 'mock_post_2', title: 'Self-Supervised Learning for Satellite Imagery' },
        score: 89,
      },
      {
        application: {
          id: 'mock_app_3',
          postingId: 'mock_post_3',
          studentId: 'mock_student_3',
          studentName: 'Alex Rivera',
          studentEmail: 'arivera@andrew.cmu.edu',
          studentMajor: 'Information Systems',
          resume: { name: 'alex_rivera_resume.pdf', uploadDate: '2026-05-18T09:15:00.000Z' },
          answers: {},
          quickNote: 'Motivated to grow in research methodology and implementation.',
          status: 'Pending' as const,
          submittedAt: '2026-05-18T09:15:00.000Z',
        },
        posting: { id: 'mock_post_3', title: 'Adaptive Interfaces for First-Time Programmers' },
        score: 74,
      },
    ],
    []
  );

  const postingById = useMemo(() => {
    const map = new Map<string, (typeof myPostings)[number]>();
    for (const posting of myPostings) {
      map.set(posting.id, posting);
    }
    return map;
  }, [myPostings]);

  const publishedPostings = myPostings.filter((posting) => posting.status === 'published');
  const pendingApprovalPostings = myPostings.filter((posting) => posting.status === 'pending_approval');
  const closedPostings = myPostings.filter((posting) => posting.status === 'closed');

  const applicantsWithPosting = useMemo(() => {
    if (myApplications.length === 0) {
      return fallbackApplicantRows;
    }

    return myApplications.map((application) => {
      const score = computeMatchScore(application);
      return {
        application,
        posting: postingById.get(application.postingId),
        score,
      };
    });
  }, [myApplications, fallbackApplicantRows, postingById]);

  const activeOpenings = publishedPostings.length;
  const totalApplicants = applicantsWithPosting.length;
  const pendingReviews = applicantsWithPosting.filter(({ application }) => application.status === 'Pending').length;
  const interviewsScheduled = applicantsWithPosting.filter(({ application }) => application.status === 'Interview').length;

  const acceptanceRate = totalApplicants
    ? Math.round((applicantsWithPosting.filter(({ application }) => application.status === 'Accepted').length / totalApplicants) * 100)
    : 0;
  const interviewConversionRate = totalApplicants ? Math.round((interviewsScheduled / totalApplicants) * 100) : 0;

  const recentActivities = useMemo(() => {
    return [...applicantsWithPosting]
      .sort((a, b) => new Date(b.application.submittedAt).getTime() - new Date(a.application.submittedAt).getTime())
      .slice(0, 6)
      .map(({ application }) => ({
        id: application.id,
        label:
          application.status === 'Pending'
            ? `New application received from ${application.studentName}`
            : `${application.studentName} moved to ${application.status}`,
        time: new Date(application.submittedAt).toLocaleDateString(),
      }));
  }, [applicantsWithPosting]);

  const filteredApplicants = useMemo(() => {
    const query = applicantSearch.trim().toLowerCase();

    const filtered = applicantsWithPosting.filter(({ application }) => {
      const matchesQuery =
        !query ||
        application.studentName.toLowerCase().includes(query) ||
        application.studentMajor.toLowerCase().includes(query) ||
        application.studentEmail.toLowerCase().includes(query) ||
        (postingById.get(application.postingId)?.title ?? '').toLowerCase().includes(query);
      const matchesStatus = applicantStatusFilter === 'all' || application.status === applicantStatusFilter;
      return matchesQuery && matchesStatus;
    });

    if (applicantSort === 'score') {
      return filtered.sort((a, b) => b.score - a.score);
    }

    if (applicantSort === 'project') {
      return filtered.sort((a, b) => {
        const titleA = (a.posting?.title ?? '').toLowerCase();
        const titleB = (b.posting?.title ?? '').toLowerCase();
        return titleA.localeCompare(titleB);
      });
    }

    return filtered.sort(
      (a, b) => new Date(b.application.submittedAt).getTime() - new Date(a.application.submittedAt).getTime()
    );
  }, [applicantSearch, applicantSort, applicantStatusFilter, applicantsWithPosting, postingById]);

  const selectedApplicant = useMemo(() => {
    if (!selectedApplicantId) {
      return null;
    }
    return applicantsWithPosting.find(({ application }) => application.id === selectedApplicantId) ?? null;
  }, [selectedApplicantId, applicantsWithPosting]);

  const selectedApplicantEvidence = useMemo(() => {
    if (!selectedApplicant) {
      return null;
    }
    return getStudentEvidenceProfile(selectedApplicant.application);
  }, [selectedApplicant]);

  const selectedApplicantRequirementAnalysis = useMemo(() => {
    if (!selectedApplicant || !selectedApplicantEvidence) {
      return [];
    }

    const posting = selectedApplicant.posting;
    const fallbackRequirements = ['Python proficiency', 'ML coursework', 'Prior research experience'];
    const requirements = parseRequirementList(posting && 'requiredQualifications' in posting ? posting.requiredQualifications : undefined, fallbackRequirements);

    return requirements.slice(0, 6).map((requirement) =>
      analyzeRequirement(requirement, selectedApplicantEvidence, selectedApplicant.application)
    );
  }, [selectedApplicant, selectedApplicantEvidence]);

  const conversations = useMemo(
    () =>
      filteredApplicants.slice(0, 8).map(({ application }) => ({
        id: application.id,
        name: application.studentName,
        subject: `Application update for ${postingById.get(application.postingId)?.title ?? 'Research role'}`,
        preview: 'Thank you for applying. We would like to share your current review status and next steps.',
        folder: application.status === 'Rejected' ? 'archived' : 'inbox',
      })),
    [filteredApplicants, postingById]
  );

  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        if (messageFolder === 'sent') {
          return false;
        }
        return conversation.folder === messageFolder;
      }),
    [conversations, messageFolder]
  );

  const allVisibleConversationIds = useMemo(
    () => visibleConversations.map((conversation) => conversation.id),
    [visibleConversations]
  );

  const allVisibleConversationsSelected =
    allVisibleConversationIds.length > 0 &&
    allVisibleConversationIds.every((id) => selectedConversationIds.includes(id));

  const selectedVisibleConversationCount = selectedConversationIds.filter((id) =>
    allVisibleConversationIds.includes(id)
  ).length;

  const openMessageTemplate = (kind: MessageTemplateKind) => {
    const visibleConversationMap = new Map(visibleConversations.map((conversation) => [conversation.id, conversation]));
    const selectedRecipients = selectedConversationIds
      .map((conversationId) => visibleConversationMap.get(conversationId))
      .filter((conversation): conversation is (typeof visibleConversations)[number] => Boolean(conversation));
    const recipients = selectedRecipients.length > 0 ? selectedRecipients : visibleConversations.slice(0, 1);

    if (recipients.length === 0) {
      toast.error('Select at least one conversation to create a message.');
      return;
    }

    const recipientNames = recipients.map((recipient) => recipient.name);
    const recipient = recipients.length === 1 ? recipientNames[0] : '[Student Name]';
    const opportunity = filteredApplicants[0]?.posting?.title ?? 'the research position';
    const professorName = user?.name ?? '[Professor Name]';
    const template = templateOverrides[kind] ?? DEFAULT_MESSAGE_TEMPLATES[kind];

    const replaceTokens = (text: string) =>
      text
        .split('[Student Name]').join(recipient)
        .split('[Opportunity Title]').join(opportunity)
        .split('[Professor Name]').join(professorName);

    setTemplateRecipients(recipientNames);
    setSendQueueProgress(null);
    setIsSendingQueue(false);
    setTemplateTitle(recipients.length > 1 ? `${template.title} (Bulk)` : template.title);
    setTemplateSubject(replaceTokens(template.subject));
    setTemplateBody(replaceTokens(template.body));
    setOpenTemplateDialog(true);
  };

  const processMessageQueueSend = async () => {
    const recipients = templateRecipients.filter(Boolean);
    if (recipients.length === 0) {
      toast.error('No recipients selected.');
      return;
    }

    setIsSendingQueue(true);
    setSendQueueProgress({ sent: 0, total: recipients.length, recipient: recipients[0] });

    try {
      for (let index = 0; index < recipients.length; index += 1) {
        const recipient = recipients[index];

        // Resolve recipient-specific tokens so each queued message is personalized.
        const individualizedSubject = templateSubject.split('[Student Name]').join(recipient);
        const individualizedBody = templateBody.split('[Student Name]').join(recipient);

        // Simulated send payload for now; this is where backend email send would be invoked.
        void individualizedSubject;
        void individualizedBody;

        // Simulate sequential queue sends in recipient selection order.
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 320);
        });

        setSendQueueProgress({ sent: index + 1, total: recipients.length, recipient });
      }

      toast.success(`Sent ${recipients.length}/${recipients.length} emails.`);
      setSelectedConversationIds([]);
      setTemplateRecipients([]);
      setOpenTemplateDialog(false);
      setSendQueueProgress(null);
    } finally {
      setIsSendingQueue(false);
    }
  };

  const toggleSelectConversation = (conversationId: string) => {
    setSelectedConversationIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId]
    );
  };

  const toggleSelectAllVisibleConversations = () => {
    if (allVisibleConversationsSelected) {
      setSelectedConversationIds((current) =>
        current.filter((id) => !allVisibleConversationIds.includes(id))
      );
      return;
    }

    setSelectedConversationIds((current) => {
      const merged = new Set([...current, ...allVisibleConversationIds]);
      return Array.from(merged);
    });
  };

  const appendToken = (current: string, token: string) => {
    if (!current) {
      return token;
    }
    return /\s$/.test(current) ? `${current}${token}` : `${current} ${token}`;
  };

  const insertAtCursor = (current: string, token: string, selectionStart: number | null, selectionEnd: number | null) => {
    if (selectionStart === null || selectionEnd === null) {
      return appendToken(current, token);
    }
    const before = current.slice(0, selectionStart);
    const after = current.slice(selectionEnd);
    return `${before}${token}${after}`;
  };

  const insertTokenIntoCompose = (token: string) => {
    if (activeComposeField === 'subject') {
      const input = composeSubjectRef.current;
      const next = insertAtCursor(templateSubject, token, input?.selectionStart ?? null, input?.selectionEnd ?? null);
      setTemplateSubject(next);
      return;
    }

    const textarea = composeBodyRef.current;
    const next = insertAtCursor(templateBody, token, textarea?.selectionStart ?? null, textarea?.selectionEnd ?? null);
    setTemplateBody(next);
  };

  const insertTokenIntoEditor = (token: string) => {
    if (activeEditorField === 'subject') {
      const input = editorSubjectRef.current;
      const next = insertAtCursor(
        editingTemplateSubject,
        token,
        input?.selectionStart ?? null,
        input?.selectionEnd ?? null
      );
      setEditingTemplateSubject(next);
      return;
    }

    const textarea = editorBodyRef.current;
    const next = insertAtCursor(
      editingTemplateBody,
      token,
      textarea?.selectionStart ?? null,
      textarea?.selectionEnd ?? null
    );
    setEditingTemplateBody(next);
  };

  const allTemplateTokens = useMemo(() => {
    const defaults = TEMPLATE_TOKENS.map((value) => ({
      key: `default-${value}`,
      label: value,
      value,
    }));

    const customs = customTemplateTokens.map((token) => ({
      key: token.id,
      label: token.label,
      value: token.value,
    }));

    return [...defaults, ...customs];
  }, [customTemplateTokens]);

  const addCustomToken = () => {
    const label = newCustomTokenLabel.trim();
    const value = newCustomTokenValue.trim();

    if (!label || !value) {
      toast.error('Enter both a label and token value.');
      return;
    }

    if (allTemplateTokens.some((token) => token.value === value)) {
      toast.error('That token already exists.');
      return;
    }

    const next = [
      ...customTemplateTokens,
      {
        id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label,
        value,
      },
    ];
    setCustomTemplateTokens(next);
    window.localStorage.setItem(MESSAGE_TEMPLATE_CUSTOM_TOKENS_STORAGE_KEY, JSON.stringify(next));
    setNewCustomTokenLabel('');
    setNewCustomTokenValue('');
    toast.success('Custom token added.');
  };

  const removeCustomToken = (tokenId: string) => {
    const next = customTemplateTokens.filter((entry) => entry.id !== tokenId);
    setCustomTemplateTokens(next);
    window.localStorage.setItem(MESSAGE_TEMPLATE_CUSTOM_TOKENS_STORAGE_KEY, JSON.stringify(next));
    toast.success('Custom token removed.');
  };

  const openTemplateEditor = (kind: MessageTemplateKind) => {
    const template = templateOverrides[kind] ?? DEFAULT_MESSAGE_TEMPLATES[kind];
    setEditingTemplateKind(kind);
    setEditingTemplateSubject(template.subject);
    setEditingTemplateBody(template.body);
    setOpenTemplateEditorDialog(true);
  };

  const saveTemplateEdits = () => {
    const nextTemplate: MessageTemplateContent = {
      title: DEFAULT_MESSAGE_TEMPLATES[editingTemplateKind].title,
      subject: editingTemplateSubject,
      body: editingTemplateBody,
    };

    const nextOverrides = {
      ...templateOverrides,
      [editingTemplateKind]: nextTemplate,
    };

    setTemplateOverrides(nextOverrides);
    window.localStorage.setItem(MESSAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(nextOverrides));
    toast.success('Template saved.');
    setOpenTemplateEditorDialog(false);
  };

  const resetTemplateEdits = () => {
    const nextOverrides = { ...templateOverrides };
    delete nextOverrides[editingTemplateKind];
    setTemplateOverrides(nextOverrides);
    window.localStorage.setItem(MESSAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(nextOverrides));
    const defaultTemplate = DEFAULT_MESSAGE_TEMPLATES[editingTemplateKind];
    setEditingTemplateSubject(defaultTemplate.subject);
    setEditingTemplateBody(defaultTemplate.body);
    toast.success('Template reset to default.');
  };

  const commandItems = useMemo(
    () => [...NAV_ITEMS, { key: 'settings' as SectionKey, label: 'Settings', icon: Settings }]
      .filter((item) => item.label.toLowerCase().includes(commandQuery.trim().toLowerCase())),
    [commandQuery]
  );

  const todaysQueue = useMemo(() => {
    return [...applicantsWithPosting]
      .filter(({ application }) => application.status === 'Pending' || application.status === 'Interview')
      .sort((a, b) => new Date(b.application.submittedAt).getTime() - new Date(a.application.submittedAt).getTime())
      .slice(0, 6);
  }, [applicantsWithPosting]);

  const highMatchUnreviewed = useMemo(
    () => applicantsWithPosting.filter(({ application, score }) => application.status === 'Pending' && score >= 88).length,
    [applicantsWithPosting]
  );

  const expiringPostings = useMemo(
    () => publishedPostings.filter((posting) => {
      const deadline = new Date(posting.applicationDeadline).getTime();
      const now = Date.now();
      const inSevenDays = now + 7 * 24 * 60 * 60 * 1000;
      return deadline >= now && deadline <= inSevenDays;
    }).length,
    [publishedPostings]
  );

  const applicantSortLabel =
    applicantSort === 'score'
      ? 'Sorted by: match score ↓'
      : applicantSort === 'date'
        ? 'Sorted by: application date ↓'
        : 'Sorted by: research project A-Z';

  const allVisibleApplicantIds = useMemo(
    () => filteredApplicants.map(({ application }) => application.id),
    [filteredApplicants]
  );

  const allVisibleSelected =
    allVisibleApplicantIds.length > 0 && allVisibleApplicantIds.every((id) => selectedApplicantIds.includes(id));

  const selectedVisibleCount = selectedApplicantIds.filter((id) => allVisibleApplicantIds.includes(id)).length;

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MESSAGE_TEMPLATE_STORAGE_KEY);
      if (!raw) {
        setTemplateOverrides({});
      } else {
        const parsed = JSON.parse(raw) as Partial<Record<MessageTemplateKind, MessageTemplateContent>>;
        setTemplateOverrides(parsed);
      }
    } catch {
      setTemplateOverrides({});
    }

    try {
      const rawTokens = window.localStorage.getItem(MESSAGE_TEMPLATE_CUSTOM_TOKENS_STORAGE_KEY);
      if (!rawTokens) {
        setCustomTemplateTokens([]);
      } else {
        const parsedTokens = JSON.parse(rawTokens) as Array<string | CustomTemplateToken>;
        const migrated = parsedTokens
          .map((entry) => {
            if (typeof entry === 'string') {
              const value = entry.trim();
              if (!value) {
                return null;
              }
              return {
                id: `legacy-${value}`,
                label: value,
                value,
              } as CustomTemplateToken;
            }

            if (!entry || typeof entry !== 'object') {
              return null;
            }

            const label = String((entry as CustomTemplateToken).label ?? '').trim();
            const value = String((entry as CustomTemplateToken).value ?? '').trim();
            const id = String((entry as CustomTemplateToken).id ?? '').trim() || `custom-${Date.now()}`;

            if (!label || !value) {
              return null;
            }

            return { id, label, value } as CustomTemplateToken;
          })
          .filter((entry): entry is CustomTemplateToken => Boolean(entry));

        setCustomTemplateTokens(migrated);
      }
    } catch {
      setCustomTemplateTokens([]);
    }
  }, []);

  useEffect(() => {
    if (!initializedDefaultSection.current) {
      if (pendingReviews > 0) {
        setActiveSection('applicants');
      }
      initializedDefaultSection.current = true;
    }
  }, [pendingReviews]);

  useEffect(() => {
    setSelectedApplicantIds((current) => current.filter((id) => allVisibleApplicantIds.includes(id)));
  }, [allVisibleApplicantIds]);

  useEffect(() => {
    setSelectedConversationIds((current) =>
      current.filter((id) => allVisibleConversationIds.includes(id))
    );
  }, [allVisibleConversationIds]);

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedApplicantIds((current) => current.filter((id) => !allVisibleApplicantIds.includes(id)));
      return;
    }

    setSelectedApplicantIds((current) => {
      const merged = new Set([...current, ...allVisibleApplicantIds]);
      return Array.from(merged);
    });
  };

  const toggleSelectApplicant = (applicantId: string) => {
    setSelectedApplicantIds((current) =>
      current.includes(applicantId)
        ? current.filter((id) => id !== applicantId)
        : [...current, applicantId]
    );
  };

  const applyBulkStatus = (nextStatus: Application['status']) => {
    const targetIds = selectedApplicantIds.filter((id) => allVisibleApplicantIds.includes(id));
    if (targetIds.length === 0) {
      toast.error('Select at least one applicant first.');
      return;
    }

    targetIds.forEach((id) => updateApplicationStatus(id, nextStatus));
    toast.success(`${targetIds.length} applicants moved to ${nextStatus}.`);
    setSelectedApplicantIds((current) => current.filter((id) => !targetIds.includes(id)));
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setAnalyticsLoading(false), 550);
    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpenCommandPalette((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const headerSurface = darkMode
    ? 'border-[#2a2a2a] bg-[linear-gradient(120deg,#1c1c1c_0%,#171717_45%,#141414_100%)]'
    : 'border-[#e6dfdc] bg-[linear-gradient(120deg,#fffdfa_0%,#fff7f5_45%,#f8f7fb_100%)]';
  const pageSurface = darkMode ? 'bg-[#111111] text-[#efefef]' : 'bg-[#f7f7f7] text-[#111111]';
  const cardSurface = darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d0ceca] bg-white';
  const subduedText = darkMode ? 'text-[#9f9f9f]' : 'text-[#6f6f6f]';

  return (
    <div className={`min-h-screen ${pageSurface}`}>
      <header className={`border-b ${headerSurface}`}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5">
          <div className="space-y-1">
            <p className={`text-xs font-medium uppercase tracking-[0.22em] ${darkMode ? 'text-[#9f8f87]' : 'text-[#8b7f79]'}`}>
              Professor Workspace
            </p>
            <h1 className="text-[1.85rem] font-semibold leading-none tracking-tight">Professor Dashboard</h1>
            <p className={`text-sm ${subduedText}`}>Signed in as {user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`rounded-xl ${darkMode ? 'border-[#353535] bg-[#171717] text-[#e8e8e8] hover:bg-[#212121]' : 'border-[#dedede] bg-white text-[#1c1c1c] hover:bg-[#f7f7f7]'}`}
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => void handleSectionChange('settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleLogout()}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className={`rounded-xl ${darkMode ? 'border-[#353535] bg-[#171717] text-[#e8e8e8] hover:bg-[#212121]' : 'border-[#dedede] bg-white text-[#1c1c1c] hover:bg-[#f7f7f7]'}`}
              onClick={() => setOpenCommandPalette(true)}
            >
              <Command className="mr-2 h-4 w-4" />
              Search
              <span className={`ml-3 rounded border px-1.5 py-0.5 text-[10px] ${darkMode ? 'border-[#4a4a4a]' : 'border-[#d9d9d9]'}`}>
                Ctrl+K
              </span>
            </Button>
            <Button
              variant="ghost"
              className={`rounded-xl border px-4 ${darkMode ? 'border-[#353535] bg-[#171717] text-[#f0f0f0] hover:bg-[#212121]' : 'border-[#dedede] bg-white text-[#1c1c1c] hover:bg-[#f7f7f7]'}`}
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] gap-4 px-4 py-6">
        <aside
          className={`sticky top-4 self-start max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border p-3 transition-all duration-300 ${cardSurface} ${sidebarCollapsed ? 'w-[84px]' : 'w-[270px]'}`}
        >
          <div className="mb-3 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <div>
                <p className="text-sm font-semibold">Navigation</p>
                <p className={`text-xs ${subduedText}`}>Professor tools</p>
              </div>
            ) : (
              <span className="text-xs font-semibold">Nav</span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              const isApplicants = item.key === 'applicants';

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void handleSectionChange(item.key)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : darkMode
                        ? 'border-transparent text-[#d4d4d4] hover:border-[#343434] hover:bg-[#212121]'
                        : 'border-transparent text-[#5d5d5d] hover:border-[#e4e4e4] hover:bg-[#f8f8f8]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                  {!sidebarCollapsed && isApplicants && pendingReviews > 0 ? (
                    <Badge variant="destructive" className="rounded-full px-2 py-0 text-[10px]">
                      {pendingReviews}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          {activeSection === 'dashboard' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Active Openings"
                  value={activeOpenings}
                  trend="+12%"
                  trendLabel="vs last month"
                  chartValues={TREND_DATA}
                  darkMode={darkMode}
                />
                <MetricCard
                  title="Total Applicants"
                  value={totalApplicants}
                  trend="+8%"
                  trendLabel="weekly growth"
                  chartValues={[33, 35, 37, 39, 42, 44, 42]}
                  darkMode={darkMode}
                />
                <MetricCard
                  title="Pending Reviews"
                  value={pendingReviews}
                  trend="-3%"
                  trendLabel="after triage"
                  chartValues={[22, 20, 19, 18, 17, 18, pendingReviews]}
                  darkMode={darkMode}
                />
                <MetricCard
                  title="Interviews Scheduled"
                  value={interviewsScheduled}
                  trend="+5%"
                  trendLabel="this week"
                  chartValues={[3, 4, 4, 5, 6, 5, interviewsScheduled]}
                  darkMode={darkMode}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className={cardSurface}>
                  <CardHeader>
                    <CardTitle>Today's Queue</CardTitle>
                    <CardDescription>High-priority actions for the next 30 minutes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className={`rounded-xl border px-3 py-2 text-sm ${darkMode ? 'border-[#2b2b2b] bg-[#1a1a1a]' : 'border-[#ececec] bg-[#fafafa]'}`}>
                      <p className="font-medium">AI Nudge</p>
                      <p className={`mt-1 text-xs ${subduedText}`}>
                        {highMatchUnreviewed} unreviewed applicants above 88% match • {expiringPostings} postings with deadlines in 7 days.
                      </p>
                    </div>
                    {todaysQueue.length === 0 ? (
                      <p className={subduedText}>No urgent items right now.</p>
                    ) : (
                      todaysQueue.map(({ application, posting, score }) => (
                        <div
                          key={application.id}
                          className={`rounded-xl border p-3 text-sm ${darkMode ? 'border-[#2b2b2b] bg-[#1a1a1a]' : 'border-[#ececec] bg-[#fafafa]'}`}
                        >
                          <p className="font-medium">{application.studentName} for {posting?.title ?? 'Research role'}</p>
                          <p className={`mt-1 text-xs ${subduedText}`}>
                            Status: {application.status} • Score {score}% • Submitted {new Date(application.submittedAt).toLocaleDateString()}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={async () => {
                              const switched = await handleSectionChange('applicants');
                              if (switched) {
                                setSelectedApplicantId(application.id);
                              }
                            }}>
                              Review
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { void handleSectionChange('messages'); }}>
                              Message
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {activeSection === 'opportunities' ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Research Opportunities</h2>
                  <p className={`text-sm ${subduedText}`}>Card-based management for your openings and statuses.</p>
                </div>
                <Button className="rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => setShowPostDialog(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Opportunity
                </Button>
              </div>

              <Tabs defaultValue="open" className="space-y-4">
                <TabsList className={`h-auto rounded-2xl border p-1.5 ${darkMode ? 'border-[#333333] bg-[#1b1b1b]' : 'border-[#dddddd] bg-white'}`}>
                  <TabsTrigger
                    value="open"
                    className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
                  >
                    Open ({publishedPostings.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="approval"
                    className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
                  >
                    Pending ({pendingApprovalPostings.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="closed"
                    className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
                  >
                    Closed ({closedPostings.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="open" className="space-y-4">
                  {publishedPostings.length === 0 ? (
                    <Card className={cardSurface}>
                      <CardContent className="py-12 text-center">
                        <p className={subduedText}>No open opportunities yet.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    publishedPostings.map((posting) => (
                      <PostingCard
                        key={posting.id}
                        posting={posting}
                        interestedCount={interestCounts[normalizeInterestKey(posting.category)] ?? 0}
                        onViewApplications={(postingId) => {
                          const title = postingById.get(postingId)?.title ?? '';
                          setApplicantSearch(title);
                          setApplicantStatusFilter('all');
                          void handleSectionChange('applicants');
                        }}
                        onEditPosting={(nextPosting) => {
                          setEditingPosting(nextPosting);
                          setShowPostDialog(true);
                        }}
                        onClonePosting={(postingToClone) => {
                          addPosting({
                            professorId: postingToClone.professorId,
                            professorName: postingToClone.professorName,
                            professorEmail: postingToClone.professorEmail,
                            professorBioUrl: postingToClone.professorBioUrl,
                            professorDepartment: postingToClone.professorDepartment,
                            category: postingToClone.category,
                            title: `${postingToClone.title} (Copy)`,
                            overview: postingToClone.overview,
                            studentRoleDescription: postingToClone.studentRoleDescription,
                            studentGain: postingToClone.studentGain,
                            requiredQualifications: postingToClone.requiredQualifications,
                            preferredQualifications: postingToClone.preferredQualifications,
                            timeCommitmentExpected: postingToClone.timeCommitmentExpected,
                            startDate: postingToClone.startDate,
                            duration: postingToClone.duration,
                            applicationDeadline: postingToClone.applicationDeadline,
                            compensation: postingToClone.compensation,
                            questions: postingToClone.questions,
                            quickNoteEnabled: postingToClone.quickNoteEnabled,
                            status: 'pending_approval',
                          });
                          toast.success('Opportunity cloned into pending approval.');
                        }}
                        darkMode={darkMode}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="approval" className="space-y-4">
                  {pendingApprovalPostings.length === 0 ? (
                    <Card className={cardSurface}>
                      <CardContent className="py-12 text-center">
                        <p className={subduedText}>No opportunities pending approval.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    pendingApprovalPostings.map((posting) => (
                      <PostingCard
                        key={posting.id}
                        posting={posting}
                        interestedCount={interestCounts[normalizeInterestKey(posting.category)] ?? 0}
                        onViewApplications={(postingId) => {
                          const title = postingById.get(postingId)?.title ?? '';
                          setApplicantSearch(title);
                          setApplicantStatusFilter('all');
                          void handleSectionChange('applicants');
                        }}
                        onEditPosting={(nextPosting) => {
                          setEditingPosting(nextPosting);
                          setShowPostDialog(true);
                        }}
                        onClonePosting={(postingToClone) => {
                          addPosting({
                            professorId: postingToClone.professorId,
                            professorName: postingToClone.professorName,
                            professorEmail: postingToClone.professorEmail,
                            professorBioUrl: postingToClone.professorBioUrl,
                            professorDepartment: postingToClone.professorDepartment,
                            category: postingToClone.category,
                            title: `${postingToClone.title} (Copy)`,
                            overview: postingToClone.overview,
                            studentRoleDescription: postingToClone.studentRoleDescription,
                            studentGain: postingToClone.studentGain,
                            requiredQualifications: postingToClone.requiredQualifications,
                            preferredQualifications: postingToClone.preferredQualifications,
                            timeCommitmentExpected: postingToClone.timeCommitmentExpected,
                            startDate: postingToClone.startDate,
                            duration: postingToClone.duration,
                            applicationDeadline: postingToClone.applicationDeadline,
                            compensation: postingToClone.compensation,
                            questions: postingToClone.questions,
                            quickNoteEnabled: postingToClone.quickNoteEnabled,
                            status: 'pending_approval',
                          });
                          toast.success('Opportunity cloned into pending approval.');
                        }}
                        darkMode={darkMode}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="closed" className="space-y-4">
                  {closedPostings.length === 0 ? (
                    <Card className={cardSurface}>
                      <CardContent className="py-12 text-center">
                        <p className={subduedText}>No closed opportunities.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    closedPostings.map((posting) => (
                      <PostingCard
                        key={posting.id}
                        posting={posting}
                        interestedCount={interestCounts[normalizeInterestKey(posting.category)] ?? 0}
                        onViewApplications={(postingId) => {
                          const title = postingById.get(postingId)?.title ?? '';
                          setApplicantSearch(title);
                          setApplicantStatusFilter('all');
                          void handleSectionChange('applicants');
                        }}
                        onEditPosting={(nextPosting) => {
                          setEditingPosting(nextPosting);
                          setShowPostDialog(true);
                        }}
                        onClonePosting={(postingToClone) => {
                          addPosting({
                            professorId: postingToClone.professorId,
                            professorName: postingToClone.professorName,
                            professorEmail: postingToClone.professorEmail,
                            professorBioUrl: postingToClone.professorBioUrl,
                            professorDepartment: postingToClone.professorDepartment,
                            category: postingToClone.category,
                            title: `${postingToClone.title} (Copy)`,
                            overview: postingToClone.overview,
                            studentRoleDescription: postingToClone.studentRoleDescription,
                            studentGain: postingToClone.studentGain,
                            requiredQualifications: postingToClone.requiredQualifications,
                            preferredQualifications: postingToClone.preferredQualifications,
                            timeCommitmentExpected: postingToClone.timeCommitmentExpected,
                            startDate: postingToClone.startDate,
                            duration: postingToClone.duration,
                            applicationDeadline: postingToClone.applicationDeadline,
                            compensation: postingToClone.compensation,
                            questions: postingToClone.questions,
                            quickNoteEnabled: postingToClone.quickNoteEnabled,
                            status: 'pending_approval',
                          });
                          toast.success('Opportunity cloned into pending approval.');
                        }}
                        darkMode={darkMode}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : null}

          {activeSection === 'applicants' ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Applicants</h2>
                  <p className={`text-sm ${subduedText}`}>Search, filter, sort, and review candidates with AI match scoring.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#9b9b9b]" />
                    <Input
                      value={applicantSearch}
                      onChange={(event) => setApplicantSearch(event.target.value)}
                      placeholder="Search applicants"
                      className="h-10 w-64 rounded-xl pl-9"
                    />
                  </div>
                  <Select value={applicantStatusFilter} onValueChange={(value) => setApplicantStatusFilter(value as typeof applicantStatusFilter)}>
                    <SelectTrigger className="h-10 w-40 rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Shortlisted">Reviewing</SelectItem>
                      <SelectItem value="Interview">Interview</SelectItem>
                      <SelectItem value="Accepted">Accepted</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={applicantSort} onValueChange={(value) => setApplicantSort(value as typeof applicantSort)}>
                    <SelectTrigger className="h-10 w-40 rounded-xl">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Sort by Match</SelectItem>
                      <SelectItem value="date">Sort by Date</SelectItem>
                      <SelectItem value="project">Sort by Research Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className={`mb-2 text-xs ${subduedText}`}>{applicantSortLabel}</p>

              <Card className={`${cardSurface} mb-3`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="text-sm text-[#666666]">
                    {selectedVisibleCount > 0
                      ? `${selectedVisibleCount} selected in current view`
                      : 'Select applicants to perform bulk triage'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={toggleSelectAllVisible}>
                      {allVisibleSelected ? 'Clear Selection' : 'Select All Visible'}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => applyBulkStatus('Shortlisted')}>
                      Bulk Shortlist
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => applyBulkStatus('Interview')}>
                      Bulk Interview
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => applyBulkStatus('Rejected')}>
                      Bulk Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardSurface}>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className={darkMode ? 'bg-[#202020]' : 'bg-[#faf7f5]'}>
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Select</th>
                          <th className="px-4 py-3 text-left font-medium">Student Name</th>
                          <th className="px-4 py-3 text-left font-medium">AI Match Score</th>
                          <th className="px-4 py-3 text-left font-medium">Reasoning</th>
                          <th className="px-4 py-3 text-left font-medium">Major</th>
                          <th className="px-4 py-3 text-left font-medium">Research Project</th>
                          <th className="px-4 py-3 text-left font-medium">Skills</th>
                          <th className="px-4 py-3 text-left font-medium">Application Date</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-left font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApplicants.length === 0 ? (
                          <tr>
                            <td colSpan={10} className={`px-4 py-16 text-center ${subduedText}`}>
                              No applicants match the current filters.
                            </td>
                          </tr>
                        ) : (
                          filteredApplicants.map(({ application, score, posting }) => (
                            <tr key={application.id} className={darkMode ? 'border-t border-[#2a2a2a]' : 'border-t border-[#ececec]'}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedApplicantIds.includes(application.id)}
                                  onChange={() => toggleSelectApplicant(application.id)}
                                  aria-label={`Select ${application.studentName}`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-11 w-11">
                                    <AvatarFallback className={`${getAvatarTone(application.studentId || application.studentName)} font-semibold`}>
                                      {getInitials(application.studentName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-semibold text-[#111111] dark:text-[#f2f2f2]">{application.studentName}</p>
                                    <p className="text-xs text-[#6b6b6b] dark:text-[#b6b6b6]">{application.studentEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={getScoreBadgeClass(score)}>{score}%</Badge>
                              </td>
                              <td className="max-w-[300px] px-4 py-3 text-xs text-[#666666] dark:text-[#b5b5b5]">
                                <p>{buildAiInsights(score).summary}</p>
                                {(() => {
                                  const href = (() => {
                                    const projectTitle = posting?.title ?? postingById.get(application.postingId)?.title ?? 'No project assigned';
                                    const projectOverview = posting && 'overview' in posting ? posting.overview ?? '' : '';
                                    const requiredQualifications = posting && 'requiredQualifications' in posting
                                      ? posting.requiredQualifications ?? ''
                                      : '';
                                    const preferredQualifications = posting && 'preferredQualifications' in posting
                                      ? posting.preferredQualifications ?? ''
                                      : '';
                                    const params = new URLSearchParams({
                                      score: String(score),
                                      name: application.studentName,
                                      major: application.studentMajor,
                                      project: projectTitle,
                                      overview: projectOverview,
                                      requiredQualifications,
                                      preferredQualifications,
                                      status: application.status,
                                      submittedAt: application.submittedAt,
                                    });
                                    return `/professor/applicant-insights/${application.id}?${params.toString()}`;
                                  })();

                                  return (
                                    <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs text-red-700">
                                      <Link to={href}>More</Link>
                                    </Button>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3">{application.studentMajor}</td>
                              <td className="px-4 py-3">{posting?.title ?? postingById.get(application.postingId)?.title ?? 'No project assigned'}</td>
                              <td className="px-4 py-3">Python, ML, SQL</td>
                              <td className="px-4 py-3">{new Date(application.submittedAt).toLocaleDateString()}</td>
                              <td className="px-4 py-3">{application.status}</td>
                              <td className="px-4 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => setSelectedApplicantId(application.id)}
                                >
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeSection === 'messages' ? (
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <Card className={cardSurface}>
                <CardHeader>
                  <CardTitle>Communication Center</CardTitle>
                  <CardDescription>Inbox, sent, and archived applicant conversations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={messageFolder === 'inbox' ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => setMessageFolder('inbox')}
                    >
                      <Inbox className="mr-2 h-4 w-4" />
                      Inbox
                    </Button>
                    <Button
                      size="sm"
                      variant={messageFolder === 'sent' ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => setMessageFolder('sent')}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Sent
                    </Button>
                    <Button
                      size="sm"
                      variant={messageFolder === 'archived' ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => setMessageFolder('archived')}
                    >
                      Archived
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ececec] px-3 py-2 text-sm dark:border-[#313131]">
                    <p className="text-[#666666] dark:text-[#b5b5b5]">
                      {selectedVisibleConversationCount > 0
                        ? `${selectedVisibleConversationCount} recipients selected`
                        : 'Select recipients for bulk messages'}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={toggleSelectAllVisibleConversations}>
                        {allVisibleConversationsSelected ? 'Clear Selection' : 'Select All Visible'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setSelectedConversationIds([])}
                        disabled={selectedConversationIds.length === 0}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {visibleConversations.length === 0 ? (
                      <div className={`rounded-xl border border-dashed p-8 text-center text-sm ${subduedText}`}>
                        No conversations in this folder.
                      </div>
                    ) : (
                      visibleConversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`rounded-xl border p-3 transition-colors ${darkMode ? 'border-[#2b2b2b] hover:bg-[#1f1f1f]' : 'border-[#ececec] hover:bg-[#fafafa]'}`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedConversationIds.includes(conversation.id)}
                              onChange={() => toggleSelectConversation(conversation.id)}
                              aria-label={`Select ${conversation.name}`}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-sm font-medium">{conversation.name}</p>
                              <p className={`text-xs ${subduedText}`}>{conversation.subject}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={cardSurface}>
                <CardHeader>
                  <CardTitle>Templates and Quick Actions</CardTitle>
                  <CardDescription>Use prebuilt outreach templates for candidate workflow updates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => openTemplateEditor('interview')}
                    >
                      Edit Templates
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="justify-start rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => openMessageTemplate('interview')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Interview
                    </Button>
                    <Button variant="outline" className="justify-start rounded-xl" onClick={() => openMessageTemplate('request-info')}>
                      <Mail className="mr-2 h-4 w-4" />
                      Request Information
                    </Button>
                    <Button variant="outline" className="justify-start rounded-xl" onClick={() => openMessageTemplate('accept')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Accept Candidate
                    </Button>
                    <Button variant="outline" className="justify-start rounded-xl" onClick={() => openMessageTemplate('reject')}>
                      <Bell className="mr-2 h-4 w-4" />
                      Reject Candidate
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeSection === 'lab-profile' ? (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Manage your public lab identity and profile details.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name <span className="text-red-700">*</span></Label>
                  <Input
                    value={labForm.name}
                    onChange={(event) => setLabForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Sarah Chen"
                    aria-invalid={missingProfileName}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingProfileName
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingProfileName && <p className="mt-2 text-xs text-destructive">Name is required</p>}
                </div>
                <div className="space-y-2">
                  <Label>Department <span className="text-red-700">*</span></Label>
                  <Input
                    value={labForm.department}
                    onChange={(event) => setLabForm((current) => ({ ...current, department: event.target.value }))}
                    placeholder="Computer Science"
                    aria-invalid={missingProfileDepartment}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingProfileDepartment
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingProfileDepartment && <p className="mt-2 text-xs text-destructive">Department is required</p>}
                </div>
                <div className="space-y-2">
                  <Label>Title <span className="text-red-700">*</span></Label>
                  <Input
                    value={labForm.title}
                    onChange={(event) => setLabForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Assistant Professor"
                    aria-invalid={missingProfileTitle}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingProfileTitle
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingProfileTitle && <p className="mt-2 text-xs text-destructive">Title is required</p>}
                </div>
                <div className="space-y-2">
                  <Label>Contact Email <span className="text-red-700">*</span></Label>
                  <Input
                    value={labForm.contactEmail}
                    onChange={(event) => setLabForm((current) => ({ ...current, contactEmail: event.target.value }))}
                    placeholder="schen@andrew.cmu.edu"
                    aria-invalid={missingProfileContactEmail || hasInvalidProfileContactEmail}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingProfileContactEmail || hasInvalidProfileContactEmail
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingProfileContactEmail && <p className="mt-2 text-xs text-destructive">Contact email is required</p>}
                  {hasInvalidProfileContactEmail && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Email is invalid
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Link to Bio</Label>
                  <Input
                    value={labForm.bioUrl}
                    onChange={(event) => setLabForm((current) => ({ ...current, bioUrl: event.target.value }))}
                    placeholder="https://www.cs.cmu.edu/people/sarah-chen"
                    aria-invalid={hasInvalidProfileBioUrl}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      hasInvalidProfileBioUrl
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {hasInvalidProfileBioUrl && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Bio link must start with http:// or https://
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Research Areas</Label>
                  <Input
                    value={labForm.researchAreas}
                    onChange={(event) => setLabForm((current) => ({ ...current, researchAreas: event.target.value }))}
                    placeholder="Machine Learning, NLP, Robotics"
                    className="h-12 rounded-2xl border-[#d9d9d9] bg-white px-4 text-[#111111] shadow-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Professor's Website</Label>
                  <Input
                    value={labForm.professorWebsite}
                    onChange={(event) => setLabForm((current) => ({ ...current, professorWebsite: event.target.value }))}
                    placeholder="https://www.andrew.cmu.edu/user/praman/"
                    aria-invalid={hasInvalidProfileProfessorWebsite}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      hasInvalidProfileProfessorWebsite
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {hasInvalidProfileProfessorWebsite && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Professor's website must start with http:// or https://
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Publications Link</Label>
                  <Input
                    value={labForm.publicationsLink}
                    onChange={(event) => setLabForm((current) => ({ ...current, publicationsLink: event.target.value }))}
                    placeholder="https://scholar.google.com/citations?user=abc123"
                    aria-invalid={hasInvalidProfilePublicationsLink}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      hasInvalidProfilePublicationsLink
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {hasInvalidProfilePublicationsLink && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Publications link must start with http:// or https://
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Research Interests</Label>
                  <Input
                    value={labForm.researchInterests}
                    onChange={(event) => setLabForm((current) => ({ ...current, researchInterests: event.target.value }))}
                    placeholder="Responsible AI, Human-Centered ML, Scalable Inference"
                    className="h-12 rounded-2xl border-[#d9d9d9] bg-white px-4 text-[#111111] shadow-none"
                  />
                </div>
                <div className="md:col-span-2 flex justify-between">
                  <Button variant="outline" className="rounded-xl" onClick={handleCancelDashboardProfile} disabled={isSavingProfile}>
                    Cancel
                  </Button>
                  <Button
                    className="rounded-xl bg-red-700 text-white hover:bg-red-800"
                    onClick={() => void handleSaveDashboardProfile()}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeSection === 'analytics' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[['Applications / Month', MONTHLY_APPLICATIONS[MONTHLY_APPLICATIONS.length - 1]], ['Acceptance Rate', `${acceptanceRate}%`], ['Interview Conversion', `${interviewConversionRate}%`], ['Top Major', TOP_MAJORS[0].major]].map((item) => (
                  <Card key={item[0]} className={cardSurface}>
                    <CardHeader>
                      <CardDescription>{item[0]}</CardDescription>
                      <CardTitle>{item[1]}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Applications Per Month"
                  loading={analyticsLoading}
                  darkMode={darkMode}
                  content={
                    <div className="flex h-52 items-end gap-2">
                      {MONTHLY_APPLICATIONS.map((value, index) => (
                        <div key={index} className="flex-1 rounded-t bg-red-600/80" style={{ height: `${(value / 52) * 100}%` }} />
                      ))}
                    </div>
                  }
                />

                <ChartCard
                  title="Applicant Skill Distribution"
                  loading={analyticsLoading}
                  darkMode={darkMode}
                  content={
                    <div className="space-y-3">
                      {SKILL_DISTRIBUTION.map((entry) => (
                        <div key={entry.skill}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span>{entry.skill}</span>
                            <span>{entry.count}</span>
                          </div>
                          <div className={`h-2 rounded-full ${darkMode ? 'bg-[#2b2b2b]' : 'bg-[#efefef]'}`}>
                            <div className="h-2 rounded-full bg-red-600" style={{ width: `${(entry.count / 35) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                />

                <ChartCard
                  title="Top Majors Applying"
                  loading={analyticsLoading}
                  darkMode={darkMode}
                  content={
                    <div className="space-y-3">
                      {TOP_MAJORS.map((entry) => (
                        <div key={entry.major} className="flex items-center justify-between rounded-xl border border-[#e7e7e7] px-3 py-2 text-sm dark:border-[#333333]">
                          <span>{entry.major}</span>
                          <Badge className="border border-red-200 bg-red-50 text-red-700">{entry.count}</Badge>
                        </div>
                      ))}
                    </div>
                  }
                />

                <ChartCard
                  title="Interview Conversion Trend"
                  loading={analyticsLoading}
                  darkMode={darkMode}
                  content={
                    <div className="flex h-52 items-end gap-2">
                      {[44, 41, 46, 48, 50, 53, interviewConversionRate].map((value, index) => (
                        <div key={index} className="flex-1 rounded-t bg-[#ba2d2d]" style={{ height: `${Math.max(18, value)}%` }} />
                      ))}
                    </div>
                  }
                />
              </div>

              <div className="mt-1">
                <ResearchImpactPipeline darkMode={darkMode} />
              </div>
            </>
          ) : null}

          {activeSection === 'settings' ? (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Personalize dashboard behavior, themes, and notifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-[#ececec] px-4 py-3 dark:border-[#313131]">
                  <div>
                    <p className="text-sm font-medium">Dark mode</p>
                    <p className={`text-xs ${subduedText}`}>Switch to a low-light dashboard theme.</p>
                  </div>
                  <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#ececec] px-4 py-3 dark:border-[#313131]">
                  <div>
                    <p className="text-sm font-medium">Notification badges</p>
                    <p className={`text-xs ${subduedText}`}>Show pending review counters in sidebar and tables.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#ececec] px-4 py-3 dark:border-[#313131]">
                  <div>
                    <p className="text-sm font-medium">Command palette</p>
                    <p className={`text-xs ${subduedText}`}>Quick jump using Ctrl+K style search.</p>
                  </div>
                  <Badge className="border border-[#d5d5d5] bg-[#fafafa] text-[#555555]">Enabled</Badge>
                </div>
                <div className="flex justify-end">
                  <Button className="rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => toast.success('Settings saved')}>
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </main>

      <PostResearchDialog
        open={showPostDialog}
        onOpenChange={(open) => {
          setShowPostDialog(open);
          if (!open) {
            setEditingPosting(null);
          }
        }}
        postingToEdit={editingPosting}
      />

      {selectedPostingId ? (
        <ViewApplicationsDialog postingId={selectedPostingId} open={Boolean(selectedPostingId)} onOpenChange={(open) => !open && setSelectedPostingId(null)} />
      ) : null}

      <Dialog
        open={openTemplateDialog}
        onOpenChange={(open) => {
          if (isSendingQueue) {
            return;
          }
          setOpenTemplateDialog(open);
          if (!open) {
            setSendQueueProgress(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{templateTitle}</DialogTitle>
            <DialogDescription>
              Review and edit this message before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Insert Tokens</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {allTemplateTokens.map((token) => (
                  <Button
                    key={`compose-token-${token.key}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => insertTokenIntoCompose(token.value)}
                  >
                    Insert {token.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                ref={composeSubjectRef}
                value={templateSubject}
                onFocus={() => setActiveComposeField('subject')}
                onClick={() => setActiveComposeField('subject')}
                onChange={(event) => setTemplateSubject(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-body">Message</Label>
              <Textarea
                id="template-body"
                ref={composeBodyRef}
                value={templateBody}
                onFocus={() => setActiveComposeField('body')}
                onClick={() => setActiveComposeField('body')}
                onChange={(event) => setTemplateBody(event.target.value)}
                rows={12}
              />
            </div>
            {sendQueueProgress ? (
              <p className="text-sm font-medium text-[#666666] dark:text-[#b5b5b5]">
                {sendQueueProgress.sent > 0
                  ? `Email (${sendQueueProgress.sent}/${sendQueueProgress.total}) sent to ${sendQueueProgress.recipient}`
                  : `Preparing queue (${sendQueueProgress.total} emails)...`}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenTemplateDialog(false)} disabled={isSendingQueue}>
                Close
              </Button>
              <Button
                disabled={isSendingQueue}
                onClick={async () => {
                  await navigator.clipboard.writeText(`Subject: ${templateSubject}\n\n${templateBody}`);
                  toast.success('Template copied to clipboard.');
                }}
              >
                Copy Template
              </Button>
              <Button
                className="bg-red-700 text-white hover:bg-red-800"
                onClick={() => {
                  void processMessageQueueSend();
                }}
                disabled={isSendingQueue}
              >
                {isSendingQueue ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openTemplateEditorDialog} onOpenChange={setOpenTemplateEditorDialog}>
        <DialogContent className="mx-auto w-[min(90vw,860px)] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
          <DialogHeader className="border-b border-slate-200 pb-4">
            <DialogTitle className="text-2xl font-semibold tracking-tight">Edit Message Templates</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Customize templates and insert tokens where your cursor is active.
            </DialogDescription>
          </DialogHeader>

          <div className="box-border w-full max-w-full rounded-xl bg-transparent p-1 pt-5 shadow-none">
            <div className="grid w-full box-border items-start gap-4 [grid-template-columns:minmax(240px,300px)_minmax(0,1fr)]">
            <div>
              <section className="box-border rounded-xl border border-slate-200 bg-slate-50/80 p-5 text-slate-900">
              <div className="space-y-2">
                <Label htmlFor="template-kind" className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Template Type</Label>
                <Select
                  value={editingTemplateKind}
                  onValueChange={(value) => {
                    const nextKind = value as MessageTemplateKind;
                    setEditingTemplateKind(nextKind);
                    const nextTemplate = templateOverrides[nextKind] ?? DEFAULT_MESSAGE_TEMPLATES[nextKind];
                    setEditingTemplateSubject(nextTemplate.subject);
                    setEditingTemplateBody(nextTemplate.body);
                  }}
                >
                  <SelectTrigger id="template-kind" className="h-11 rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm">
                    <SelectValue placeholder="Template Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interview">Interview Invitation</SelectItem>
                    <SelectItem value="request-info">Request Information</SelectItem>
                    <SelectItem value="accept">Accept Candidate</SelectItem>
                    <SelectItem value="reject">Reject Candidate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="my-4 h-px bg-slate-200" />

              <div>
                <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Insert Tokens</Label>
                <div className="mt-3 space-y-2">
                  {allTemplateTokens.map((token) => (
                    <Button
                      key={`editor-token-${token.key}`}
                      type="button"
                      variant="outline"
                      className="flex h-11 w-full items-center justify-start gap-2 rounded-lg border-slate-300 bg-white text-left text-slate-900 shadow-sm hover:bg-slate-100"
                      onClick={() => insertTokenIntoEditor(token.value)}
                    >
                      {token.value === '[Student Name]' ? <UserCircle className="h-4 w-4 text-slate-500" /> : null}
                      {token.value === '[Opportunity Title]' ? <Briefcase className="h-4 w-4 text-slate-500" /> : null}
                      {token.value === '[Professor Name]' ? <Sparkles className="h-4 w-4 text-slate-500" /> : null}
                      {token.value !== '[Student Name]' && token.value !== '[Opportunity Title]' && token.value !== '[Professor Name]' ? <PlusCircle className="h-4 w-4 text-slate-500" /> : null}
                      {token.value}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="my-4 h-px bg-slate-200" />

              <div>
                <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Custom Token</Label>
                <div className="mt-3 space-y-2">
                  <Input
                    id="new-custom-token"
                    value={newCustomTokenLabel}
                    onChange={(event) => setNewCustomTokenLabel(event.target.value)}
                    placeholder="Display label"
                    className="h-11 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                  <Input
                    value={newCustomTokenValue}
                    onChange={(event) => setNewCustomTokenValue(event.target.value)}
                    placeholder="Token value e.g. [Deadline Date]"
                    className="h-11 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-100"
                    onClick={addCustomToken}
                  >
                    + Add Token
                  </Button>
                </div>

                {customTemplateTokens.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customTemplateTokens.map((token) => (
                      <span
                        key={`custom-token-${token.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                      >
                        <span className="max-w-[160px] truncate">{token.label}: {token.value}</span>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-red-500"
                          onClick={() => removeCustomToken(token.id)}
                          aria-label={`Remove ${token.label}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              </section>
            </div>

            <div className="min-w-0 w-full">
              <section className="box-border flex min-h-[420px] w-full flex-col rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
              <div className="space-y-2">
                <Label htmlFor="editor-template-subject" className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Subject</Label>
                <Input
                  id="editor-template-subject"
                  ref={editorSubjectRef}
                  value={editingTemplateSubject}
                  onFocus={() => setActiveEditorField('subject')}
                  onClick={() => setActiveEditorField('subject')}
                  onChange={(event) => setEditingTemplateSubject(event.target.value)}
                  className="h-11 rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm"
                />
              </div>

              <div className="my-4 h-px bg-slate-200" />

              <div className="space-y-2">
                <Label htmlFor="editor-template-body" className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Message</Label>
                <Textarea
                  id="editor-template-body"
                  ref={editorBodyRef}
                  value={editingTemplateBody}
                  onFocus={() => setActiveEditorField('body')}
                  onClick={() => setActiveEditorField('body')}
                  onChange={(event) => setEditingTemplateBody(event.target.value)}
                  rows={8}
                  className="h-[210px] resize-none rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm"
                />
              </div>

              <div className="mt-3 flex flex-row gap-2">
                <Button variant="ghost" className="h-10 flex-none rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100" onClick={resetTemplateEdits}>
                  Reset to Default
                </Button>
                <Button variant="ghost" className="h-10 flex-none rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100" onClick={() => setOpenTemplateEditorDialog(false)}>
                  Cancel
                </Button>
                <Button className="h-10 flex-1 rounded-lg bg-slate-900 text-white shadow-sm hover:bg-slate-800" onClick={saveTemplateEdits}>
                  Save Template
                </Button>
              </div>
              </section>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedApplicant)} onOpenChange={(open) => !open && setSelectedApplicantId(null)}>
        <SheetContent side="right" className="sm:max-w-xl">
          {selectedApplicant ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedApplicant.application.studentName}</SheetTitle>
                <SheetDescription>
                  {selectedApplicant.posting?.title ?? 'Research Position'} • Match {selectedApplicant.score}%
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 overflow-y-auto px-4 pb-4">
                <Card id="resume-viewer">
                  <CardHeader>
                    <CardTitle className="text-base">Academic Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <p>Major: {selectedApplicant.application.studentMajor}</p>
                    <p>Graduation Year: 2027</p>
                    <p>GPA: 3.78</p>
                    <p>Status: {selectedApplicant.application.status}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Skills</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {(selectedApplicantEvidence?.skills ?? ['Python', 'ML', 'SQL', 'Research Writing', 'Pandas']).map((skill) => (
                      <Badge key={skill} className="border border-red-200 bg-red-50 text-red-700">
                        {skill}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Coursework</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {(selectedApplicantEvidence?.coursework ?? [
                      '10-601 Machine Learning',
                      '15-210 Parallel and Sequential Data Structures',
                      '10-315 Introduction to Computer Vision',
                    ]).map((course) => (
                      <p key={course}>{course}</p>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resume Viewer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-[#d8d8d8] bg-[#fafafa] text-sm text-[#6f6f6f]">
                      Embedded preview placeholder: {selectedApplicant.application.resume.name}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">GitHub</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <a
                      href={selectedApplicantEvidence?.githubProfileUrl ?? 'https://github.com/student-profile'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-red-700 underline underline-offset-2"
                    >
                      github.com/student-profile
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {(selectedApplicantEvidence?.githubRepos ?? [
                      {
                        name: 'ml-research-portfolio',
                        description: 'Model benchmarking and experiment tracking toolkit.',
                        url: 'https://github.com/student-profile/ml-research-portfolio',
                      },
                    ]).map((repo) => (
                      <div key={repo.name} className="rounded-xl border border-[#e7e7e7] p-3">
                        <a
                          href={repo.url ?? selectedApplicantEvidence?.githubProfileUrl ?? 'https://github.com/student-profile'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-red-700 underline underline-offset-2"
                        >
                          {repo.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <p className="text-xs text-[#6f6f6f]">{repo.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Personal Statement</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-[#444444]">
                    {selectedApplicantEvidence?.personalStatement ??
                      'I want to join this lab to apply machine learning to real, high-impact research problems while growing my experimental design and publication skills.'}
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50/70">
                  <CardHeader>
                    <CardTitle className="text-base text-red-900">AI Match Analysis</CardTitle>
                    <CardDescription className="text-red-800">This recommendation explains why the candidate is ranked at {selectedApplicant.score}%.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-red-900">
                    <div>
                      <p className="font-semibold">Requirements Analysis</p>
                      <div className="mt-2 rounded-xl border border-red-200/80 bg-white/70 p-3">
                        <div className="overflow-x-auto rounded-lg border border-red-100 bg-white">
                          <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-red-100 bg-red-50/60 text-xs font-semibold uppercase tracking-[0.08em] text-red-700">
                                <th className="px-3 py-2">Research Requirements</th>
                                <th className="px-3 py-2">Candidate Fit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedApplicantRequirementAnalysis.length === 0 ? (
                                <tr>
                                  <td className="px-3 py-3 text-red-900" colSpan={2}>
                                    No requirements found for this posting.
                                  </td>
                                </tr>
                              ) : (
                                selectedApplicantRequirementAnalysis.map((row) => {
                                  const display = getStatusDisplay(row.status);
                                  const StatusIcon = display.Icon;

                                  return (
                                    <tr key={row.requirement} className="border-b border-red-100 last:border-b-0">
                                      <td className="px-3 py-3 align-top text-red-900">
                                        <span className="font-medium">• {row.requirement}</span>
                                      </td>
                                      <td className="px-3 py-3 align-top text-red-900">
                                        <div className="flex items-start gap-2">
                                          <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${display.iconClass}`} />
                                          <div className="space-y-2">
                                            <p className="text-xs leading-relaxed">{row.assessment}</p>
                                            <div className="flex flex-wrap gap-2">
                                              {row.proof.map((proof) =>
                                                proof.href ? (
                                                  <a
                                                    key={`${row.requirement}-${proof.label}-${proof.detail}`}
                                                    href={proof.href}
                                                    target={proof.href.startsWith('#') ? undefined : '_blank'}
                                                    rel={proof.href.startsWith('#') ? undefined : 'noreferrer'}
                                                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-800 underline-offset-2 hover:underline"
                                                    title={proof.detail}
                                                  >
                                                    <span className="truncate">{proof.label}: {proof.detail}</span>
                                                    {!proof.href.startsWith('#') ? <ExternalLink className="h-3 w-3 shrink-0" /> : null}
                                                  </a>
                                                ) : (
                                                  <span
                                                    key={`${row.requirement}-${proof.label}-${proof.detail}`}
                                                    className="inline-flex max-w-full rounded-full border border-red-100 bg-white px-2 py-1 text-[11px] font-medium text-red-800"
                                                    title={proof.detail}
                                                  >
                                                    <span className="truncate">{proof.label}: {proof.detail}</span>
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <p className="font-semibold">AI Applicant Reasoning Confidence Score: {selectedApplicant.score}%</p>
                    <div>
                      <p className="font-semibold">Strengths</p>
                      {buildAiInsights(selectedApplicant.score).strengths.map((strength) => (
                        <p key={strength}>• {strength}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-semibold">Potential Concerns</p>
                      {buildAiInsights(selectedApplicant.score).concerns.map((concern) => (
                        <p key={concern}>• {concern}</p>
                      ))}
                    </div>
                    <p>{buildAiInsights(selectedApplicant.score).summary}</p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={openCommandPalette} onOpenChange={setOpenCommandPalette}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Navigation</DialogTitle>
            <DialogDescription>Command palette style search for dashboard sections.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#9b9b9b]" />
              <Input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Type to search sections"
                className="pl-9"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {commandItems.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-[#6f6f6f]">No matching sections</p>
              ) : (
                commandItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-[#ececec] hover:bg-[#fafafa]"
                      onClick={async () => {
                        const switched = await handleSectionChange(item.key);
                        if (switched) {
                          setOpenCommandPalette(false);
                          setCommandQuery('');
                        }
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  trendLabel,
  chartValues,
  darkMode,
}: {
  title: string;
  value: string | number;
  trend: string;
  trendLabel: string;
  chartValues: number[];
  darkMode: boolean;
}) {
  const max = Math.max(...chartValues, 1);

  return (
    <Card className={darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d0ceca] bg-white'}>
      <CardHeader className="space-y-1 pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-[#9f9f9f]">
          <span className="font-semibold text-emerald-600">{trend}</span> {trendLabel}
        </p>
        <div className="flex items-end gap-1">
          {chartValues.map((entry, index) => (
            <div key={index} className="h-8 flex-1 rounded-t bg-red-600/70" style={{ height: `${Math.max(15, (entry / max) * 100)}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  loading,
  darkMode,
  content,
}: {
  title: string;
  loading: boolean;
  darkMode: boolean;
  content: React.ReactNode;
}) {
  return (
    <Card className={darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d0ceca] bg-white'}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className={`h-5 w-2/3 animate-pulse rounded ${darkMode ? 'bg-[#2b2b2b]' : 'bg-[#efefef]'}`} />
            <div className={`h-36 animate-pulse rounded ${darkMode ? 'bg-[#232323]' : 'bg-[#f5f5f5]'}`} />
          </div>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
}

function PostingCard({
  posting,
  interestedCount,
  onViewApplications,
  onEditPosting,
  onClonePosting,
  darkMode,
}: {
  posting: any;
  interestedCount: number;
  onViewApplications: (id: string) => void;
  onEditPosting: (posting: any) => void;
  onClonePosting: (posting: any) => void;
  darkMode: boolean;
}) {
  const { getApplicationsByPosting } = useData();
  const applications = getApplicationsByPosting(posting.id);
  const pendingCount = applications.filter((application) => application.status === 'Pending').length;

  const statusClassName =
    posting.status === 'published'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : posting.status === 'pending_approval'
        ? 'border border-amber-200 bg-amber-50 text-amber-700'
        : 'border border-[#d8d8d8] bg-[#f7f7f7] text-[#575757]';

  return (
    <Card className={`${darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d0ceca] bg-white'} transition-shadow hover:shadow-md`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle>{posting.title}</CardTitle>
            <CardDescription>
              {posting.category} • {posting.professorDepartment}
            </CardDescription>
          </div>
          <Badge className={statusClassName}>{posting.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={`line-clamp-2 text-sm ${darkMode ? 'text-[#cfcfcf]' : 'text-[#333333]'}`}>{posting.overview}</p>
        <div className={`flex flex-wrap gap-4 text-sm ${darkMode ? 'text-[#a5a5a5]' : 'text-[#6f6f6f]'}`}>
          <span>Location: Remote</span>
          <span>Commitment: {posting.timeCommitmentExpected}</span>
          <span>Applicants: {applications.length}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-4 w-4" />
            Potential interest: {interestedCount}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onViewApplications(posting.id)}
            variant="outline"
            size="sm"
            className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
          >
            <Eye className="mr-2 h-4 w-4" />
            View Applicants
          </Button>
          <Button
            onClick={() => onEditPosting(posting)}
            variant="outline"
            size="sm"
            className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
          >
            Edit Position
          </Button>
          <Button
            onClick={() => onClonePosting(posting)}
            variant="outline"
            size="sm"
            className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
          >
            Clone Position
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
            onClick={() => toast.success('Applications paused for this position')}
          >
            Pause Applications
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
            onClick={() => toast.success('Position closed')}
          >
            Close Position
          </Button>
          {pendingCount > 0 ? (
            <Badge variant="destructive" className="text-xs">
              {pendingCount} pending
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

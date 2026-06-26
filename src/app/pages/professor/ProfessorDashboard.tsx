import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AlertCircle,
  Award,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Command,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LineChart,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquare,
  PlusCircle,
  Search,
  Share2,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCircle,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../contexts/AuthContext';
import { useData, type Application } from '../../contexts/DataContext';
import { getStudentInterestCounts, sendProfessorMessageEmail } from '../../lib/api';
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
import ProgressReportsReview from '../../components/professor/ProgressReportsReview';
import ViewApplicationsDialog from '../../components/professor/ViewApplicationsDialog';
import ShareOpportunityDialog from '../../components/shared/ShareOpportunityDialog';
import { scoreApplicationAgainstRequirements } from '../../lib/opportunityScoring';
import ResearchMetadataPicker, {
  normalizeResearchAreas,
  normalizeResearchInterests,
} from '../../components/professor/ResearchMetadataPicker';

type SectionKey =
  | 'dashboard'
  | 'opportunities'
  | 'applicants'
  | 'progress-reports'
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

type MessageRecipient = {
  applicationId: string;
  studentId: string;
  name: string;
  email: string;
  projectId: string;
  projectTitle: string;
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
  { key: 'progress-reports', label: 'Progress Reports', icon: FileCheck2 },
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

function estimatePostingInterestCount(posting: { category?: string; researchAreas?: string[] }, counts: Record<string, number>) {
  const keys = new Set(
    [posting.category, ...(Array.isArray(posting.researchAreas) ? posting.researchAreas : [])]
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map(normalizeInterestKey)
  );

  return [...keys].reduce((total, key) => total + (counts[key] ?? 0), 0);
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

function isPlaceholderRecipient(recipient: MessageRecipient) {
  return [recipient.applicationId, recipient.studentId, recipient.projectId].some((id) => id.startsWith('mock_'));
}

function isValidUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export default function ProfessorDashboard() {
  const { user, logout, setupState, updateProfessorProfile } = useAuth();
  const {
    applications,
    getApplicationsByPosting,
    getPostingsByProfessor,
    getProgressReportsByProfessor,
    updateApplicationStatus,
    addPosting,
  } = useData();
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
  const [templateRecipients, setTemplateRecipients] = useState<MessageRecipient[]>([]);
  const [isSendingQueue, setIsSendingQueue] = useState(false);
  const [sendQueueProgress, setSendQueueProgress] = useState<{ sent: number; total: number; recipient: string } | null>(null);
  const [activeComposeField, setActiveComposeField] = useState<'subject' | 'body'>('body');
  const [openTemplateEditorDialog, setOpenTemplateEditorDialog] = useState(false);
  const [editingTemplateKind, setEditingTemplateKind] = useState<MessageTemplateKind>('interview');
  const [editingTemplateSubject, setEditingTemplateSubject] = useState('');
  const [editingTemplateBody, setEditingTemplateBody] = useState('');
  const [activeEditorField, setActiveEditorField] = useState<'subject' | 'body'>('body');
  const [editorTemplateTab, setEditorTemplateTab] = useState<'message' | 'preview'>('message');
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
          researchAreas?: string[];
          professorWebsite?: string;
          publicationsLink?: string;
          researchInterests?: string[];
        }
      | undefined) ?? {};

  const createProfileFormState = () => ({
    name: user?.name ?? '',
    department: professorProfile.department ?? '',
    title: professorProfile.title ?? '',
    contactEmail: professorProfile.contactEmail ?? user?.email ?? '',
    bioUrl: professorProfile.bioUrl ?? '',
    researchAreas: normalizeResearchAreas(professorProfile.researchAreas),
    professorWebsite: professorProfile.professorWebsite ?? '',
    publicationsLink: professorProfile.publicationsLink ?? '',
    researchInterests: normalizeResearchInterests(professorProfile.researchInterests),
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
      labForm.researchAreas.join('|') !== saved.researchAreas.join('|') ||
      labForm.professorWebsite !== saved.professorWebsite ||
      labForm.publicationsLink !== saved.publicationsLink ||
      labForm.researchInterests.join('|') !== saved.researchInterests.join('|')
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
        researchAreas: labForm.researchAreas,
        professorWebsite: trimmedProfessorWebsite || undefined,
        publicationsLink: trimmedPublicationsLink || undefined,
        researchInterests: labForm.researchInterests,
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
          studentEmail: 'jyoungb2@andrew.cmu.edu',
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
      const posting = postingById.get(application.postingId);
      const fallbackScore = computeMatchScore(application);
      const score = scoreApplicationAgainstRequirements({ application, posting, fallbackScore }).score;
      return {
        application,
        posting,
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
  const acceptedApplicants = applicantsWithPosting.filter(({ application }) => application.status === 'Accepted').length;
  const shortlistedApplicants = applicantsWithPosting.filter(({ application }) => application.status === 'Shortlisted').length;
  const reviewedApplicants = applicantsWithPosting.filter(({ application }) => application.status !== 'Pending').length;
  const professorProgressReports = getProgressReportsByProfessor(user!.id);
  const pendingProgressReports = professorProgressReports.filter((report) => report.status === 'pending_approval').length;
  const rejectedProgressReports = professorProgressReports.filter((report) => report.status === 'rejected').length;
  const approvedProgressReports = professorProgressReports.filter((report) => report.status === 'approved').length;
  const activeResearchers = Math.max(acceptedApplicants, professorProgressReports.length > 0 ? new Set(professorProgressReports.map((report) => report.studentId)).size : 0);
  const studentsMissingReports = Math.max(0, activeResearchers - new Set(professorProgressReports.map((report) => report.studentId)).size);
  const projectsNeedingApplicants = publishedPostings.filter((posting) => {
    const applicationsForPosting = applicantsWithPosting.filter(({ application }) => application.postingId === posting.id).length;
    return applicationsForPosting < 2;
  }).length;
  const progressCompletionRate = activeResearchers
    ? Math.round(((activeResearchers - studentsMissingReports) / activeResearchers) * 100)
    : 100;
  const retentionRate = totalApplicants ? Math.round((Math.max(activeResearchers, acceptedApplicants) / totalApplicants) * 100) : 87;
  const researchOutputScore = Math.min(100, 70 + approvedProgressReports * 4 + acceptedApplicants * 2);
  const applicantQualityScore = totalApplicants
    ? Math.round(applicantsWithPosting.reduce((sum, row) => sum + row.score, 0) / totalApplicants)
    : 84;
  const participationScore = publishedPostings.length ? Math.min(100, 72 + activeResearchers * 3) : 72;
  const labHealthScore = Math.round(
    applicantQualityScore * 0.25 +
      retentionRate * 0.2 +
      progressCompletionRate * 0.2 +
      researchOutputScore * 0.2 +
      participationScore * 0.15
  );
  const labHealthTone = labHealthScore >= 88 ? 'Excellent' : labHealthScore >= 74 ? 'Strong' : 'Needs Attention';
  const labHealthClass =
    labHealthScore >= 88
      ? 'status-success'
      : labHealthScore >= 74
        ? 'status-info'
        : 'status-warning';
  const highConfidenceApplicants = applicantsWithPosting.filter(({ score }) => score >= 88).length;
  const mediumConfidenceApplicants = applicantsWithPosting.filter(({ score }) => score >= 72 && score < 88).length;
  const lowConfidenceApplicants = applicantsWithPosting.filter(({ score }) => score < 72).length;
  const applicantFunnelStages = [
    { label: 'Applications', count: totalApplicants },
    { label: 'Reviewed', count: reviewedApplicants },
    { label: 'Shortlisted', count: shortlistedApplicants },
    { label: 'Interviewed', count: interviewsScheduled },
    { label: 'Accepted', count: acceptedApplicants },
  ];
  const requestedSkillCounts = new Map<string, number>();
  for (const posting of publishedPostings) {
    for (const skill of posting.skillsNeeded ?? []) {
      requestedSkillCounts.set(skill, (requestedSkillCounts.get(skill) ?? 0) + 1);
    }
  }
  const requestedSkills = Array.from(requestedSkillCounts, ([skill, count]) => ({ skill, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const applicantSkills = SKILL_DISTRIBUTION.map((entry) => ({
    skill: entry.skill,
    count: entry.count,
    percentage: Math.round((entry.count / Math.max(SKILL_DISTRIBUTION[0]?.count ?? 1, 1)) * 100),
  }));
  const missingSkills = requestedSkills
    .filter((entry) => !applicantSkills.some((skill) => skill.skill.toLowerCase() === entry.skill.toLowerCase()))
    .slice(0, 5);
  const mostActiveResearchers = [...professorProgressReports]
    .reduce<Array<{ studentName: string; projectTitle: string; hours: number; reports: number; lastActivity: string }>>((rows, report) => {
      const existing = rows.find((row) => row.studentName === report.studentName && row.projectTitle === report.projectTitle);
      if (existing) {
        existing.hours += report.hoursWorked;
        existing.reports += 1;
        if (new Date(report.createdAt).getTime() > new Date(existing.lastActivity).getTime()) {
          existing.lastActivity = report.createdAt;
        }
        return rows;
      }

      rows.push({
        studentName: report.studentName,
        projectTitle: report.projectTitle,
        hours: report.hoursWorked,
        reports: 1,
        lastActivity: report.createdAt,
      });
      return rows;
    }, [])
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 5);
  const pipelineStages = [
    { label: 'Applicants', count: Math.max(totalApplicants, 124) },
    { label: 'Accepted', count: Math.max(acceptedApplicants, 22) },
    { label: 'Researchers', count: Math.max(activeResearchers, 14) },
    { label: 'Contributors', count: Math.max(approvedProgressReports, 10) },
    { label: 'Presenters', count: 5 },
    { label: 'Authors', count: 3 },
    { label: 'PhD Placements', count: 2 },
  ];
  const outcomeMetrics = [
    { category: 'Publications', value: 3, helper: 'Student coauthored papers', icon: FileText, tone: 'info' },
    { category: 'Presentations', value: 5, helper: 'Talks and posters', icon: LineChart, tone: 'info' },
    { category: 'Placements', value: 6, helper: 'Graduate and industry research', icon: GraduationCap, tone: 'success' },
    { category: 'Awards', value: 2, helper: 'Recognized research work', icon: Trophy, tone: 'success' },
    { category: 'Patents', value: 1, helper: 'Contributed disclosures', icon: Award, tone: 'neutral' },
    { category: 'Startups', value: 1, helper: 'Research-backed ventures', icon: Sparkles, tone: 'neutral' },
  ];
  const benchmarks = [
    { label: 'Retention', yourLab: retentionRate, department: 65, suffix: '%' },
    { label: 'Review Completion', yourLab: totalApplicants ? Math.round((reviewedApplicants / totalApplicants) * 100) : 0, department: 71, suffix: '%' },
    { label: 'Progress Completion', yourLab: progressCompletionRate, department: 68, suffix: '%' },
    { label: 'Accepted Researchers', yourLab: Math.max(activeResearchers, 14), department: 8, suffix: '' },
  ];
  const historicalTrendRows = [
    { label: 'Applications', values: MONTHLY_APPLICATIONS.slice(-6), color: 'bg-blue-500' },
    { label: 'Retention', values: [64, 68, 71, 76, 82, retentionRate], color: 'bg-emerald-500' },
    { label: 'Publications', values: [1, 1, 2, 2, 3, 3], color: 'bg-slate-500' },
    { label: 'Presentations', values: [2, 2, 3, 4, 4, 5], color: 'bg-indigo-500' },
    { label: 'Placements', values: [1, 2, 2, 4, 5, 6], color: 'bg-amber-500' },
  ];
  const actionItems = [
    {
      label: `${pendingProgressReports} Progress Reports Need Review`,
      explanation: pendingProgressReports > 0 ? 'Student work is waiting for verification and portfolio credit.' : 'No reports are waiting for review.',
      priority: pendingProgressReports > 0 ? 'High' : 'Low',
      action: 'Review Reports',
      section: 'progress-reports' as SectionKey,
    },
    {
      label: `${pendingReviews} New Applicants`,
      explanation: pendingReviews > 0 ? 'New applicants need a first-pass decision to keep the funnel moving.' : 'Applicant queue is clear.',
      priority: pendingReviews > 0 ? 'High' : 'Low',
      action: 'View Applicants',
      section: 'applicants' as SectionKey,
    },
    {
      label: `${studentsMissingReports} Students Missing Reports`,
      explanation: studentsMissingReports > 0 ? 'Active researchers have not submitted recent progress evidence.' : 'Active researchers have submitted evidence.',
      priority: studentsMissingReports > 0 ? 'Medium' : 'Low',
      action: 'Send Reminder',
      section: 'messages' as SectionKey,
    },
    {
      label: `${projectsNeedingApplicants} Projects Need More Applicants`,
      explanation: projectsNeedingApplicants > 0 ? 'Some published projects have fewer than two applicants.' : 'Published projects have healthy applicant coverage.',
      priority: projectsNeedingApplicants > 0 ? 'Medium' : 'Low',
      action: 'Open Projects',
      section: 'opportunities' as SectionKey,
    },
  ];

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
      filteredApplicants.slice(0, 8).map(({ application, posting }) => ({
        id: application.id,
        name: application.studentName,
        email: application.studentEmail,
        studentId: application.studentId,
        applicationId: application.id,
        projectId: application.postingId,
        projectTitle: posting?.title ?? postingById.get(application.postingId)?.title ?? 'Research role',
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

    const messageRecipients = recipients.map((recipient) => ({
      applicationId: recipient.applicationId,
      studentId: recipient.studentId,
      name: recipient.name,
      email: recipient.email,
      projectId: recipient.projectId,
      projectTitle: recipient.projectTitle,
    }));
    const recipient = messageRecipients.length === 1 ? messageRecipients[0].name : '[Student Name]';
    const opportunity = messageRecipients.length === 1 ? messageRecipients[0].projectTitle : '[Opportunity Title]';
    const professorName = user?.name ?? '[Professor Name]';
    const template = templateOverrides[kind] ?? DEFAULT_MESSAGE_TEMPLATES[kind];

    const replaceTokens = (text: string) =>
      text
        .split('[Student Name]').join(recipient)
        .split('[Opportunity Title]').join(opportunity)
        .split('[Professor Name]').join(professorName);

    setTemplateRecipients(messageRecipients);
    setSendQueueProgress(null);
    setIsSendingQueue(false);
    setTemplateTitle(recipients.length > 1 ? `${template.title} (Bulk)` : template.title);
    setTemplateSubject(replaceTokens(template.subject));
    setTemplateBody(replaceTokens(template.body));
    setOpenTemplateDialog(true);
  };

  const processMessageQueueSend = async () => {
    const recipients = templateRecipients.filter((recipient) => recipient.applicationId && recipient.studentId && recipient.projectId);
    if (recipients.length === 0) {
      toast.error('No recipients selected.');
      return;
    }
    if (!templateSubject.trim() || !templateBody.trim()) {
      toast.error('Subject and message are required.');
      return;
    }
    if (recipients.some(isPlaceholderRecipient)) {
      toast.error('Real email sending requires an actual application record, not a demo placeholder.');
      return;
    }

    setIsSendingQueue(true);
    setSendQueueProgress({ sent: 0, total: recipients.length, recipient: recipients[0].name });

    try {
      for (let index = 0; index < recipients.length; index += 1) {
        const recipient = recipients[index];

        const individualizedSubject = templateSubject
          .split('[Student Name]').join(recipient.name)
          .split('[Opportunity Title]').join(recipient.projectTitle)
          .split('[Professor Name]').join(user?.name ?? 'Professor');
        const individualizedBody = templateBody
          .split('[Student Name]').join(recipient.name)
          .split('[Opportunity Title]').join(recipient.projectTitle)
          .split('[Professor Name]').join(user?.name ?? 'Professor');

        await sendProfessorMessageEmail({
          studentId: recipient.studentId,
          applicationId: recipient.applicationId,
          projectId: recipient.projectId,
          subject: individualizedSubject,
          body: individualizedBody,
        });

        setSendQueueProgress({ sent: index + 1, total: recipients.length, recipient: recipient.name });
      }

      toast.success(`Sent ${recipients.length}/${recipients.length} emails.`);
      setSelectedConversationIds([]);
      setTemplateRecipients([]);
      setTemplateSubject('');
      setTemplateBody('');
      setOpenTemplateDialog(false);
      setSendQueueProgress(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email sending failed.';
      toast.error(message);
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

  const savedEditingTemplate = templateOverrides[editingTemplateKind] ?? DEFAULT_MESSAGE_TEMPLATES[editingTemplateKind];
  const hasUnsavedTemplateChanges =
    editingTemplateSubject !== savedEditingTemplate.subject ||
    editingTemplateBody !== savedEditingTemplate.body;

  const previewTemplateSubject = useMemo(() => {
    const sampleValues: Record<string, string> = {
      '[Student Name]': 'Maya Chen',
      '[Opportunity Title]': 'Computational Biology Research Assistant',
      '[Professor Name]': user?.name ?? 'Professor Rivera',
    };

    customTemplateTokens.forEach((token) => {
      sampleValues[token.value] = token.label || token.value;
    });

    return Object.entries(sampleValues).reduce(
      (text, [token, sample]) => text.split(token).join(sample),
      editingTemplateSubject
    );
  }, [customTemplateTokens, editingTemplateSubject, user?.name]);

  const previewTemplateBody = useMemo(() => {
    const sampleValues: Record<string, string> = {
      '[Student Name]': 'Maya Chen',
      '[Opportunity Title]': 'Computational Biology Research Assistant',
      '[Professor Name]': user?.name ?? 'Professor Rivera',
    };

    customTemplateTokens.forEach((token) => {
      sampleValues[token.value] = token.label || token.value;
    });

    return Object.entries(sampleValues).reduce(
      (text, [token, sample]) => text.split(token).join(sample),
      editingTemplateBody
    );
  }, [customTemplateTokens, editingTemplateBody, user?.name]);

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
    setEditorTemplateTab('message');
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

  useEffect(() => {
    if (!openTemplateEditorDialog) {
      return;
    }

    const handleTemplateEditorShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveTemplateEdits();
      }
    };

    window.addEventListener('keydown', handleTemplateEditorShortcut);
    return () => window.removeEventListener('keydown', handleTemplateEditorShortcut);
  }, [openTemplateEditorDialog, saveTemplateEdits]);

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

  const applyBulkStatus = async (nextStatus: Application['status']) => {
    const targetIds = selectedApplicantIds.filter((id) => allVisibleApplicantIds.includes(id));
    if (targetIds.length === 0) {
      toast.error('Select at least one applicant first.');
      return;
    }

    try {
      await Promise.all(targetIds.map((id) => updateApplicationStatus(id, nextStatus)));
      toast.success(`${targetIds.length} applicants moved to ${nextStatus}.`);
      setSelectedApplicantIds((current) => current.filter((id) => !targetIds.includes(id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update selected applicants.');
    }
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
  const pageSurface = darkMode ? 'bg-[#111111] text-[#efefef]' : 'app-shell text-[#111111]';
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
                        interestedCount={estimatePostingInterestCount(posting, interestCounts)}
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
                            researchAreas: postingToClone.researchAreas,
                            skillsNeeded: postingToClone.skillsNeeded,
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
                        interestedCount={estimatePostingInterestCount(posting, interestCounts)}
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
                            researchAreas: postingToClone.researchAreas,
                            skillsNeeded: postingToClone.skillsNeeded,
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
                        interestedCount={estimatePostingInterestCount(posting, interestCounts)}
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
                            researchAreas: postingToClone.researchAreas,
                            skillsNeeded: postingToClone.skillsNeeded,
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

          {activeSection === 'progress-reports' ? <ProgressReportsReview /> : null}

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
                              <p className={`text-xs ${subduedText}`}>{conversation.email}</p>
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
                  <ResearchMetadataPicker
                    label="Research Areas"
                    value={labForm.researchAreas}
                    onChange={(researchAreas) => setLabForm((current) => ({ ...current, researchAreas }))}
                    disabled={isSavingProfile}
                    placeholder="Search canonical fields"
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
                  <ResearchMetadataPicker
                    label="Research Interests"
                    value={labForm.researchInterests}
                    onChange={(researchInterests) => setLabForm((current) => ({ ...current, researchInterests }))}
                    disabled={isSavingProfile}
                    allowCustom
                    placeholder="Search topics or add a concise tag"
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
            <div className="space-y-8">
              <section className={`rounded-[1.4rem] border p-5 shadow-sm ${darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d8d5cf] bg-white'}`}>
                <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.75fr)_1fr]">
                  <div className="space-y-4">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subduedText}`}>Lab Health Overview</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Analytics</h2>
                      <p className={`mt-2 max-w-xl text-sm leading-6 ${subduedText}`}>
                        Executive snapshot of applicant quality, student progress, research participation, and outcomes.
                      </p>
                    </div>
                    <div className={`rounded-2xl border p-5 ${darkMode ? 'border-[#353535] bg-[#141414]' : 'border-[#ece8e2] bg-[#fbfaf8]'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`text-xs font-medium uppercase tracking-[0.14em] ${subduedText}`}>Lab Health Score</p>
                          <div className="mt-2 flex items-end gap-2">
                            <span className="text-5xl font-semibold leading-none tracking-tight">{labHealthScore}</span>
                            <span className={`pb-1 text-sm ${subduedText}`}>/ 100</span>
                          </div>
                        </div>
                        <Badge className={`rounded-full border px-3 py-1 ${labHealthClass}`}>{labHealthTone}</Badge>
                      </div>
                      <div className="mt-5 space-y-2">
                        {[
                          ['Applicant quality', applicantQualityScore],
                          ['Student retention', retentionRate],
                          ['Progress completion', progressCompletionRate],
                          ['Research output', researchOutputScore],
                          ['Participation', participationScore],
                        ].map(([label, value]) => (
                          <AnalyticsBar key={String(label)} label={String(label)} value={Number(value)} darkMode={darkMode} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <AnalyticsKpi label="Active Projects" value={activeOpenings} helper="Published opportunities" darkMode={darkMode} />
                    <AnalyticsKpi label="Active Researchers" value={activeResearchers} helper="Accepted or reporting students" darkMode={darkMode} />
                    <AnalyticsKpi label="Total Applications" value={totalApplicants} helper={`${acceptanceRate}% accepted`} darkMode={darkMode} />
                    <AnalyticsKpi label="Pending Reviews" value={pendingReviews} helper="Need faculty decision" darkMode={darkMode} tone={pendingReviews > 0 ? 'warning' : 'success'} />
                  </div>
                </div>
              </section>

              <AnalyticsSection
                eyebrow="Action Center"
                title="What Needs Attention"
                description="Prioritized work that keeps applicants moving and student research evidence current."
                darkMode={darkMode}
                action={
                  <Select defaultValue="30d">
                    <SelectTrigger className="h-9 w-[150px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="semester">This semester</SelectItem>
                    </SelectContent>
                  </Select>
                }
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {actionItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => void handleSectionChange(item.section)}
                      className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        darkMode ? 'border-[#303030] bg-[#171717] hover:border-[#444444]' : 'border-[#e8e5df] bg-[#fbfaf8] hover:border-[#d8d2c9]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge className={`rounded-full border px-2.5 py-0.5 text-[11px] ${priorityClass(item.priority)}`}>
                            {item.priority} priority
                          </Badge>
                          <h3 className="mt-3 text-base font-semibold">{item.label}</h3>
                          <p className={`mt-1 text-sm leading-6 ${subduedText}`}>{item.explanation}</p>
                        </div>
                        <span className="rounded-full border border-[#dedede] bg-white px-3 py-1 text-xs font-medium text-[#444444] transition-colors group-hover:border-red-200 group-hover:text-red-700">
                          {item.action}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Applicant Analytics"
                title="Applicant Funnel and Quality"
                description="Conversion, dropoff, and confidence levels based on the existing applicant scoring signal."
                darkMode={darkMode}
              >
                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-3">
                    {applicantFunnelStages.map((stage, index) => {
                      const previous = index === 0 ? stage.count : applicantFunnelStages[index - 1].count;
                      const conversion = index === 0 ? 100 : percentOf(stage.count, previous);
                      const dropoff = index === 0 ? 0 : 100 - conversion;
                      return (
                        <div key={stage.label} className={`rounded-2xl border p-3 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{stage.label}</p>
                              <p className={`text-xs ${subduedText}`}>{conversion}% conversion {index > 0 ? `| ${dropoff}% dropoff` : '| starting pool'}</p>
                            </div>
                            <p className="text-2xl font-semibold">{stage.count}</p>
                          </div>
                          <div className={`mt-3 h-2 rounded-full ${darkMode ? 'bg-[#2a2a2a]' : 'bg-[#eeeeee]'}`}>
                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.max(4, conversion)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-4">
                    {[
                      ['High Confidence Applicants', highConfidenceApplicants, 'Research experience, verified contributions, skill match, and coursework align strongly.'],
                      ['Medium Confidence Applicants', mediumConfidenceApplicants, 'Promising applicants with partial alignment or evidence still needing review.'],
                      ['Low Confidence Applicants', lowConfidenceApplicants, 'Applicants who may need more context before moving forward.'],
                    ].map(([label, count, explanation], index) => (
                      <ConfidencePanel
                        key={String(label)}
                        label={String(label)}
                        count={Number(count)}
                        total={totalApplicants}
                        explanation={String(explanation)}
                        tone={index === 0 ? 'success' : index === 1 ? 'info' : 'warning'}
                        darkMode={darkMode}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-6 grid gap-5 lg:grid-cols-3">
                  <SkillAnalytics title="Most Common Skills" rows={applicantSkills} darkMode={darkMode} />
                  <SkillAnalytics
                    title="Most Requested Skills"
                    rows={(requestedSkills.length > 0 ? requestedSkills : SKILL_DISTRIBUTION.slice(0, 4)).map((entry) => ({
                      skill: entry.skill,
                      count: entry.count,
                      percentage: percentOf(entry.count, Math.max(requestedSkills[0]?.count ?? SKILL_DISTRIBUTION[0]?.count ?? 1, 1)),
                    }))}
                    darkMode={darkMode}
                  />
                  <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
                    <p className="font-semibold">Missing Skills</p>
                    <p className={`mt-1 text-xs ${subduedText}`}>Requested by projects but underrepresented in the applicant pool.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(missingSkills.length > 0 ? missingSkills : [{ skill: 'No critical gaps', count: 1 }]).map((entry) => (
                        <Badge key={entry.skill} className="rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                          {entry.skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Research Pipeline"
                title="From Applicant Pool to Research Outcomes"
                description="Responsive stage cards replace the previous oversized funnel and horizontal scrolling."
                darkMode={darkMode}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  {pipelineStages.map((stage, index) => {
                    const previous = index === 0 ? stage.count : pipelineStages[index - 1].count;
                    return (
                      <div key={stage.label} className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
                        <p className={`text-xs font-medium uppercase tracking-[0.12em] ${subduedText}`}>{stage.label}</p>
                        <p className="mt-2 text-3xl font-semibold">{stage.count}</p>
                        <p className={`mt-1 text-xs ${subduedText}`}>{index === 0 ? '100% pool' : `${percentOf(stage.count, previous)}% from prior`}</p>
                      </div>
                    );
                  })}
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Student Progress"
                title="Researcher Activity"
                description="Activity, hours, reporting behavior, and students who need attention."
                darkMode={darkMode}
              >
                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-[#303030]' : 'border-[#ece8e2]'}`}>
                    <div className={`hidden grid-cols-[1.1fr_1.2fr_0.7fr_0.8fr_0.8fr] gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] md:grid ${darkMode ? 'bg-[#171717] text-[#a7a7a7]' : 'bg-[#fbfaf8] text-[#777777]'}`}>
                      <span>Student</span>
                      <span>Project</span>
                      <span>Hours</span>
                      <span>Reports</span>
                      <span>Last Activity</span>
                    </div>
                    {(mostActiveResearchers.length > 0 ? mostActiveResearchers : [{ studentName: 'No reports yet', projectTitle: 'Awaiting student activity', hours: 0, reports: 0, lastActivity: new Date().toISOString() }]).map((row) => (
                      <button
                        key={`${row.studentName}-${row.projectTitle}`}
                        type="button"
                        onClick={() => void handleSectionChange('progress-reports')}
                        className={`grid w-full gap-2 border-t px-4 py-3 text-left text-sm transition-colors md:grid-cols-[1.1fr_1.2fr_0.7fr_0.8fr_0.8fr] ${
                          darkMode ? 'border-[#303030] hover:bg-[#171717]' : 'border-[#eeeeee] hover:bg-[#fbfaf8]'
                        }`}
                      >
                        <span className="font-medium">{row.studentName}</span>
                        <span className={subduedText}>{row.projectTitle}</span>
                        <span><span className={`md:hidden ${subduedText}`}>Hours: </span>{row.hours}</span>
                        <span><span className={`md:hidden ${subduedText}`}>Reports: </span>{row.reports}</span>
                        <span className={subduedText}><span className="md:hidden">Last activity: </span>{new Date(row.lastActivity).toLocaleDateString()}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    <AttentionMetric label="Missing Reports" value={studentsMissingReports} helper="Accepted students without recent evidence" tone="warning" darkMode={darkMode} />
                    <AttentionMetric label="No Activity" value={Math.max(0, activeResearchers - mostActiveResearchers.length)} helper="Researchers without logged reports" tone="info" darkMode={darkMode} />
                    <AttentionMetric label="Rejected Reports" value={rejectedProgressReports} helper="Reports needing revision" tone="danger" darkMode={darkMode} />
                  </div>
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Research Outcomes"
                title="Program Success Signals"
                description="Grouped outcome metrics for publications, presentations, placements, awards, patents, and startups."
                darkMode={darkMode}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {outcomeMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.category} className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
                        <Icon className={`h-4 w-4 ${metric.tone === 'success' ? 'text-emerald-600' : metric.tone === 'info' ? 'text-blue-600' : 'text-[#777777]'}`} />
                        <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
                        <p className="mt-1 text-sm font-medium">{metric.category}</p>
                        <p className={`mt-1 text-xs leading-5 ${subduedText}`}>{metric.helper}</p>
                      </div>
                    );
                  })}
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Benchmarking"
                title="Your Lab vs Department Average"
                description="Comparison bars make outperformance and risk areas visible at a glance."
                darkMode={darkMode}
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {benchmarks.map((benchmark) => (
                    <BenchmarkRow key={benchmark.label} {...benchmark} darkMode={darkMode} />
                  ))}
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Historical Trends"
                title="Research Growth"
                description="Cleaner trend strips for applications, retention, publications, presentations, and placements."
                darkMode={darkMode}
              >
                <div className="grid gap-4 lg:grid-cols-5">
                  {historicalTrendRows.map((row) => (
                    <TrendStrip key={row.label} {...row} darkMode={darkMode} />
                  ))}
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Annual Reporting Tools"
                title="Annual Research Summary"
                description="Professional executive reporting for annual review, grants, tenure packets, and PDF exports."
                darkMode={darkMode}
                action={
                  <Button variant="outline" className="rounded-xl" onClick={() => exportProfessorAnalyticsSummary('annual', labHealthScore, actionItems)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Summary
                  </Button>
                }
              >
                <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                  <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
                    <h3 className="font-semibold">Executive Summary</h3>
                    <p className={`mt-2 text-sm leading-6 ${subduedText}`}>
                      Your lab is currently rated {labHealthTone.toLowerCase()} at {labHealthScore}/100, with {activeResearchers} active researchers,
                      {totalApplicants} applicants this cycle, and {approvedProgressReports} approved progress reports contributing to the verified research portfolio.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {['Strong applicant signal', 'Verified student progress', 'Outcome-ready metrics', 'Department benchmark context'].map((item) => (
                        <div key={item} className={`rounded-xl border px-3 py-2 text-sm ${darkMode ? 'border-[#303030]' : 'border-[#eeeeee]'}`}>
                          <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
                    <h3 className="font-semibold">Export Options</h3>
                    <div className="mt-4 grid gap-2">
                      <Button className="justify-start rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => exportProfessorAnalyticsSummary('annual', labHealthScore, actionItems)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export Annual Report
                      </Button>
                      <Button variant="outline" className="justify-start rounded-xl" onClick={() => exportProfessorAnalyticsSummary('grant', labHealthScore, actionItems)}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Grant Summary
                      </Button>
                      <Button variant="outline" className="justify-start rounded-xl" onClick={() => exportProfessorAnalyticsSummary('tenure', labHealthScore, actionItems)}>
                        <Award className="mr-2 h-4 w-4" />
                        Generate Tenure Summary
                      </Button>
                      <Button variant="outline" className="justify-start rounded-xl" onClick={() => exportProfessorAnalyticsSummary('pdf', labHealthScore, actionItems)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </AnalyticsSection>
            </div>
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
              <Label>Recipients</Label>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl border border-[#ececec] p-2 text-sm dark:border-[#313131]">
                {templateRecipients.map((recipient) => (
                  <div key={recipient.applicationId} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{recipient.name}</span>
                    <span className={subduedText}>{recipient.email}</span>
                  </div>
                ))}
              </div>
              <p className={`text-xs ${subduedText}`}>
                Replies will be sent directly to: {user?.email ?? 'your professor email'}
              </p>
            </div>
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
                {isSendingQueue ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openTemplateEditorDialog} onOpenChange={setOpenTemplateEditorDialog}>
        <DialogContent className="mx-auto grid max-h-[90vh] w-[min(96vw,1200px)] max-w-[1200px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <DialogTitle className="text-2xl font-semibold tracking-tight">Edit Message Templates</DialogTitle>
              {hasUnsavedTemplateChanges ? (
                <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Unsaved changes
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="text-sm text-slate-600">
              Customize templates and insert tokens where your cursor is active.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <div className="grid w-full items-start gap-5 lg:[grid-template-columns:minmax(320px,35%)_minmax(0,65%)]">
              <aside className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-slate-900">
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
                      setEditorTemplateTab('message');
                    }}
                  >
                    <SelectTrigger id="template-kind" className="h-10 rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm">
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allTemplateTokens.map((token) => (
                      <Button
                        key={`editor-token-${token.key}`}
                        type="button"
                        variant="outline"
                        className="h-8 max-w-full gap-1.5 rounded-full border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                        onClick={() => insertTokenIntoEditor(token.value)}
                        title={`Insert ${token.value}`}
                      >
                        {token.value === '[Student Name]' ? <UserCircle className="h-3.5 w-3.5 text-slate-500" /> : null}
                        {token.value === '[Opportunity Title]' ? <Briefcase className="h-3.5 w-3.5 text-slate-500" /> : null}
                        {token.value === '[Professor Name]' ? <Sparkles className="h-3.5 w-3.5 text-slate-500" /> : null}
                        {token.value !== '[Student Name]' && token.value !== '[Opportunity Title]' && token.value !== '[Professor Name]' ? <PlusCircle className="h-3.5 w-3.5 text-slate-500" /> : null}
                        <span className="truncate">{token.value}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="my-4 h-px bg-slate-200" />

                <div>
                  <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Custom Token</Label>
                  <div className="mt-3 grid gap-2">
                    <Input
                      id="new-custom-token"
                      value={newCustomTokenLabel}
                      onChange={(event) => setNewCustomTokenLabel(event.target.value)}
                      placeholder="Display label"
                      className="h-10 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                    <Input
                      value={newCustomTokenValue}
                      onChange={(event) => setNewCustomTokenValue(event.target.value)}
                      placeholder="Token value e.g. [Deadline Date]"
                      className="h-10 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-100"
                      onClick={addCustomToken}
                    >
                      Add Token
                    </Button>
                  </div>

                  {customTemplateTokens.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customTemplateTokens.map((token) => (
                        <span
                          key={`custom-token-${token.id}`}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
                        >
                          <span className="max-w-[220px] truncate">{token.label}: {token.value}</span>
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
              </aside>

              <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
                <Tabs value={editorTemplateTab} onValueChange={(value) => setEditorTemplateTab(value as 'message' | 'preview')} className="gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label htmlFor="editor-template-subject" className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Subject</Label>
                    </div>
                    <TabsList className="h-9 rounded-lg bg-slate-100 p-1">
                      <TabsTrigger value="message" className="rounded-md px-3 text-xs">Message</TabsTrigger>
                      <TabsTrigger value="preview" className="rounded-md px-3 text-xs">Preview</TabsTrigger>
                    </TabsList>
                  </div>

                  <Input
                    id="editor-template-subject"
                    ref={editorSubjectRef}
                    value={editingTemplateSubject}
                    onFocus={() => setActiveEditorField('subject')}
                    onClick={() => setActiveEditorField('subject')}
                    onChange={(event) => setEditingTemplateSubject(event.target.value)}
                    className="h-12 w-full rounded-lg border-slate-300 bg-white text-base text-slate-900 shadow-sm"
                  />

                  <TabsContent value="message" className="mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="editor-template-body" className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Message</Label>
                      <Textarea
                        id="editor-template-body"
                        ref={editorBodyRef}
                        value={editingTemplateBody}
                        onFocus={() => setActiveEditorField('body')}
                        onClick={() => setActiveEditorField('body')}
                        onChange={(event) => setEditingTemplateBody(event.target.value)}
                        rows={18}
                        className="min-h-[500px] resize-y rounded-lg border-slate-300 bg-white font-mono text-[15px] leading-7 text-slate-900 shadow-sm"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="mt-0">
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Subject Preview</p>
                        <p className="mt-1 break-words text-base font-semibold leading-6 text-slate-950">{previewTemplateSubject}</p>
                      </div>
                      <div className="min-h-[500px] whitespace-pre-wrap px-5 py-5 text-[15px] leading-7 text-slate-800">
                        {previewTemplateBody}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
            <span className="text-sm text-slate-500">
              {hasUnsavedTemplateChanges ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" className="h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100" onClick={resetTemplateEdits}>
                Reset to Default
              </Button>
              <Button variant="ghost" className="h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100" onClick={() => setOpenTemplateEditorDialog(false)}>
                Cancel
              </Button>
              <Button className="h-10 rounded-lg bg-slate-900 px-5 text-white shadow-sm hover:bg-slate-800" onClick={saveTemplateEdits}>
                Save Template
              </Button>
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

function percentOf(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function priorityClass(priority: string) {
  if (priority === 'High') return 'status-danger';
  if (priority === 'Medium') return 'status-warning';
  return 'status-success';
}

function exportProfessorAnalyticsSummary(
  kind: 'annual' | 'grant' | 'tenure' | 'pdf',
  labHealthScore: number,
  actionItems: Array<{ label: string; explanation: string; priority: string }>
) {
  const titleByKind = {
    annual: 'Annual Research Summary',
    grant: 'Grant Summary',
    tenure: 'Tenure Summary',
    pdf: 'Annual Research Summary',
  };
  const body = [
    titleByKind[kind],
    `Generated: ${new Date().toLocaleString()}`,
    '',
    `Lab Health Score: ${labHealthScore}/100`,
    '',
    'Key Achievements',
    '- Maintained an active research pipeline from applicants to verified contributors.',
    '- Tracked student progress with faculty-reviewed evidence.',
    '- Benchmarked lab performance against department averages.',
    '',
    'Action Center',
    ...actionItems.map((item) => `- [${item.priority}] ${item.label}: ${item.explanation}`),
  ].join('\n');

  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `professor-${kind}-research-summary.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  toast.success(kind === 'pdf' ? 'Report download prepared.' : 'Summary exported.');
}

function AnalyticsSection({
  eyebrow,
  title,
  description,
  action,
  children,
  darkMode,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <section className={`rounded-[1.4rem] border p-5 shadow-sm ${darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d8d5cf] bg-white'}`}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${darkMode ? 'text-[#9f9f9f]' : 'text-[#777777]'}`}>
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
          <p className={`mt-1 max-w-3xl text-sm leading-6 ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>{description}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function AnalyticsKpi({
  label,
  value,
  helper,
  darkMode,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  helper: string;
  darkMode: boolean;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const accentClass = tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : '';
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-[#fbfaf8]'}`}>
      <p className={`text-xs font-medium uppercase tracking-[0.12em] ${darkMode ? 'text-[#a7a7a7]' : 'text-[#777777]'}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</p>
      <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-[#a7a7a7]' : 'text-[#666666]'}`}>{helper}</p>
    </div>
  );
}

function AnalyticsBar({ label, value, darkMode }: { label: string; value: number; darkMode: boolean }) {
  return (
    <div>
      <div className={`mb-1 flex justify-between text-xs ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className={`h-1.5 rounded-full ${darkMode ? 'bg-[#2b2b2b]' : 'bg-[#ececec]'}`}>
        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(4, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}

function ConfidencePanel({
  label,
  count,
  total,
  explanation,
  tone,
  darkMode,
}: {
  label: string;
  count: number;
  total: number;
  explanation: string;
  tone: 'success' | 'info' | 'warning';
  darkMode: boolean;
}) {
  const color = tone === 'success' ? 'status-success' : tone === 'info' ? 'status-info' : 'status-warning';
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{label}</p>
          <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>{explanation}</p>
        </div>
        <Badge className={`rounded-full border px-2.5 py-1 ${color}`}>{percentOf(count, total)}%</Badge>
      </div>
      <p className="mt-3 text-2xl font-semibold">{count} <span className={`text-sm font-normal ${darkMode ? 'text-[#a7a7a7]' : 'text-[#666666]'}`}>students</span></p>
    </div>
  );
}

function SkillAnalytics({
  title,
  rows,
  darkMode,
}: {
  title: string;
  rows: Array<{ skill: string; count: number; percentage: number }>;
  darkMode: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={`${title}-${row.skill}`}>
            <div className={`mb-1 flex justify-between text-xs ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>
              <span>{row.skill}</span>
              <span>{row.count}</span>
            </div>
            <div className={`h-2 rounded-full ${darkMode ? 'bg-[#2b2b2b]' : 'bg-[#eeeeee]'}`}>
              <div className="h-2 rounded-full bg-slate-500" style={{ width: `${Math.max(8, row.percentage)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttentionMetric({
  label,
  value,
  helper,
  tone,
  darkMode,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'warning' | 'info' | 'danger';
  darkMode: boolean;
}) {
  const statusClass = tone === 'danger' ? 'status-danger' : tone === 'warning' ? 'status-warning' : 'status-info';
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
      <Badge className={`rounded-full border px-2.5 py-0.5 text-xs ${statusClass}`}>{label}</Badge>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className={`mt-1 text-sm leading-6 ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>{helper}</p>
    </div>
  );
}

function BenchmarkRow({
  label,
  yourLab,
  department,
  suffix,
  darkMode,
}: {
  label: string;
  yourLab: number;
  department: number;
  suffix: string;
  darkMode: boolean;
}) {
  const max = Math.max(yourLab, department, 1);
  const diff = Math.round(yourLab - department);
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{label}</p>
        <Badge className={`rounded-full border px-2.5 py-0.5 ${diff >= 0 ? 'status-success' : 'status-warning'}`}>
          {diff >= 0 ? '+' : ''}{diff}{suffix}
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        <ComparisonBar label="Your Lab" value={yourLab} max={max} suffix={suffix} color="bg-emerald-500" darkMode={darkMode} />
        <ComparisonBar label="Department Avg" value={department} max={max} suffix={suffix} color="bg-slate-400" darkMode={darkMode} />
      </div>
    </div>
  );
}

function ComparisonBar({
  label,
  value,
  max,
  suffix,
  color,
  darkMode,
}: {
  label: string;
  value: number;
  max: number;
  suffix: string;
  color: string;
  darkMode: boolean;
}) {
  return (
    <div>
      <div className={`mb-1 flex justify-between text-xs ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>
        <span>{label}</span>
        <span>{value}{suffix}</span>
      </div>
      <div className={`h-2 rounded-full ${darkMode ? 'bg-[#2b2b2b]' : 'bg-[#eeeeee]'}`}>
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(5, percentOf(value, max))}%` }} />
      </div>
    </div>
  );
}

function TrendStrip({
  label,
  values,
  color,
  darkMode,
}: {
  label: string;
  values: number[];
  color: string;
  darkMode: boolean;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#303030] bg-[#171717]' : 'border-[#ece8e2] bg-white'}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{label}</p>
        <TrendingUp className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="mt-5 flex h-20 items-end gap-1.5">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className={`flex-1 rounded-t ${color}`} style={{ height: `${Math.max(12, (value / max) * 100)}%` }} title={`${label}: ${value}`} />
        ))}
      </div>
      <p className={`mt-3 text-xs ${darkMode ? 'text-[#b3b3b3]' : 'text-[#666666]'}`}>Latest: {values[values.length - 1]}</p>
    </div>
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
  const [shareOpen, setShareOpen] = useState(false);

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
        {posting.researchAreas?.length || posting.skillsNeeded?.length ? (
          <div className="flex flex-wrap gap-2">
            {(posting.researchAreas ?? []).slice(0, 4).map((area: string) => (
              <Badge key={`area-${posting.id}-${area}`} variant="secondary" className="rounded-full">
                {area}
              </Badge>
            ))}
            {(posting.skillsNeeded ?? []).slice(0, 4).map((skill: string) => (
              <Badge key={`skill-${posting.id}-${skill}`} className="rounded-full border border-[#d8d8d8] bg-white text-[#4f4a46] hover:bg-white">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}
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
            onClick={() => setShareOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
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
      <ShareOpportunityDialog posting={posting} open={shareOpen} onOpenChange={setShareOpen} />
    </Card>
  );
}

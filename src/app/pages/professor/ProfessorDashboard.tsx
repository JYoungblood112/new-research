import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
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

const NAV_ITEMS: Array<{ key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'applicants', label: 'Applicants', icon: Users },
  { key: 'opportunities', label: 'Research Opportunities', icon: Briefcase },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'lab-profile', label: 'Lab Profile', icon: UserCircle },
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
  githubRepos: Array<{ name: string; description: string }>;
  personalStatement: string;
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
      },
      {
        name: 'llm-eval-lab',
        description: 'Evaluation scripts for instruction-tuned models on scientific text tasks.',
      },
    ],
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
      },
    ],
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
      },
    ],
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
        },
      ],
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
      },
    ],
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
): { requirement: string; status: RequirementStatus; assessment: string } {
  const req = requirement.toLowerCase();
  const major = application.studentMajor;
  const statement = profile.personalStatement;
  const resumeName = application.resume.name;

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
    };
  }

  const hasStrongEvidence = skillMatches.length > 0 || courseMatches.length > 0 || repoMatches.length > 0;
  const hasIntentSignal = /research|experiment|independent|study|publication/i.test(statement);

  if (hasStrongEvidence) {
    const evidenceParts: string[] = [];
    if (skillMatches.length > 0) {
      evidenceParts.push(`skills (${skillMatches.join(', ')})`);
    }
    if (courseMatches.length > 0) {
      evidenceParts.push(`coursework (${courseMatches.slice(0, 2).join(', ')})`);
    }
    if (repoMatches.length > 0) {
      evidenceParts.push(`GitHub (${repoMatches[0].name})`);
    }

    return {
      requirement,
      status: 'met',
      assessment: `Demonstrated through ${evidenceParts.join('; ')}. Resume file ${resumeName} and statement align with this requirement for ${major}.`,
    };
  }

  if (hasIntentSignal || req.includes('research') || req.includes('experience')) {
    return {
      requirement,
      status: 'partial',
      assessment: `No direct credential listed, but the personal statement references ${statement.toLowerCase()} and suggests transferable research habits from project-based work.`,
    };
  }

  return {
    requirement,
    status: 'missing',
    assessment: `This requirement is not explicitly supported by listed skills, coursework, or repository evidence; collect specific examples during interview.`,
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

export default function ProfessorDashboard() {
  const { user, logout, setupState } = useAuth();
  const { applications, getApplicationsByPosting, getPostingsByProfessor, updateApplicationStatus, addPosting } = useData();
  const navigate = useNavigate();

  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [editingPosting, setEditingPosting] = useState<any | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('dashboard');
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});
  const [messageFolder, setMessageFolder] = useState<MessageFolder>('inbox');
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantStatusFilter, setApplicantStatusFilter] = useState<'all' | Application['status']>('all');
  const [applicantSort, setApplicantSort] = useState<'score' | 'date' | 'project'>('score');
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [openCommandPalette, setOpenCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const initializedDefaultSection = useRef(false);

  const professorProfile =
    (setupState?.profile as
      | {
          department?: string;
          title?: string;
          labDescription?: string;
          bioUrl?: string;
        }
      | undefined) ?? {};

  const [labForm, setLabForm] = useState({
    professorName: user?.name ?? '',
    department: professorProfile.department ?? '',
    title: professorProfile.title ?? '',
    researchAreas: 'Machine Learning, NLP, Robotics',
    labDescription:
      professorProfile.labDescription ??
      'Our lab explores practical AI systems that bridge methodological rigor with real-world impact.',
    labWebsite: professorProfile.bioUrl ?? '',
    recruitingStatus: 'Actively Recruiting',
    preferredSkills: 'Python, PyTorch, Data Analysis, Experiment Design',
    researchInterests: 'Responsible AI, Human-Centered ML, Systems for Scalable Inference',
  });

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
                <DropdownMenuItem onClick={() => setActiveSection('settings')}>
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
          className={`sticky top-4 h-[calc(100vh-3rem)] rounded-2xl border p-3 transition-all duration-300 ${cardSurface} ${sidebarCollapsed ? 'w-[84px]' : 'w-[270px]'}`}
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
                  onClick={() => setActiveSection(item.key)}
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
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setActiveSection('applicants'); setSelectedApplicantId(application.id); }}>
                              Review
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setActiveSection('messages'); }}>
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
                          setActiveSection('applicants');
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
                          setActiveSection('applicants');
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
                          setActiveSection('applicants');
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
                                <Button
                                  type="button"
                                  variant="link"
                                  className="mt-1 h-auto p-0 text-xs text-red-700"
                                  onClick={() => {
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
                                    navigate(`/professor/applicant-insights/${application.id}?${params.toString()}`);
                                  }}
                                >
                                  More
                                </Button>
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
                          <p className="text-sm font-medium">{conversation.name}</p>
                          <p className={`text-xs ${subduedText}`}>{conversation.subject}</p>
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="justify-start rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => toast.success('Interview template prepared')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Interview
                    </Button>
                    <Button variant="outline" className="justify-start rounded-xl" onClick={() => toast.success('Request info template prepared')}>
                      <Mail className="mr-2 h-4 w-4" />
                      Request Information
                    </Button>
                    <Button variant="outline" className="justify-start rounded-xl" onClick={() => toast.success('Acceptance template prepared')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Accept Candidate
                    </Button>
                    <Button variant="outline" className="justify-start rounded-xl" onClick={() => toast.success('Rejection template prepared')}>
                      <Bell className="mr-2 h-4 w-4" />
                      Reject Candidate
                    </Button>
                  </div>

                  <div className={`rounded-xl border p-4 ${darkMode ? 'border-[#2b2b2b] bg-[#1a1a1a]' : 'border-[#ececec] bg-[#fafafa]'}`}>
                    <p className="text-sm font-medium">Email Template: Interview Invite</p>
                    <p className={`mt-2 text-sm ${subduedText}`}>
                      Hi [Student Name], we reviewed your application and would like to invite you to an interview for [Opportunity Title]. Please share your availability for next week.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeSection === 'lab-profile' ? (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle>Lab Profile</CardTitle>
                <CardDescription>Manage your public lab identity and recruiting preferences.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                  {(() => {
                    const requiredFields = [
                      labForm.professorName,
                      labForm.department,
                      labForm.title,
                      labForm.researchAreas,
                      labForm.labDescription,
                      labForm.labWebsite,
                    ];
                    const completed = requiredFields.filter((value) => value.trim().length > 0).length;
                    const percent = Math.round((completed / requiredFields.length) * 100);
                    return (
                      <>
                        <p className="text-sm font-semibold">Profile completeness: {percent}%</p>
                        <p className="mt-1 text-xs text-[#666666]">
                          Labs with complete descriptions and links tend to attract more applications and better candidate quality.
                        </p>
                      </>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label>Professor Name</Label>
                  <Input
                    value={labForm.professorName}
                    onChange={(event) => setLabForm((current) => ({ ...current, professorName: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={labForm.department}
                    onChange={(event) => setLabForm((current) => ({ ...current, department: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={labForm.title}
                    onChange={(event) => setLabForm((current) => ({ ...current, title: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Research Areas</Label>
                  <Input
                    value={labForm.researchAreas}
                    onChange={(event) => setLabForm((current) => ({ ...current, researchAreas: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Lab Description</Label>
                  <Input
                    value={labForm.labDescription}
                    onChange={(event) => setLabForm((current) => ({ ...current, labDescription: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lab Website</Label>
                  <Input
                    value={labForm.labWebsite}
                    onChange={(event) => setLabForm((current) => ({ ...current, labWebsite: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Recruiting Status</Label>
                  <Select
                    value={labForm.recruitingStatus}
                    onValueChange={(value) => setLabForm((current) => ({ ...current, recruitingStatus: value }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Recruiting status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Actively Recruiting">Actively Recruiting</SelectItem>
                      <SelectItem value="Limited Openings">Limited Openings</SelectItem>
                      <SelectItem value="Not Recruiting">Not Recruiting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Preferred Student Skills</Label>
                  <Input
                    value={labForm.preferredSkills}
                    onChange={(event) => setLabForm((current) => ({ ...current, preferredSkills: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Research Interests</Label>
                  <Input
                    value={labForm.researchInterests}
                    onChange={(event) => setLabForm((current) => ({ ...current, researchInterests: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="md:col-span-2 flex justify-between">
                  <Button variant="outline" className="rounded-xl" onClick={() => navigate('/professor/profile')}>
                    Open Full Profile Editor
                  </Button>
                  <Button
                    className="rounded-xl bg-red-700 text-white hover:bg-red-800"
                    onClick={() => toast.success('Lab profile changes saved')}
                  >
                    Save Changes
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
                <Card>
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
                    <a href="#" className="text-red-700 underline underline-offset-2">github.com/student-profile</a>
                    {(selectedApplicantEvidence?.githubRepos ?? [
                      {
                        name: 'ml-research-portfolio',
                        description: 'Model benchmarking and experiment tracking toolkit.',
                      },
                    ]).map((repo) => (
                      <div key={repo.name} className="rounded-xl border border-[#e7e7e7] p-3">
                        <p className="font-medium">{repo.name}</p>
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
                                          <p className="text-xs leading-relaxed">{row.assessment}</p>
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
                      onClick={() => {
                        setActiveSection(item.key);
                        setOpenCommandPalette(false);
                        setCommandQuery('');
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

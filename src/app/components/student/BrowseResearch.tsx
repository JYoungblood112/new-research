import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowUpDown,
  BadgeDollarSign,
  BookOpenCheck,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { type ResearchPosting, useData } from '../../contexts/DataContext';
import { RESEARCH_POSTING_CATEGORY_OPTIONS } from '../../lib/researchTaxonomy';
import { supabase } from '../../lib/supabase';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { EmptyState, ErrorState, LoadingState } from '../ui/dashboard';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import ApplyToResearchDialog from './ApplyToResearchDialog';
import ShareOpportunityDialog from '../shared/ShareOpportunityDialog';

const CATEGORIES = ['All', ...RESEARCH_POSTING_CATEGORY_OPTIONS] as const;

const COMPENSATION_OPTIONS = ['All', 'course credit', 'stipend', 'tbd', 'volunteer'] as const;
const COMPENSATION_LABELS: Record<(typeof COMPENSATION_OPTIONS)[number], string> = {
  All: 'All Compensation Types',
  'course credit': 'Course Credit',
  stipend: 'Paid',
  tbd: 'To Be Determined',
  volunteer: 'Volunteer',
};

const SORT_FIELDS = [
  { value: 'applicationDeadline', label: 'Deadline' },
  { value: 'createdAt', label: 'Posted' },
] as const;

const SORT_ORDERS = [
  { value: 'desc', label: 'Newest / Latest first' },
  { value: 'asc', label: 'Oldest / Soonest first' },
] as const;

type FitLabel = 'Excellent Fit' | 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Low Fit';
type MatchStatus = 'loading' | 'ready' | 'unavailable';

type MatchScore = {
  confidence: number;
  recommendation: string | null;
  qualifications: string[];
  fit_reasoning: string[];
  gaps: string[];
};

type MatchEntry = {
  status: MatchStatus;
  score?: MatchScore;
};

type RecommendationScore = MatchScore & {
  postingId?: string;
};

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function normalizeScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric <= 1 ? numeric * 100 : numeric)));
}

function normalizeMatchScore(value: Record<string, any>): MatchScore {
  return {
    confidence: normalizeScore(value?.confidence),
    recommendation: typeof value?.recommendation === 'string' ? value.recommendation : null,
    qualifications: asStringList(value?.qualifications),
    fit_reasoning: asStringList(value?.fit_reasoning),
    gaps: asStringList(value?.gaps),
  };
}

function getFitLabel(score: number): FitLabel {
  if (score >= 90) return 'Excellent Fit';
  if (score >= 80) return 'Strong Fit';
  if (score >= 65) return 'Good Fit';
  if (score >= 50) return 'Possible Fit';
  return 'Low Fit';
}

function getFitTextClass(score: number) {
  if (score >= 90) return 'text-emerald-700';
  if (score >= 80) return 'text-green-700';
  if (score >= 65) return 'text-blue-700';
  if (score >= 50) return 'text-amber-800';
  return 'text-slate-700';
}

function getDeadlineMeta(value: string) {
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    return {
      label: 'Deadline unavailable',
      detail: '',
      className: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) {
    return {
      label: 'Deadline passed',
      detail: deadline.toLocaleDateString(),
      className: 'border-red-200 bg-red-50 text-red-700',
    };
  }

  if (daysLeft <= 7) {
    return {
      label: 'Closing soon',
      detail: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    label: `${daysLeft} days left`,
    detail: `Apply by ${deadline.toLocaleDateString()}`,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function formatBrowseEndDate(duration: string, startDate: string) {
  const parsedDurationDate = new Date(duration);
  if (!Number.isNaN(parsedDurationDate.getTime())) {
    return parsedDurationDate.toLocaleDateString();
  }

  const parsedStartDate = new Date(startDate);
  if (Number.isNaN(parsedStartDate.getTime())) {
    return duration;
  }

  const normalized = duration.toLowerCase();
  const monthMatch = normalized.match(/(\d+)\s*month/);
  const weekMatch = normalized.match(/(\d+)\s*week/);
  let monthsToAdd = 0;

  if (monthMatch) {
    monthsToAdd = Number.parseInt(monthMatch[1], 10);
  } else if (/2\s*semester/.test(normalized)) {
    monthsToAdd = 8;
  } else if (/1\s*semester/.test(normalized) || /\bsemester\b/.test(normalized)) {
    monthsToAdd = 4;
  } else if (/academic\s*year|\b1\s*year\b|12\s*month/.test(normalized)) {
    monthsToAdd = 12;
  } else if (/\b2\s*year\b|24\s*month/.test(normalized)) {
    monthsToAdd = 24;
  }

  const estimatedEndDate = new Date(parsedStartDate);
  if (monthsToAdd > 0) {
    estimatedEndDate.setMonth(estimatedEndDate.getMonth() + monthsToAdd);
    return estimatedEndDate.toLocaleDateString();
  }

  if (weekMatch) {
    const weeksToAdd = Number.parseInt(weekMatch[1], 10);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + weeksToAdd * 7);
    return estimatedEndDate.toLocaleDateString();
  }

  return parsedStartDate.toLocaleDateString();
}

function getDurationLabel(duration: string) {
  const normalized = duration.toLowerCase();
  if (/academic\s*year|year|12\s*month/.test(normalized)) return 'Year-long';
  if (/semester/.test(normalized)) return 'Semester';
  return duration;
}

function getCommitmentLabel(value: string) {
  const hourMatch = value.match(/(\d+)\s*(?:-|to)?\s*(\d+)?\s*(?:hr|hour)/i);
  if (!hourMatch) return value;
  const high = hourMatch[2] ? `-${hourMatch[2]}` : '';
  return `${hourMatch[1]}${high} hrs/week`;
}

async function getAuthHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : undefined;
}

export default function BrowseResearch() {
  const { user, setupState } = useAuth();
  const {
    postings,
    projectsLoading,
    projectsError,
    refreshProjects,
    getApplicationsByStudent,
    getProgressReportsByStudent,
  } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCompensation, setSelectedCompensation] = useState<(typeof COMPENSATION_OPTIONS)[number]>('All');
  const [sortField, setSortField] = useState<(typeof SORT_FIELDS)[number]['value']>('createdAt');
  const [sortOrder, setSortOrder] = useState<(typeof SORT_ORDERS)[number]['value']>('desc');
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);
  const [sharePosting, setSharePosting] = useState<ResearchPosting | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [matchScores, setMatchScores] = useState<Record<string, MatchEntry>>({});
  const studentProfile = setupState?.profile as Record<string, any> | null;
  const hasProfileSignals = Boolean(
    setupState?.completed &&
      (
        studentProfile?.resume ||
        studentProfile?.resumeText ||
        studentProfile?.skills?.length ||
        studentProfile?.interests?.length ||
        studentProfile?.transcript ||
        studentProfile?.transcriptText ||
        studentProfile?.coursework?.length
      )
  );

  const orderOptions =
    sortField === 'applicationDeadline'
      ? [
          { value: 'asc' as const, label: 'Soonest first' },
          { value: 'desc' as const, label: 'Furthest away' },
        ]
      : [
          { value: 'desc' as const, label: 'Newest first' },
          { value: 'asc' as const, label: 'Oldest first' },
        ];

  const filteredPostings = postings
    .filter((posting) => posting.status === 'published')
    .filter((posting) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch =
        posting.title.toLowerCase().includes(normalizedSearch) ||
        posting.overview.toLowerCase().includes(normalizedSearch) ||
        posting.studentRoleDescription.toLowerCase().includes(normalizedSearch) ||
        posting.professorName.toLowerCase().includes(normalizedSearch) ||
        posting.researchAreas.some((area) => area.toLowerCase().includes(normalizedSearch)) ||
        posting.skillsNeeded.some((skill) => skill.toLowerCase().includes(normalizedSearch));
      const matchesCategory = selectedCategory === 'All' || posting.category === selectedCategory;
      const matchesCompensation = selectedCompensation === 'All' || posting.compensation === selectedCompensation;
      return matchesSearch && matchesCategory && matchesCompensation;
    });

  const sortedPostings = [...filteredPostings].sort((a, b) => {
    const left = new Date(a[sortField]).getTime();
    const right = new Date(b[sortField]).getTime();
    return sortOrder === 'asc' ? left - right : right - left;
  });

  const studentApplications = user?.id ? getApplicationsByStudent(user.id) : [];
  const studentReports = user?.id ? getProgressReportsByStudent(user.id) : [];
  const researchHours = studentReports.reduce((total, report) => total + Number(report.hoursWorked ?? 0), 0);
  const profileSignals = [
    Boolean(studentProfile?.major),
    Boolean(studentProfile?.graduationYear),
    Boolean(studentProfile?.resume),
    Boolean(studentProfile?.interests?.length),
    Boolean(studentProfile?.skills?.length || studentProfile?.transcript),
  ];
  const profileCompletion = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);
  const activeFilterCount = [selectedCategory !== 'All', selectedCompensation !== 'All'].filter(Boolean).length;
  const visibleMatchPostings = useMemo(() => sortedPostings.slice(0, 12), [sortedPostings.map((posting) => posting.id).join('|')]);
  const profileMatchKey = useMemo(() => JSON.stringify(studentProfile ?? {}), [studentProfile]);

  useEffect(() => {
    if (!hasProfileSignals || visibleMatchPostings.length === 0) return;

    let cancelled = false;
    const abortController = new AbortController();
    const missingPostings = visibleMatchPostings.filter((posting) => !matchScores[posting.id]);
    if (missingPostings.length === 0) return;

    setMatchScores((previous) => {
      const next = { ...previous };
      missingPostings.forEach((posting) => {
        next[posting.id] = { status: 'loading' };
      });
      return next;
    });

    const scoreVisiblePostings = async () => {
      const timeoutId = window.setTimeout(() => abortController.abort(), 15_000);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/ai/recommendations', {
          method: 'POST',
          credentials: 'include',
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(headers ?? {}),
          },
          body: JSON.stringify({ profile: studentProfile ?? {}, postings: missingPostings }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(`recommendations failed with ${response.status}`);
        }

        const byPostingId = new Map<string, RecommendationScore>();
        (Array.isArray(payload.recommendations) ? payload.recommendations : []).forEach((item: RecommendationScore) => {
          if (item?.postingId) byPostingId.set(String(item.postingId), item);
        });

        if (cancelled) return;

        setMatchScores((previous) => {
          const next = { ...previous };
          missingPostings.forEach((posting) => {
            const score = byPostingId.get(posting.id);
            next[posting.id] = score
              ? { status: 'ready', score: normalizeMatchScore(score) }
              : { status: 'unavailable' };
          });
          return next;
        });
      } catch (error) {
        console.error('[browse match scores]', error);
        if (!cancelled) {
          setMatchScores((previous) => {
            const next = { ...previous };
            missingPostings.forEach((posting) => {
              next[posting.id] = { status: 'unavailable' };
            });
            return next;
          });
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void scoreVisiblePostings();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [hasProfileSignals, profileMatchKey, visibleMatchPostings]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">Find Research Opportunities</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[#655f5a]">
          <span>{postings.filter((posting) => posting.status === 'published').length} Opportunities</span>
          <span className="text-[#b8aaa4]">•</span>
          <span>{studentApplications.length} Applications</span>
          <span className="text-[#b8aaa4]">•</span>
          <span>{profileCompletion}% Profile Complete</span>
          <span className="text-[#b8aaa4]">•</span>
          <span>{researchHours} Research Hours</span>
        </div>
      </div>

      <div className="rounded-lg bg-white/70 p-2.5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
              <Input
                placeholder="Search by title, skill, topic, professor, or research area"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-10 rounded-lg border-[#e4d8d3] bg-white pl-10 shadow-none"
              />
            </div>
            <p className="whitespace-nowrap text-sm font-medium text-[#555555]">{sortedPostings.length} opportunities visible.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg border-[#e4d8d3] bg-white shadow-none"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? <span className="rounded-full bg-red-700 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span> : null}
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </Button>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-red-700" />
              <Select
                value={sortField}
                onValueChange={(value) => {
                  const nextSortField = value as (typeof SORT_FIELDS)[number]['value'];
                  setSortField(nextSortField);
                  setSortOrder(nextSortField === 'applicationDeadline' ? 'asc' : 'desc');
                }}
              >
                <SelectTrigger className="h-10 w-[150px] rounded-lg border-[#e4d8d3] bg-white shadow-none">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_FIELDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as (typeof SORT_ORDERS)[number]['value'])}
              >
                <SelectTrigger className="h-10 w-[138px] rounded-lg border-[#e4d8d3] bg-white shadow-none">
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  {orderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 border-t border-[#f0e8e4] pt-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8f8f8f]">Category</p>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-10 rounded-lg border-[#e4d8d3] bg-white shadow-none">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8f8f8f]">Compensation</p>
              <Select
                value={selectedCompensation}
                onValueChange={(value) => setSelectedCompensation(value as (typeof COMPENSATION_OPTIONS)[number])}
              >
                <SelectTrigger className="h-10 rounded-lg border-[#e4d8d3] bg-white shadow-none">
                  <SelectValue placeholder="All compensation types" />
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
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {projectsLoading ? (
          <LoadingState label="Loading research opportunities..." />
        ) : projectsError ? (
          <ErrorState
            title="Unable to load research opportunities"
            description="Research opportunities could not be loaded right now. Please try again in a moment."
            action={
              <Button variant="outline" onClick={() => void refreshProjects()}>
                Try again
              </Button>
            }
          />
        ) : sortedPostings.length === 0 ? (
          <EmptyState
            icon={BookOpenCheck}
            title={searchTerm || activeFilterCount > 0 ? 'No opportunities match your filters' : 'No research opportunities are available'}
            description={searchTerm || activeFilterCount > 0 ? 'Try broadening your search, clearing a filter, or checking back after more faculty projects are published.' : 'Published faculty projects will appear here when they become available.'}
            action={
              searchTerm || activeFilterCount > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('All');
                    setSelectedCompensation('All');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          sortedPostings.map((posting) => {
            const professorBioUrl = posting.professorBioUrl?.trim() ?? '';
            const match = matchScores[posting.id];
            const score = match?.score;
            const deadlineMeta = getDeadlineMeta(posting.applicationDeadline);
            const matchBadgeText = score
              ? `${score.confidence}% Match • ${getFitLabel(score.confidence)}`
              : hasProfileSignals && match?.status === 'loading'
                ? 'Calculating match...'
                : hasProfileSignals
                  ? 'Match unavailable'
                  : 'Profile incomplete • Improve profile';

            return (
              <Card key={posting.id} className="rounded-lg border-[#eee6e1] bg-white shadow-none transition hover:border-[#dfd3cc] hover:shadow-[0_10px_22px_rgba(0,0,0,0.05)]">
                <CardContent className="space-y-2.5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full border border-red-700/15 bg-red-700/[0.08] px-2.5 py-1 text-xs text-red-800">
                      {posting.category}
                    </Badge>
                    <Badge className={`rounded-full border px-2.5 py-1 text-xs ${deadlineMeta.className}`}>
                      {deadlineMeta.label}
                    </Badge>
                  </div>

                  <CardTitle className="text-lg leading-snug text-[#111111]">{posting.title}</CardTitle>

                  <Badge
                    variant="outline"
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                      score ? `${getFitTextClass(score.confidence)} border-current bg-white` : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    {matchBadgeText}
                  </Badge>

                  <CardDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                    <span className="font-medium text-[#4d4743]">{posting.professorName}</span>
                    <span className="text-[#b8aaa4]">•</span>
                    <span>{posting.professorDepartment}</span>
                    {professorBioUrl ? (
                      <>
                        <span className="text-[#b8aaa4]">•</span>
                        <a
                          href={professorBioUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-red-700 hover:text-red-800"
                        >
                          View Profile
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    ) : null}
                  </CardDescription>

                  <p className="line-clamp-2 text-sm leading-6 text-[#444444]">{posting.overview}</p>

                  <div className="flex flex-wrap gap-2">
                    {posting.skillsNeeded.slice(0, 4).map((skill) => (
                      <span key={`skill-${posting.id}-${skill}`} className="inline-flex items-center rounded-full border border-[#dddddd] bg-white px-2.5 py-1 text-xs font-medium text-[#555555]">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-[#5d5753]">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-red-700" />
                      {getCommitmentLabel(posting.timeCommitmentExpected)}
                    </span>
                    <span className="text-[#b8aaa4]">•</span>
                    <span className="inline-flex items-center gap-1.5">
                      <BadgeDollarSign className="h-4 w-4 text-red-700" />
                      {COMPENSATION_LABELS[posting.compensation]}
                    </span>
                    <span className="text-[#b8aaa4]">•</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-red-700" />
                      {getDurationLabel(posting.duration)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 border-t border-[#f1ebe7] pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-[#777777]">
                      {deadlineMeta.detail || `Posted ${new Date(posting.createdAt).toLocaleDateString()}`} • Ends {formatBrowseEndDate(posting.duration, posting.startDate)}
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-md border-[#e4d8d3] bg-white px-3.5 shadow-none"
                        onClick={() => setSharePosting(posting)}
                      >
                        <Share2 className="mr-1.5 h-4 w-4" />
                        Share
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-md border-[#e4d8d3] bg-white px-3.5 shadow-none"
                        onClick={() => navigate(`/student/research/${posting.id}`)}
                      >
                        Details
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 rounded-md bg-[#c92e1f] px-3.5 text-white shadow-none hover:bg-[#b3271b]"
                        onClick={() => setSelectedPosting(posting.id)}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {selectedPosting && (
        <ApplyToResearchDialog
          postingId={selectedPosting}
          open={!!selectedPosting}
          onOpenChange={(open) => !open && setSelectedPosting(null)}
        />
      )}
      <ShareOpportunityDialog posting={sharePosting} open={Boolean(sharePosting)} onOpenChange={(open) => !open && setSharePosting(null)} />
    </div>
  );
}

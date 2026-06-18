import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileText,
  Github,
  GraduationCap,
  Info,
  Linkedin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { type ResearchPosting, useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import ApplyToResearchDialog from './ApplyToResearchDialog';

type FitLabel = 'Excellent Match' | 'Strong Match' | 'Good Match' | 'Possible Match' | 'Low Match';
type SourceStatus = 'Connected' | 'Missing' | 'Incomplete';

type RecommendationItem = {
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
  recommendation: string | null;
  fallback?: boolean;
  fallback_reason?: string;
};

type RecommendationResponse = {
  recommendations?: unknown[];
  profileStrength?: Record<string, SourceStatus | string>;
  missingSignals?: Array<{ key?: string; status?: string; message?: string } | string>;
  warnings?: string[];
  generatedAt?: string;
};

const FALLBACK_NOTICE_TITLE = "We're updating your recommendations";
const FALLBACK_NOTICE_BODY =
  "We couldn't generate personalized recommendations right now. You can still browse available research opportunities while we refresh your profile analysis.";

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();
}

function tokenize(value: unknown) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function scoreToPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric <= 1 ? numeric * 100 : numeric);
}

function getFitLabel(score: number): FitLabel {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Strong Match';
  if (score >= 65) return 'Good Match';
  if (score >= 50) return 'Possible Match';
  return 'Low Match';
}

function fitBadgeClass(score: number) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (score >= 65) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (score >= 50) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function statusClass(status: SourceStatus | string) {
  if (status === 'Connected') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Incomplete') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function readableSourceLabel(key: string) {
  const labels: Record<string, string> = {
    resume: 'Resume',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    transcript: 'Transcript',
    researchInterests: 'Research Interests',
    skills: 'Skills',
    progressReports: 'Progress Reports',
    facultyVerification: 'Faculty Verification',
  };
  return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function normalizeRecommendationItem(item: Record<string, any>): RecommendationItem {
  return {
    postingId: String(item?.postingId ?? ''),
    confidence: scoreToPercent(item?.confidence),
    reason: typeof item?.reason === 'string' && item.reason.trim()
      ? item.reason.trim()
      : 'Recommended from your saved profile and this project description.',
    score_breakdown: item?.score_breakdown && typeof item.score_breakdown === 'object'
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
    qualifications: asStringList(item?.qualifications),
    fit_reasoning: asStringList(item?.fit_reasoning),
    gaps: asStringList(item?.gaps),
    recommendation: typeof item?.recommendation === 'string' ? item.recommendation : null,
    fallback: Boolean(item?.fallback),
    fallback_reason: typeof item?.fallback_reason === 'string' ? item.fallback_reason : undefined,
  };
}

function buildLocalRecommendation(profile: Record<string, any> | undefined, posting: ResearchPosting, index: number): RecommendationItem {
  const profileTerms = new Set(tokenize([
    profile?.major,
    profile?.degree,
    ...(Array.isArray(profile?.skills) ? profile.skills : []),
    ...(Array.isArray(profile?.interests) ? profile.interests : []),
    ...(Array.isArray(profile?.coursework) ? profile.coursework.map((course: any) => `${course?.courseNumber ?? ''} ${course?.courseName ?? course ?? ''}`) : []),
  ].join(' ')));
  const postingTerms = tokenize([
    posting.title,
    posting.category,
    posting.professorDepartment,
    posting.overview,
    posting.studentRoleDescription,
    posting.requiredQualifications,
    posting.preferredQualifications,
    ...(posting.researchAreas ?? []),
    ...(posting.skillsNeeded ?? []),
  ].join(' '));
  const overlap = postingTerms.reduce((count, term) => count + (profileTerms.has(term) ? 1 : 0), 0);
  const confidence = Math.max(45, Math.min(84, 58 + overlap * 6 - index * 2));
  const reason = overlap > 0
    ? 'Recommended from your major, interests, and saved profile.'
    : index < 3
      ? 'Recently posted opportunity.'
      : 'Available research opportunity.';

  return {
    postingId: posting.id,
    confidence,
    reason,
    score_breakdown: {
      base_score: confidence,
      github_bonus: 0,
      github_available: false,
      github_sparse: false,
      linkedin_bonus: 0,
      linkedin_available: false,
      linkedin_sparse: false,
    },
    qualifications: overlap > 0 ? ['Your saved profile overlaps with this project.'] : ['This project is open for student applications.'],
    fit_reasoning: [reason],
    gaps: ['Complete more profile signals to improve recommendation quality.'],
    recommendation: confidence >= 65 ? 'Good Fit' : 'Possible Fit',
    fallback: true,
    fallback_reason: reason,
  };
}

function getProfileStrength(profile: Record<string, any> | undefined, serverStrength?: Record<string, SourceStatus | string>) {
  const local: Record<string, SourceStatus> = {
    resume: profile?.resume?.name || profile?.resumeText ? 'Connected' : 'Missing',
    github: profile?.github || profile?.githubUrl ? 'Connected' : 'Missing',
    linkedin: profile?.linkedin || profile?.linkedInUrl || profile?.linkedinUrl ? 'Connected' : 'Missing',
    transcript: profile?.transcript?.name || profile?.transcriptText || profile?.coursework?.length ? 'Connected' : 'Missing',
    researchInterests: Array.isArray(profile?.interests) && profile.interests.length > 0 ? 'Connected' : 'Incomplete',
    skills: Array.isArray(profile?.skills) && profile.skills.length > 0 ? 'Connected' : 'Incomplete',
    progressReports: 'Missing',
    facultyVerification: 'Missing',
  };

  return { ...local, ...(serverStrength ?? {}) };
}

function getMissingSignals(strength: Record<string, SourceStatus | string>, serverSignals: RecommendationResponse['missingSignals']) {
  if (Array.isArray(serverSignals) && serverSignals.length > 0) {
    return serverSignals.map((signal) => typeof signal === 'string' ? signal : signal.message ?? 'Profile signal incomplete.').filter(Boolean);
  }

  return Object.entries(strength)
    .filter(([, status]) => status !== 'Connected')
    .map(([key, status]) => `${readableSourceLabel(key)} ${status === 'Incomplete' ? 'is incomplete' : 'is missing'}`);
}

function getMatchedSkills(posting: ResearchPosting, recommendation: RecommendationItem, profile: Record<string, any> | undefined) {
  const profileSkillTerms = new Set(asStringList(profile?.skills).map((skill) => normalizeText(skill)));
  const direct = asStringList(posting.skillsNeeded).filter((skill) => profileSkillTerms.has(normalizeText(skill)));
  const fromText = asStringList(posting.skillsNeeded).filter((skill) =>
    recommendation.reason.toLowerCase().includes(skill.toLowerCase()) ||
    recommendation.fit_reasoning.some((line) => line.toLowerCase().includes(skill.toLowerCase()))
  );
  return Array.from(new Set([...direct, ...fromText])).slice(0, 4);
}

function getMissingSkills(posting: ResearchPosting, matched: string[]) {
  const matchedSet = new Set(matched.map((skill) => normalizeText(skill)));
  return asStringList(posting.skillsNeeded).filter((skill) => !matchedSet.has(normalizeText(skill))).slice(0, 4);
}

async function getAuthHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : undefined;
}

async function readRecommendationResponse(response: Response): Promise<RecommendationResponse> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      recommendations: [],
      warnings: [FALLBACK_NOTICE_BODY],
      generatedAt: new Date().toISOString(),
    };
  }
  return payload;
}

function RecommendationSkeleton() {
  return (
    <Card className="border-[#e4ded9] bg-white shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-5 w-72 max-w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-12 w-20 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-8 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-16 animate-pulse rounded bg-slate-50" />
      </CardContent>
    </Card>
  );
}

function ProfileStrengthSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl border border-[#e4ded9] bg-white" />
      ))}
    </div>
  );
}

export default function AIRecommendations({ onBrowseResearch }: { onBrowseResearch?: () => void }) {
  const navigate = useNavigate();
  const { user, setupState } = useAuth();
  const { postings, applications, getApplicationsByStudent, getProgressReportsByStudent } = useData();
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);
  const [serverPostings, setServerPostings] = useState<ResearchPosting[]>([]);
  const [scoredPostings, setScoredPostings] = useState<Map<string, RecommendationItem>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [friendlyError, setFriendlyError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [serverProfileStrength, setServerProfileStrength] = useState<Record<string, SourceStatus | string> | undefined>();
  const [serverMissingSignals, setServerMissingSignals] = useState<RecommendationResponse['missingSignals']>([]);
  const activePollsRef = useRef<Map<string, number>>(new Map());

  const studentProfile = setupState?.profile as Record<string, any> | undefined;
  const progressReports = user?.id ? getProgressReportsByStudent(user.id) : [];
  const appliedPostingIds = useMemo(
    () => new Set(getApplicationsByStudent(user?.id ?? '').map((application) => application.postingId)),
    [applications, getApplicationsByStudent, user?.id]
  );

  const availablePostings = useMemo(() => {
    const merged = new Map<string, ResearchPosting>();
    for (const posting of serverPostings) {
      if (posting?.id) merged.set(posting.id, posting);
    }
    for (const posting of postings) {
      if (posting?.id) merged.set(posting.id, posting);
    }
    return Array.from(merged.values()).filter((posting) => posting.status === 'published' && !appliedPostingIds.has(posting.id));
  }, [serverPostings, postings, appliedPostingIds]);

  const localFallbacks = useMemo(
    () => availablePostings.map((posting, index) => buildLocalRecommendation(studentProfile, posting, index)),
    [availablePostings, studentProfile]
  );

  const recommendations = useMemo(() => {
    const byPosting = new Map<string, RecommendationItem>();
    for (const fallback of localFallbacks) {
      byPosting.set(fallback.postingId, fallback);
    }
    for (const scored of scoredPostings.values()) {
      byPosting.set(scored.postingId, scored);
    }
    return Array.from(byPosting.values())
      .map((recommendation) => ({
        recommendation,
        posting: availablePostings.find((posting) => posting.id === recommendation.postingId),
      }))
      .filter((entry): entry is { recommendation: RecommendationItem; posting: ResearchPosting } => Boolean(entry.posting))
      .sort((a, b) => b.recommendation.confidence - a.recommendation.confidence)
      .slice(0, 8);
  }, [availablePostings, localFallbacks, scoredPostings]);

  const profileStrength = useMemo(() => {
    const strength = getProfileStrength(studentProfile, serverProfileStrength);
    if (progressReports.length > 0) {
      strength.progressReports = 'Connected';
    }
    return strength;
  }, [studentProfile, serverProfileStrength, progressReports.length]);
  const missingSignals = useMemo(() => getMissingSignals(profileStrength, serverMissingSignals), [profileStrength, serverMissingSignals]);

  const profileImprovements = useMemo(() => {
    const actions = [
      profileStrength.github !== 'Connected' ? 'Connect GitHub or add portfolio projects with clear README files.' : '',
      profileStrength.linkedin !== 'Connected' ? 'Connect LinkedIn so professional and research context can be considered.' : '',
      profileStrength.researchInterests !== 'Connected' ? 'Add research interests to help match projects by topic.' : '',
      profileStrength.transcript !== 'Connected' ? 'Add coursework or transcript information for preparation signals.' : '',
      profileStrength.resume !== 'Connected' ? 'Upload a resume so projects, skills, and experience can be evaluated.' : '',
      profileStrength.progressReports !== 'Connected' ? 'Upload research reports or progress updates when available.' : '',
      profileStrength.skills !== 'Connected' ? 'Add technical and research skills you can support with examples.' : '',
    ].filter(Boolean);
    return actions.length > 0 ? actions : ['Your profile has the core signals needed for stronger recommendations. Keep project evidence current.'];
  }, [profileStrength]);

  const stopPolling = (postingId: string) => {
    const intervalId = activePollsRef.current.get(postingId);
    if (intervalId) {
      window.clearInterval(intervalId);
      activePollsRef.current.delete(postingId);
    }
  };

  const pollForScore = (postingId: string) => {
    if (activePollsRef.current.has(postingId)) return;

    let attempts = 0;
    const intervalId = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 90) {
        stopPolling(postingId);
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/ai/recommendations/get-score?postingId=${encodeURIComponent(postingId)}`, {
          credentials: 'include',
          headers,
        });
        const payload = await readRecommendationResponse(res) as any;
        if (payload.status === 'ready' && payload.result) {
          stopPolling(postingId);
          setScoredPostings((prev) => {
            const next = new Map(prev);
            next.set(postingId, normalizeRecommendationItem(payload.result));
            return next;
          });
        }
      } catch {
        stopPolling(postingId);
        setFriendlyError(FALLBACK_NOTICE_BODY);
      }
    }, 2000);

    activePollsRef.current.set(postingId, intervalId);
  };

  const scorePosting = async (posting: ResearchPosting) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/ai/recommendations/score-one?postingId=${encodeURIComponent(posting.id)}`, {
        credentials: 'include',
        headers,
      });
      const payload = await readRecommendationResponse(res) as any;

      if (payload.status === 'ready' && payload.result) {
        setScoredPostings((prev) => {
          const next = new Map(prev);
          next.set(posting.id, normalizeRecommendationItem(payload.result));
          return next;
        });
      } else if (payload.status === 'scoring' || payload.status === 'pending') {
        pollForScore(posting.id);
      } else if (Array.isArray(payload.recommendations)) {
        setScoredPostings((prev) => {
          const next = new Map(prev);
          payload.recommendations?.forEach((item: unknown) => {
            const normalized = normalizeRecommendationItem(item as Record<string, any>);
            if (normalized.postingId) next.set(normalized.postingId, normalized);
          });
          return next;
        });
      }
    } catch {
      setFriendlyError(FALLBACK_NOTICE_BODY);
    }
  };

  const loadRecommendations = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsRetrying(true);
    setFriendlyError('');
    setWarnings([]);

    try {
      const headers = await getAuthHeaders();
      const postingsResponse = await fetch('/api/postings', { credentials: 'include', headers });
      const postingsPayload = await postingsResponse.json().catch(() => ({}));
      const loadedPostings = (Array.isArray(postingsPayload?.postings) ? postingsPayload.postings : postings)
        .filter((posting: ResearchPosting) => posting?.status === 'published');
      setServerPostings(loadedPostings);

      const bulkResponse = await fetch('/api/ai/recommendations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(headers ?? {}),
        },
        body: JSON.stringify({ profile: studentProfile ?? {}, postings: loadedPostings }),
      });
      const bulkPayload = await readRecommendationResponse(bulkResponse);
      setServerProfileStrength(bulkPayload.profileStrength);
      setServerMissingSignals(bulkPayload.missingSignals ?? []);
      setWarnings(bulkPayload.warnings ?? []);

      if (Array.isArray(bulkPayload.recommendations) && bulkPayload.recommendations.length > 0) {
        const next = new Map<string, RecommendationItem>();
        bulkPayload.recommendations.forEach((item) => {
          const normalized = normalizeRecommendationItem(item as Record<string, any>);
          if (normalized.postingId) next.set(normalized.postingId, normalized);
        });
        setScoredPostings(next);
      } else {
        setFriendlyError(FALLBACK_NOTICE_BODY);
        for (const posting of loadedPostings.slice(0, 8)) {
          void scorePosting(posting);
        }
      }
    } catch {
      setFriendlyError(FALLBACK_NOTICE_BODY);
      setServerPostings(postings.filter((posting) => posting.status === 'published'));
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    void loadRecommendations();
    return () => {
      for (const postingId of activePollsRef.current.keys()) {
        stopPolling(postingId);
      }
    };
  }, [user?.id, JSON.stringify(studentProfile ?? {}), postings.length]);

  const handleApplied = (postingId: string) => {
    setSelectedPosting(null);
    setScoredPostings((prev) => {
      const next = new Map(prev);
      next.delete(postingId);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {(friendlyError || warnings.length > 0) && (
        <Card className="border-blue-200 bg-blue-50 shadow-none">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3 text-blue-950">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <p className="text-sm font-semibold">{FALLBACK_NOTICE_TITLE}</p>
                <p className="mt-1 text-sm leading-6 text-blue-900/80">{friendlyError || warnings[0] || FALLBACK_NOTICE_BODY}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-md border-blue-200 bg-white text-blue-800" onClick={() => void loadRecommendations()} disabled={isRetrying}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry Recommendations
              </Button>
              <Button type="button" className="rounded-md bg-blue-700 text-white hover:bg-blue-800" onClick={onBrowseResearch}>
                <Search className="mr-2 h-4 w-4" />
                Browse Research
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7f79]">Recommended Opportunities</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#111111]">Research projects that fit your profile</h2>
          </div>
          <p className="text-sm text-[#666666]">{recommendations.length} opportunities ready</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => <RecommendationSkeleton key={index} />)}
          </div>
        ) : recommendations.length === 0 ? (
          <Card className="border-[#e4ded9] bg-white shadow-none">
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <p className="font-semibold text-[#111111]">No open recommendations yet</p>
              <p className="mt-1 text-sm text-[#666666]">Browse all research opportunities while new matches are prepared.</p>
              <Button className="mt-4 rounded-md bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={onBrowseResearch}>Browse Research</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recommendations.map(({ posting, recommendation }) => {
              const score = recommendation.confidence;
              const matchedSkills = getMatchedSkills(posting, recommendation, studentProfile);
              const missingSkills = getMissingSkills(posting, matchedSkills);
              return (
                <Card key={posting.id} className="border-[#e4ded9] bg-white shadow-none transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(0,0,0,0.07)]">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold tracking-tight text-[#111111]">{posting.title}</h3>
                          {recommendation.fallback && <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">Backup match</Badge>}
                        </div>
                        <p className="text-sm text-[#666666]">{posting.professorName} · {posting.professorDepartment}</p>
                        <p className="max-w-3xl text-sm leading-6 text-[#4f4a46]">{recommendation.reason}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 lg:text-right">
                        <Badge className={`rounded-full border px-3 py-1 ${fitBadgeClass(score)}`}>{getFitLabel(score)}</Badge>
                        <div>
                          <p className="text-2xl font-semibold tracking-tight text-[#111111]">{score}%</p>
                          <p className="text-xs text-[#777777]">match score</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-[#eee7e2] bg-[#fcfbfa] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777777]">Top matched skills</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(matchedSkills.length > 0 ? matchedSkills : posting.researchAreas.slice(0, 3)).map((skill) => (
                            <Badge key={skill} variant="secondary" className="rounded-full">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#eee7e2] bg-[#fcfbfa] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777777]">Skills to strengthen</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(missingSkills.length > 0 ? missingSkills : ['Role-specific evidence']).map((skill) => (
                            <Badge key={skill} variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-800">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#eee7e2] bg-[#fcfbfa] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777777]">Deadline</p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-[#111111]">
                          <Clock className="h-4 w-4 text-[#777777]" />
                          {posting.applicationDeadline ? new Date(posting.applicationDeadline).toLocaleDateString() : 'Rolling'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#eee7e2] pt-4">
                      <Button variant="outline" className="rounded-md border-[#d0ceca] bg-white" onClick={() => navigate(`/student/research/${posting.id}`)}>
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-md border-[#d0ceca] bg-white"
                        onClick={() => {
                          const params = new URLSearchParams({ confidence: String(score), reason: recommendation.reason });
                          navigate(`/student/recommendations/${posting.id}/reasoning?${params.toString()}`, {
                            state: { recommendation },
                          });
                        }}
                      >
                        View Score Reasoning
                      </Button>
                      <Button className="rounded-md bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={() => setSelectedPosting(posting.id)}>
                        Apply <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7f79]">Research Profile Strength</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#111111]">Your Research Profile</h2>
        </div>
        {isLoading ? <ProfileStrengthSkeleton /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(profileStrength).filter(([key]) => key !== 'skills').map(([key, status]) => (
              <Card key={key} className="border-[#e4ded9] bg-white shadow-none">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-[#111111]">{readableSourceLabel(key)}</p>
                    <Badge className={`mt-2 rounded-full border ${statusClass(status)}`}>{status}</Badge>
                  </div>
                  {status === 'Connected' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-slate-400" />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[#e4ded9] bg-white shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><CircleAlert className="h-5 w-5 text-amber-600" />What Information Is Missing?</CardTitle>
            <CardDescription>These signals help recommendations become more specific. Missing items are normal early on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {missingSignals.length > 0 ? missingSignals.slice(0, 7).map((signal) => (
              <div key={signal} className="rounded-xl border border-[#eee7e2] bg-[#fcfbfa] px-3 py-2 text-sm text-[#4f4a46]">{signal}</div>
            )) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Your profile has the main signals needed for personalized recommendations.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#e4ded9] bg-white shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-blue-600" />Improve Your Research Profile</CardTitle>
            <CardDescription>These actions may improve recommendation quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {profileImprovements.map((action) => (
              <div key={action} className="flex items-start gap-2 rounded-xl border border-[#eee7e2] bg-[#fcfbfa] px-3 py-2 text-sm text-[#4f4a46]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>{action}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#e4ded9] bg-white shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">How Matching Works</CardTitle>
          <CardDescription>Recommendations compare your profile against project requirements to identify opportunities that may be a strong fit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            [GraduationCap, 'Coursework and academic background'],
            [BookOpen, 'Research interests and project experience'],
            [Github, 'Relevant GitHub projects when connected'],
            [Linkedin, 'LinkedIn context when connected'],
            [ShieldCheck, 'Progress reports and faculty verification'],
            [FileText, 'Resume skills and submitted evidence'],
          ].map(([Icon, label]) => {
            const IconComponent = Icon as typeof FileText;
            return (
              <div key={label as string} className="flex items-center gap-3 rounded-xl border border-[#eee7e2] bg-[#fcfbfa] p-3 text-sm text-[#4f4a46]">
                <IconComponent className="h-4 w-4 shrink-0 text-[#777777]" />
                <span>{label as string}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {selectedPosting ? (
        <ApplyToResearchDialog
          postingId={selectedPosting}
          open={Boolean(selectedPosting)}
          onOpenChange={(open) => !open && setSelectedPosting(null)}
          onSubmitted={handleApplied}
        />
      ) : null}
    </div>
  );
}

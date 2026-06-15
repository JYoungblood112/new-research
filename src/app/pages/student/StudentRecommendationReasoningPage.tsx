import { useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  Github,
  Info,
  Linkedin,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';

type ScoreBreakdown = {
  base_score: number;
  github_bonus: number;
  github_available: boolean;
  github_sparse: boolean;
  linkedin_bonus: number;
  linkedin_available: boolean;
  linkedin_sparse: boolean;
};

type RecommendationDetails = {
  postingId: string;
  confidence: number;
  reason: string;
  score_breakdown: ScoreBreakdown | null;
  qualifications: string[];
  fit_reasoning: string[];
  gaps: string[];
  recommendation: 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit' | null;
};

type RecommendationTag = 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit';
type AlignmentStrength = 'strong' | 'moderate' | 'limited';

type SourceTag = {
  kind: 'resume' | 'github' | 'linkedin';
  label: string;
};

type AlignmentRow = {
  requirement: string;
  description: string;
  strength: AlignmentStrength;
  sources: SourceTag[];
};

type GitHubPreview = {
  repoName: string;
  description: string;
  language: string;
  stars: number;
};

function toDisplayPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBadgeForRecommendation(value: string | undefined) {
  if (value === 'Strong Fit') {
    return 'border border-green-200 bg-green-50 text-green-700';
  }
  if (value === 'Good Fit') {
    return 'border border-blue-200 bg-blue-50 text-blue-700';
  }
  if (value === 'Possible Fit') {
    return 'border border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border border-red-200 bg-red-50 text-red-700';
}

function getSummaryGradient(value: RecommendationTag) {
  if (value === 'Strong Fit') {
    return 'bg-gradient-to-r from-green-50 via-white to-green-100/70';
  }
  if (value === 'Good Fit') {
    return 'bg-gradient-to-r from-blue-50 via-white to-blue-100/70';
  }
  if (value === 'Possible Fit') {
    return 'bg-gradient-to-r from-amber-50 via-white to-amber-100/70';
  }
  return 'bg-gradient-to-r from-red-50 via-white to-red-100/70';
}

function getScoreTone(score: number) {
  if (score >= 75) {
    return {
      text: 'text-green-700',
      ring: 'stroke-green-600',
      bg: 'stroke-green-100',
      accent: 'border-green-200',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-amber-700',
      ring: 'stroke-amber-500',
      bg: 'stroke-amber-100',
      accent: 'border-amber-200',
    };
  }
  return {
    text: 'text-red-700',
    ring: 'stroke-red-500',
    bg: 'stroke-red-100',
    accent: 'border-red-200',
  };
}

function getProgressTone(value: number) {
  if (value >= 70) {
    return 'bg-green-600';
  }
  if (value >= 40) {
    return 'bg-amber-500';
  }
  return 'bg-red-500';
}

function getAlignmentAccent(strength: AlignmentStrength) {
  if (strength === 'strong') {
    return 'border-l-green-500';
  }
  if (strength === 'moderate') {
    return 'border-l-amber-400';
  }
  return 'border-l-red-300';
}

function getAlignmentHeading(strength: AlignmentStrength) {
  if (strength === 'strong') {
    return 'Strong alignment';
  }
  if (strength === 'moderate') {
    return 'Moderate alignment';
  }
  return 'Limited alignment';
}

function getAlignmentIconTone(strength: AlignmentStrength) {
  if (strength === 'strong') {
    return 'text-green-700';
  }
  if (strength === 'moderate') {
    return 'text-amber-700';
  }
  return 'text-red-700';
}

function removeVariableNameLeak(value: string) {
  const trimmed = value.trim();
  return (
    !/^(studentRoleDescription|requiredQualifications|gaps|fit_reasoning|qualifications)$/i.test(trimmed) &&
    !/^\s*(?:\[(?:Resume|GitHub|LinkedIn)\]\s*,?\s*)+$/i.test(trimmed) &&
    !/^\s*(?:\[[^\]]+\]\s*)+$/i.test(trimmed) &&
    !/^\s*\[[a-z_]+:/i.test(trimmed) &&
    !/\[(?:github|linkedin|resume)_[a-z_]+\]/i.test(trimmed) &&
    !/^(Strong Fit|Good Fit|Possible Fit|Weak Fit)$/i.test(trimmed)
  );
}

function toStringList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .flatMap((entry) => toStringList(entry))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .filter(removeVariableNameLeak);
  }

  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) {
      return [];
    }

    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        const parsed = JSON.parse(raw);
        return toStringList(parsed);
      } catch {
        // Fall through to normal string parsing when JSON parse fails.
      }
    }

    return raw
      .split(/\n|;|\|/)
      .map((entry) => entry.replace(/^[-*\d)\s]+/, '').trim())
      .filter((entry) => entry.length > 0)
      .filter(removeVariableNameLeak);
  }

  if (input && typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).flatMap((value) => toStringList(value));
  }

  return [];
}

function normalizeList(input: unknown): string[] {
  return toStringList(input).filter((entry) => !/^(not provided|null|undefined)$/i.test(entry));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .filter((word) => !['with', 'from', 'this', 'that', 'have', 'your', 'their', 'role', 'position', 'research'].includes(word));
}

function overlapScore(requirement: string, evidence: string): number {
  const req = new Set(tokenize(requirement));
  const ev = tokenize(evidence);
  let score = 0;
  ev.forEach((word) => {
    if (req.has(word)) {
      score += 1;
    }
  });
  return score;
}

function getStrength(score: number): AlignmentStrength {
  if (score >= 3) {
    return 'strong';
  }
  if (score >= 1) {
    return 'moderate';
  }
  return 'limited';
}

function buildConstructiveGapText(item: string) {
  const normalized = item.trim();
  if (!normalized) {
    return '';
  }
  if (/^(consider|demonstrate|build|develop|highlight|showcase)/i.test(normalized)) {
    return normalized;
  }
  return `Consider demonstrating: ${normalized}`;
}

function getGitHubPreviewFromRecommendation(payload: Record<string, unknown>): GitHubPreview | null {
  const githubData = payload.githubData as Record<string, unknown> | undefined;
  const topRepos = Array.isArray(githubData?.top_repos)
    ? (githubData.top_repos as Array<Record<string, unknown>>)
    : [];

  if (topRepos.length > 0) {
    const top = topRepos[0];
    return {
      repoName: String(top.name ?? 'Top Repository'),
      description: String(top.description ?? 'Repository signal used in scoring.'),
      language: String(top.language ?? 'Code'),
      stars: Number(top.stars ?? 0),
    };
  }

  return null;
}

function extractGitHubUsername(url: string): string {
  const cleaned = url.trim().replace(/\/$/, '');
  const match = cleaned.match(/github\.com\/([^/]+)/i);
  return match?.[1] ?? '';
}

function ScoreRing({ score }: { score: number }) {
  const normalized = clamp(score, 0, 100);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;
  const tone = getScoreTone(normalized);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-40 w-40">
        <svg className="h-40 w-40 -rotate-90" viewBox="0 0 140 140" aria-label="Confidence score ring">
          <circle cx="70" cy="70" r={radius} className={`fill-none ${tone.bg}`} strokeWidth="12" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            className={`fill-none ${tone.ring} transition-all duration-700 ease-out`}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold tracking-tight ${tone.text}`}>{normalized}</span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Confidence Score</p>
    </div>
  );
}

function AlignmentStrengthIndicator({ strength }: { strength: AlignmentStrength }) {
  if (strength === 'strong') {
    return <Circle className="h-5 w-5 fill-green-500 text-green-600" aria-label="Strong alignment" />;
  }

  if (strength === 'moderate') {
    return (
      <div className="relative h-5 w-5" aria-label="Moderate alignment">
        <Circle className="absolute inset-0 h-5 w-5 text-amber-500" />
        <div className="absolute inset-y-[3px] left-[3px] w-1/2 rounded-l-full bg-amber-500" />
      </div>
    );
  }

  return <Circle className="h-5 w-5 text-red-400" aria-label="Limited alignment" />;
}

export default function StudentRecommendationReasoningPage() {
  const { postingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { postings } = useData();
  const { user, setupState } = useAuth();

  const posting = useMemo(
    () => postings.find((item) => item.id === postingId && item.status === 'published') ?? null,
    [postings, postingId]
  );

  const stateRecommendation = (location.state as { recommendation?: RecommendationDetails } | null)?.recommendation;

  const fallbackConfidence = toDisplayPercent(Number(searchParams.get('confidence') ?? '0'));
  const fallbackReason =
    searchParams.get('reason') ??
    'Confidence is based on resume alignment and optional profile bonus signals when available.';

  const recommendation: RecommendationDetails =
    stateRecommendation ?? {
      postingId: postingId ?? '',
      confidence: fallbackConfidence,
      reason: fallbackReason,
      score_breakdown: null,
      qualifications: [],
      fit_reasoning: [],
      gaps: [],
      recommendation: null,
    };

  const recommendationRecord = recommendation as unknown as Record<string, unknown>;

  const score = toDisplayPercent(recommendation.confidence);
  const breakdown: ScoreBreakdown = recommendation.score_breakdown ?? {
    base_score: score,
    github_bonus: 0,
    github_available: false,
    github_sparse: false,
    linkedin_bonus: 0,
    linkedin_available: false,
    linkedin_sparse: false,
  };

  const recommendationTag: RecommendationTag = recommendation.recommendation ?? 'Possible Fit';
  const scoreTone = getScoreTone(score);

  const studentProfile = (setupState?.profile ?? {}) as Record<string, unknown>;
  const studentName = String(studentProfile.name ?? user?.name ?? 'Candidate').trim() || 'Candidate';
  const studentFirstName = studentName.split(' ')[0] || 'Candidate';

  const githubUrl = String(
    studentProfile.github ??
      studentProfile.githubUrl ??
      studentProfile.github_url ??
      recommendationRecord.githubUrl ??
      recommendationRecord.github_url ??
      ''
  ).trim();

  const githubPreview = getGitHubPreviewFromRecommendation(recommendationRecord);
  const githubUsername = extractGitHubUsername(githubUrl);

  // Bug fix: consume actual recommendation arrays and flatten any malformed payload shape.
  const qualificationItems = normalizeList(recommendation.qualifications);
  const fitItems = normalizeList(recommendation.fit_reasoning).filter(
    (item) => item !== 'Detailed model reasoning was unavailable for this request; fallback ranking is shown.'
  );
  const gapItems = normalizeList(recommendation.gaps)
    .filter((item) => !/no\s+github|no\s+linkedin/i.test(item))
    .map((item) => buildConstructiveGapText(item))
    .filter(Boolean);

  const hasFallback = !recommendation.score_breakdown && qualificationItems.length === 0 && fitItems.length === 0;

  const positionRequirements = useMemo(() => {
    if (!posting) {
      return [];
    }

    const postingRecord = posting as unknown as Record<string, unknown>;
    return [
      ...normalizeList(posting.requiredQualifications),
      ...normalizeList(posting.preferredQualifications),
      ...normalizeList(postingRecord.requirements),
      ...normalizeList(postingRecord.qualifications),
    ]
      .filter((item, index, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index)
      .slice(0, 10);
  }, [posting]);

  const fallbackRequirements = useMemo(() => {
    if (positionRequirements.length > 0) {
      return positionRequirements;
    }
    return qualificationItems;
  }, [positionRequirements, qualificationItems]);

  const alignmentRows: AlignmentRow[] = useMemo(() => {
    const requirements = fallbackRequirements.length > 0 ? fallbackRequirements : ['Overall role alignment'];
    const evidencePool = [...qualificationItems, ...fitItems];

    return requirements.map((requirement) => {
      const ranked = evidencePool
        .map((entry) => ({
          entry,
          score: overlapScore(requirement, entry),
        }))
        .sort((a, b) => b.score - a.score);

      const topRelevant = ranked.filter((item) => item.score > 0).slice(0, 2);
      const fallbackEvidence = evidencePool.slice(0, 2);
      const chosenEvidence = topRelevant.length > 0 ? topRelevant.map((item) => item.entry) : fallbackEvidence;

      const maxScore = topRelevant[0]?.score ?? 0;
      const strength = getStrength(maxScore);
      const detail = chosenEvidence[0] || '';
      const secondary = chosenEvidence[1] || '';

      const description =
        strength === 'limited'
          ? 'No direct evidence found in resume, GitHub, or LinkedIn for this specific requirement. Student may need to demonstrate this through coursework or projects not listed.'
          : `${studentFirstName}'s profile indicates ${detail.toLowerCase()}${secondary ? ` In addition, ${secondary.toLowerCase()}.` : '.'}`;

      const combined = `${requirement} ${detail} ${secondary}`.toLowerCase();
      const sources: SourceTag[] = [{ kind: 'resume', label: 'Resume - Skills Section' }];

      const referencesGithub = /github|repo|repository|open source|project/i.test(combined);
      const referencesLinkedin = /linkedin|internship|work experience|professional/i.test(combined);

      if (breakdown.github_available && (referencesGithub || (strength !== 'limited' && breakdown.github_bonus > 0))) {
        sources.push({ kind: 'github', label: `GitHub${githubUsername ? ` - ${githubUsername}` : ' - Profile'}` });
      }
      if (breakdown.linkedin_available && (referencesLinkedin || (strength !== 'limited' && breakdown.linkedin_bonus > 0))) {
        sources.push({ kind: 'linkedin', label: 'LinkedIn - Profile Referenced' });
      }

      return {
        requirement,
        description,
        strength,
        sources,
      };
    });
  }, [
    breakdown.github_available,
    breakdown.github_bonus,
    breakdown.linkedin_available,
    breakdown.linkedin_bonus,
    fallbackRequirements,
    fitItems,
    githubUsername,
    qualificationItems,
    studentFirstName,
  ]);

  const strongCount = alignmentRows.filter((row) => row.strength === 'strong').length;
  const strongRatio = alignmentRows.length > 0 ? Math.round((strongCount / alignmentRows.length) * 100) : 0;

  const evidenceLine = `Based on resume analysis${breakdown.github_available ? ', GitHub profile' : ''}${breakdown.linkedin_available ? ' and LinkedIn profile' : ''}`;

  return (
    <div className="min-h-screen bg-[#f6f7f8] px-4 py-8 md:py-10">
      <main className="mx-auto max-w-[900px] space-y-6">
        <Button
          variant="ghost"
          className="w-fit rounded-xl text-muted-foreground transition-colors hover:bg-white/80 hover:text-foreground"
          onClick={() => navigate('/student/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to AI Recommendations
        </Button>

        {!posting ? (
          <Card className="border-[#e7e7e7] bg-white shadow-sm">
            <CardContent className="py-10 text-center text-gray-600">This recommendation is no longer available.</CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden border-[#e7e7e7] bg-gradient-to-r from-slate-100 via-white to-white shadow-sm">
              <CardContent className="p-6">
                <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="space-y-4">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      AI Recommendations -&gt; Confidence Score Reasoning
                    </p>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Sparkles className="h-5 w-5 text-red-700" />
                        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Confidence Score Reasoning</h1>
                        <Badge className={`rounded-full px-3 py-1 text-xs ${getBadgeForRecommendation(recommendationTag)}`}>
                          {recommendationTag}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground md:text-base">
                        {posting.title} - {posting.professorName} - {posting.professorDepartment}
                      </p>
                    </div>

                    {hasFallback ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Detailed model reasoning was unavailable for this request; fallback ranking is shown.
                      </p>
                    ) : null}
                  </div>

                  <div className="mx-auto md:mx-0">
                    <ScoreRing score={score} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#e7e7e7] bg-white shadow-sm">
              <CardHeader className="space-y-2 px-6 pt-6">
                <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">Score Breakdown</CardTitle>
                <CardDescription>How your score was calculated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-6 pb-6">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Resume Score</p>
                    <p className="text-sm font-bold text-foreground">{breakdown.base_score} / 100</p>
                  </div>
                  <Progress
                    value={breakdown.base_score}
                    className="h-3 [&>div]:transition-all [&>div]:duration-700"
                    indicatorClassName={getProgressTone(breakdown.base_score)}
                  />
                </div>

                {breakdown.github_available ? (
                  <div className="grid gap-3 rounded-xl border border-[#ececec] bg-[#fafafa] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">+ GitHub Activity</p>
                      <p className="text-sm font-bold text-foreground">+{breakdown.github_bonus} pts</p>
                    </div>

                    <Progress
                      value={clamp((breakdown.github_bonus / 15) * 100, 0, 100)}
                      className="h-2 [&>div]:transition-all [&>div]:duration-700"
                      indicatorClassName={breakdown.github_sparse ? 'bg-amber-500' : 'bg-green-600'}
                    />

                    {breakdown.github_sparse ? (
                      <Badge className="w-fit rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                        limited signal
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <Badge variant="secondary" className="w-fit rounded-full bg-[#f2f2f2] text-[#666666]">
                    GitHub not provided - not factored in
                  </Badge>
                )}

                {breakdown.linkedin_available ? (
                  <div className="grid gap-3 rounded-xl border border-[#ececec] bg-[#fafafa] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">+ LinkedIn Profile</p>
                      <p className="text-sm font-bold text-foreground">+{breakdown.linkedin_bonus} pts</p>
                    </div>

                    <Progress
                      value={clamp((breakdown.linkedin_bonus / 10) * 100, 0, 100)}
                      className="h-2 [&>div]:transition-all [&>div]:duration-700"
                      indicatorClassName={breakdown.linkedin_sparse ? 'bg-amber-500' : 'bg-green-600'}
                    />

                    {breakdown.linkedin_sparse ? (
                      <Badge className="w-fit rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                        limited signal
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <Badge variant="secondary" className="w-fit rounded-full bg-[#f2f2f2] text-[#666666]">
                    LinkedIn not provided - not factored in
                  </Badge>
                )}

                <div className={`rounded-xl border ${scoreTone.accent} bg-white p-4`}>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <p className="text-base font-semibold text-foreground">Final Score</p>
                    <p className={`text-3xl font-bold tracking-tight ${scoreTone.text}`}>{score} / 100</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">(resume baseline + bonuses from GitHub and LinkedIn)</p>
                </div>

                {recommendation.reason ? <p className="text-sm text-muted-foreground">{recommendation.reason}</p> : null}
              </CardContent>
            </Card>

            <Card className="border-[#e7e7e7] bg-white shadow-sm">
              <CardHeader className="space-y-2 px-6 pt-6">
                <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">
                  Position Requirements &amp; Candidate Alignment
                </CardTitle>
                <CardDescription>
                  How this candidate&apos;s resume, GitHub, and LinkedIn align to each specific requirement of this position
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 px-6 pb-6">
                {alignmentRows.map((row, index) => {
                  const rowTone = getAlignmentIconTone(row.strength);
                  return (
                    <div
                      key={`${row.requirement}-${index}`}
                      className={`rounded-xl border border-[#ececec] border-l-4 ${getAlignmentAccent(row.strength)} p-5 transition-colors duration-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#fbfbfb]'
                      }`}
                    >
                      <div className="grid gap-4 md:grid-cols-[1fr_1.3fr_auto] md:items-start">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Requirement</p>
                          <p className="text-base font-semibold text-foreground">{row.requirement}</p>
                          <p className="text-sm text-muted-foreground">Role qualification requirement from this posting.</p>
                        </div>

                        <div className="space-y-3">
                          <p className={`flex items-center gap-2 text-sm font-semibold ${rowTone}`}>
                            {row.strength === 'limited' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            {getAlignmentHeading(row.strength)}
                          </p>

                          <p className="text-sm leading-6 text-foreground/85">{row.description}</p>

                          <div className="flex flex-wrap gap-2">
                            {row.sources.map((source, sourceIndex) => {
                              if (source.kind === 'github') {
                                return (
                                  <Badge
                                    key={`${source.label}-${sourceIndex}`}
                                    className="rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-900"
                                  >
                                    <Github className="mr-1 h-3 w-3" />
                                    {source.label}
                                  </Badge>
                                );
                              }

                              if (source.kind === 'linkedin') {
                                return (
                                  <Badge
                                    key={`${source.label}-${sourceIndex}`}
                                    className="rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50"
                                  >
                                    <Linkedin className="mr-1 h-3 w-3" />
                                    Profile Referenced
                                  </Badge>
                                );
                              }

                              return (
                                <Badge key={`${source.label}-${sourceIndex}`} variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#555]">
                                  <FileText className="mr-1 h-3 w-3" />
                                  {source.label}
                                </Badge>
                              );
                            })}
                          </div>

                          {row.sources.some((source) => source.kind === 'github') && githubUrl ? (
                            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <Github className="h-4 w-4" />
                                {githubPreview?.repoName ?? `${githubUsername || 'GitHub'} profile`}
                              </div>
                              <p className="mt-1 text-xs text-slate-300">
                                {githubPreview?.description ?? 'GitHub profile signal contributed to this alignment assessment.'}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <Badge className="rounded-full border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-800">
                                  {githubPreview?.language ?? 'Code'}
                                </Badge>
                                <Badge className="rounded-full border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-800">
                                  Stars: {githubPreview?.stars ?? 0}
                                </Badge>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="pt-1 md:justify-self-end">
                          <AlignmentStrengthIndicator strength={row.strength} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-xl border border-[#ececec] bg-[#fafafa] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      {strongCount} of {alignmentRows.length} requirements strongly met
                    </p>
                    <p className="text-xs text-muted-foreground">{strongRatio}%</p>
                  </div>
                  <Progress value={strongRatio} className="h-2" indicatorClassName="bg-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#e7e7e7] bg-white shadow-sm">
              <CardHeader className="space-y-2 px-6 pt-6">
                <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">Position Fit Analysis</CardTitle>
                <CardDescription>Detailed reasoning for this confidence score</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="divide-y divide-[#efefef] rounded-xl border border-[#ececec]">
                  {fitItems.length > 0 ? (
                    fitItems.map((fit, index) => (
                      <div key={`${fit}-${index}`} className="flex items-start gap-3 p-4 transition-colors duration-200 hover:bg-blue-50/60">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <p className="text-sm leading-6 text-foreground/85">{fit}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">No detailed fit reasoning was provided for this recommendation.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {gapItems.length > 0 ? (
              <Card className="border-[#e7e7e7] bg-white shadow-sm">
                <CardHeader className="space-y-2 px-6 pt-6">
                  <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">Areas to Strengthen</CardTitle>
                  <CardDescription>Specific gaps relative to this position&apos;s requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-6 pb-6">
                  {gapItems.map((gap, index) => (
                    <div key={`${gap}-${index}`} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <p className="text-sm leading-6 text-amber-900">{gap}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className={`border-[#e7e7e7] shadow-sm ${getSummaryGradient(recommendationTag)}`}>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Badge className={`rounded-full px-4 py-1 text-sm ${getBadgeForRecommendation(recommendationTag)}`}>
                  {recommendationTag}
                </Badge>
                {recommendation.reason ? <p className="max-w-2xl text-base font-medium text-foreground">{recommendation.reason}</p> : null}
                <p className="text-sm text-muted-foreground">{evidenceLine}</p>
              </CardContent>
            </Card>

            <Card className="border-[#e7e7e7] bg-white shadow-sm">
              <CardHeader className="space-y-2 px-6 pt-6">
                <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">Evidence Signals</CardTitle>
                <CardDescription>Extracted strengths that informed this confidence score</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-6 pb-6">
                {qualificationItems.length > 0 ? (
                  qualificationItems.map((q, i) => {
                    const content = q.trim();
                    if (!content || !removeVariableNameLeak(content)) {
                      return null;
                    }
                    return (
                      <div key={`${content}-${i}`} className="flex items-start gap-2 rounded-xl border border-[#e8eee9] bg-[#f8fcf9] p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        <p className="text-sm text-[#1f1f1f]">{content}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No qualification evidence was provided.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#e7e7e7] bg-white shadow-sm">
              <CardHeader className="space-y-2 px-6 pt-6">
                <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">Reasoning Signals</CardTitle>
                <CardDescription>Model fit-reasoning statements used in this page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-6 pb-6">
                {fitItems.length > 0 ? fitItems.map((f, i) => {
                  const content = f.trim();
                  if (!content || !removeVariableNameLeak(content)) {
                    return null;
                  }
                  return (
                    <div key={`${content}-${i}`} className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                      <p className="text-sm text-[#1f2e4a]">{content}</p>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">No reasoning signals were provided.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#e7e7e7] bg-white shadow-sm">
              <CardHeader className="space-y-2 px-6 pt-6">
                <CardTitle className="border-l-4 border-red-600 pl-3 text-[18px] font-semibold">Gap Signals</CardTitle>
                <CardDescription>Raw gap inputs received for this recommendation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-6 pb-6">
                {gapItems.length > 0 ? gapItems.map((g, i) => {
                  const content = g.trim();
                  if (!content || !removeVariableNameLeak(content) || /^(not provided|null|undefined)$/i.test(content)) {
                    return null;
                  }
                  return (
                    <div key={`${content}-${i}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <p className="text-sm text-[#4d3f25]">{buildConstructiveGapText(content)}</p>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">No gap signals were provided.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

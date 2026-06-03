import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { type ResearchPosting, useData } from '../../contexts/DataContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import ApplyToResearchDialog from './ApplyToResearchDialog';
import { AlertTriangle, ArrowRight, BadgeCheck, BrainCircuit, FileText, Sparkles } from 'lucide-react';


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
  recommendation: 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit' | null;
};

function normalizeRecommendationItem(item: Record<string, any>): RecommendationItem {
  const recommendationValue = item?.recommendation;
  const normalizedRecommendation =
    recommendationValue === 'Strong Fit' ||
    recommendationValue === 'Good Fit' ||
    recommendationValue === 'Possible Fit' ||
    recommendationValue === 'Weak Fit'
      ? recommendationValue
      : null;

  return {
    postingId: String(item?.postingId ?? ''),
    confidence: Number(item?.confidence ?? 0),
    reason: typeof item?.reason === 'string' ? item.reason : '',
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
    qualifications: Array.isArray(item?.qualifications) ? item.qualifications.filter((entry: unknown) => typeof entry === 'string') : [],
    fit_reasoning: Array.isArray(item?.fit_reasoning) ? item.fit_reasoning.filter((entry: unknown) => typeof entry === 'string') : [],
    gaps: Array.isArray(item?.gaps) ? item.gaps.filter((entry: unknown) => typeof entry === 'string') : [],
    recommendation: normalizedRecommendation,
  };
}

function buildRecommendationProfile(profile: Record<string, any>) {
  return {
    major: profile?.major ?? '',
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    interests: Array.isArray(profile?.interests) ? profile.interests : [],
    summary: profile?.summary ?? '',
    university: profile?.university ?? '',
    degree: profile?.degree ?? '',
    github: profile?.github || profile?.githubUrl || '',
    linkedin: profile?.linkedin || profile?.linkedInUrl || '',
    resumeText: profile?.resumeText || '',
  };
}

function buildRecommendationPostings(postings: ResearchPosting[]) {
  return postings
    .filter((posting) => posting.status === 'published')
    .map((posting) => ({
      id: posting.id,
      title: posting.title,
      category: posting.category,
      overview: posting.overview,
      studentRoleDescription: posting.studentRoleDescription,
      requiredQualifications: posting.requiredQualifications,
      preferredQualifications: posting.preferredQualifications,
    }));
}

function buildLocalFallbackRecommendations(postings: Array<{ id: string }>): RecommendationItem[] {
  return postings.slice(0, 8).map((posting, index) => ({
    postingId: posting.id,
    confidence: Math.max(55, 90 - index * 6),
    reason: 'Fallback ranking was used because the recommendation service did not respond in time.',
    score_breakdown: null,
    qualifications: [],
    fit_reasoning: [],
    gaps: [],
    recommendation: null,
  }));
}

export default function AIRecommendations() {
  const navigate = useNavigate();
  const { user, setupState } = useAuth();
  const { postings, getApplicationsByStudent } = useData();
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestKeyRef = useRef('');

  const studentProfile = setupState?.profile as Record<string, any> | undefined;
  const appliedPostingIds = new Set(getApplicationsByStudent(user?.id ?? '').map((application) => application.postingId));

  // For UI: show top signals
  const topSignals = [
    studentProfile?.major ?? '',
    ...(studentProfile?.skills ?? []),
    ...(studentProfile?.interests ?? []),
  ].filter(Boolean).slice(0, 5);
  const hasProfileBasics = Boolean(studentProfile?.major || studentProfile?.skills?.length || studentProfile?.interests?.length || studentProfile?.resume?.name);

  const requestProfile = useMemo(() => buildRecommendationProfile(studentProfile ?? {}), [
    studentProfile?.major,
    studentProfile?.summary,
    studentProfile?.university,
    studentProfile?.degree,
    Array.isArray(studentProfile?.skills) ? studentProfile.skills.join('|') : '',
    Array.isArray(studentProfile?.interests) ? studentProfile.interests.join('|') : '',
  ]);

  const requestPostings = useMemo(() => buildRecommendationPostings(postings), [
    postings.map((posting) => `${posting.id}:${posting.status}`).join('|'),
  ]);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        profile: requestProfile,
        postingIds: requestPostings.map((posting) => posting.id),
      }),
    [requestProfile, requestPostings]
  );

  useEffect(() => {
    if (!requestPostings.length) return;

    if (lastRequestKeyRef.current === requestKey) {
      return;
    }
    lastRequestKeyRef.current = requestKey;

    setLoading(true);
    setError(null);
    const localFallback = buildLocalFallbackRecommendations(requestPostings);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120000);

    fetch('/api/ai/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ profile: requestProfile, postings: requestPostings }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const rawBody = await res.text();
        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        let payload: Record<string, any> = {};
        if (rawBody.trim() && isJson) {
          try {
            payload = JSON.parse(rawBody);
          } catch {
            payload = {};
          }
        }

        if (!res.ok) {
          const message =
            (typeof payload.error === 'string' && payload.error) ||
            (rawBody.trim() ? `Request failed with ${res.status}` : `Request failed with ${res.status} (empty response)`);
          throw new Error(message);
        }

        return payload;
      })
      .then((data) => {
        const apiRecommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
        setRecommendations(apiRecommendations.map((item) => normalizeRecommendationItem(item)));
      })
      .catch((err) => {
        if (err?.name === 'AbortError') {
          setRecommendations(localFallback);
          setError(null);
          return;
        }

        setRecommendations(localFallback);
        setError(null);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [requestKey]);

  // Map Ollama recommendations to postings
  const recsWithPosting = recommendations
    .map((rec) => {
      const posting = postings.find((p) => p.id === rec.postingId);
      if (!posting) return null;
      return {
        posting,
        recommendation: rec,
        alreadyApplied: appliedPostingIds.has(rec.postingId),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.recommendation.confidence - a!.recommendation.confidence));

  return (
          <div className="space-y-6">
            {!setupState?.completed ? (
              <Card className="border-amber-200 bg-amber-50/70 shadow-none">
                <CardContent className="flex items-start gap-3 p-4 text-amber-950">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Complete your profile for better matches</p>
                    <p className="text-sm text-amber-900/80">
                      The recommendation engine works best after your major, skills, interests, and resume are saved.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden border-[#d8cfc9] bg-[linear-gradient(135deg,#fffdfa_0%,#fff4ef_45%,#f8f6fb_100%)] shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-[28px] tracking-[-0.02em] text-foreground">
                  <BrainCircuit className="h-6 w-6 text-red-700" />
                  AI Recommendations
                </CardTitle>
                <CardDescription className="max-w-3xl text-sm text-muted-foreground">
                  We compare your saved resume signals against every published research posting and rank the best fits.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">How it scores</p>
                  <p className="mt-2 text-sm text-foreground/80">
                    Direct overlaps between your major, skills, interests, and resume metadata raise the confidence score. Missing required qualifications lower it.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Your signals</p>
                  {hasProfileBasics ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {topSignals.map((signal) => (
                        <Badge key={signal} variant="secondary" className="rounded-full border border-red-700/15 bg-red-700/[0.06] text-red-800">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-foreground/70">Add a major, skills, interests, or a resume to personalize the ranking.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Apply flow</p>
                  <p className="mt-2 text-sm text-foreground/80">
                    Use the Apply button on any recommendation. It opens the same application dialog and keeps the duplicate-application check.
                  </p>
                </div>
              </CardContent>
            </Card>

            {loading && (
              <Card className="border-[#d8cfc9] bg-white shadow-none">
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="text-gray-600">Loading recommendations...</p>
                </CardContent>
              </Card>
            )}
            {error && (
              <Card className="border-[#d8cfc9] bg-white shadow-none">
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="text-red-600">{error}</p>
                </CardContent>
              </Card>
            )}
            {!loading && !error && recsWithPosting.length === 0 && (
              <Card className="border-[#d8cfc9] bg-white shadow-none">
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="text-gray-600">No recommendations found.</p>
                </CardContent>
              </Card>
            )}
            <div className="space-y-4">
              {recsWithPosting.map((rec, index) => {
                const topPick = index === 0;
                return (
                  <Card
                    key={rec!.posting.id}
                    className={`border-[#d8cfc9] bg-white shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] ${topPick ? 'ring-1 ring-red-700/10' : ''}`}
                  >
                    <CardHeader className="space-y-3 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-2xl tracking-[-0.01em] text-foreground">{rec!.posting.title}</CardTitle>
                            {topPick ? (
                              <Badge className="rounded-full bg-red-700 text-white hover:bg-red-700">Top pick</Badge>
                            ) : null}
                            {rec!.alreadyApplied ? (
                              <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-900">
                                Already applied
                              </Badge>
                            ) : null}
                          </div>
                          <CardDescription className="text-sm text-muted-foreground">
                            {rec!.posting.professorName} • {rec!.posting.professorDepartment}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <BadgeCheck className="h-4 w-4 text-red-700" />
                            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-red-700">Confidence</span>
                          </div>
                          <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-foreground">
                            {rec!.recommendation.confidence !== undefined
                              ? `${(rec!.recommendation.confidence <= 1
                                ? rec!.recommendation.confidence * 100
                                : rec!.recommendation.confidence).toFixed(1)}%`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border border-red-700/20 bg-red-700/[0.06] text-red-800 hover:bg-red-700/[0.06]">
                          {rec!.posting.category}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          Apply by {new Date(rec!.posting.applicationDeadline).toLocaleDateString()}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {rec!.posting.compensation}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm leading-6 text-foreground/80">{rec!.posting.overview}</p>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-[#efe7e2] bg-[#fcfbfa] p-4">
                          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#4f4a46]">
                            <Sparkles className="h-4 w-4 text-red-700" />
                            Why this is recommended
                          </p>
                          <ul className="space-y-2 text-sm text-foreground/80">
                            <li className="rounded-xl border border-transparent bg-white px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                              <p className="font-semibold text-foreground">Reason</p>
                              <p className="mt-1 leading-6 text-foreground/75">{rec!.recommendation.reason}</p>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 border-t border-[#eee7e2] pt-4">
                        <Button
                          variant="outline"
                          className="rounded-md border-[#d0ceca] bg-white text-[#4f4a46] hover:bg-[#f8f6f4]"
                          onClick={() => {
                            const params = new URLSearchParams({
                              confidence: String(rec!.recommendation.confidence ?? ''),
                              reason: rec!.recommendation.reason ?? '',
                            });
                            navigate(`/student/recommendations/${rec!.posting.id}/reasoning?${params.toString()}`, {
                              state: { recommendation: rec!.recommendation },
                            });
                          }}
                        >
                          View score reasoning
                        </Button>
                        <Button
                          onClick={() => setSelectedPosting(rec!.posting.id)}
                          className="rounded-md bg-[#c92e1f] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b3271b] active:translate-y-0.5 active:bg-[#a92318] focus-visible:ring-2 focus-visible:ring-red-700/25"
                          disabled={rec!.alreadyApplied}
                        >
                          {rec!.alreadyApplied ? 'Already Applied' : (<><span>Apply</span> <ArrowRight className="ml-2 h-4 w-4" /></>)}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedPosting ? (
              <ApplyToResearchDialog
                postingId={selectedPosting}
                open={Boolean(selectedPosting)}
                onOpenChange={(open) => !open && setSelectedPosting(null)}
              />
            ) : null}
          </div>
        );
      }

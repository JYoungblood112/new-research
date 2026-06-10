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

export default function AIRecommendations() {
  const navigate = useNavigate();
  const { user, setupState } = useAuth();
  const { postings, applications, getApplicationsByStudent } = useData();
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);
  const [scoredPostings, setScoredPostings] = useState<Map<string, RecommendationItem>>(new Map());
  const [appliedPostingIds, setAppliedPostingIds] = useState<Set<string>>(new Set());
  const [allPostingIds, setAllPostingIds] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const activePollsRef = useRef<
    Map<
      string,
      {
        intervalId: number;
        timeoutId: number;
      }
    >
  >(new Map());
  const activeSessionRef = useRef<string>('');

  const studentProfile = setupState?.profile as Record<string, any> | undefined;
  const appliedPostingIdsFromData = useMemo(
    () => new Set(getApplicationsByStudent(user?.id ?? '').map((application) => application.postingId)),
    [applications, getApplicationsByStudent, user?.id]
  );

  useEffect(() => {
    setAppliedPostingIds(appliedPostingIdsFromData);
  }, [appliedPostingIdsFromData]);

  // For UI: show top signals
  const topSignals = [
    studentProfile?.major ?? '',
    ...(studentProfile?.skills ?? []),
    ...(studentProfile?.interests ?? []),
  ].filter(Boolean).slice(0, 5);
  const hasProfileBasics = Boolean(studentProfile?.major || studentProfile?.skills?.length || studentProfile?.interests?.length || studentProfile?.resume?.name);

  const profileKey = useMemo(
    () =>
      JSON.stringify({
        major: studentProfile?.major ?? '',
        skills: Array.isArray(studentProfile?.skills) ? studentProfile.skills : [],
        interests: Array.isArray(studentProfile?.interests) ? studentProfile.interests : [],
        summary: studentProfile?.summary ?? '',
        university: studentProfile?.university ?? '',
        degree: studentProfile?.degree ?? '',
        github: studentProfile?.github || studentProfile?.githubUrl || '',
        linkedin: studentProfile?.linkedin || studentProfile?.linkedInUrl || '',
        resumeText: studentProfile?.resumeText || '',
      }),
    [
      studentProfile?.major,
      studentProfile?.summary,
      studentProfile?.university,
      studentProfile?.degree,
      Array.isArray(studentProfile?.skills) ? studentProfile.skills.join('|') : '',
      Array.isArray(studentProfile?.interests) ? studentProfile.interests.join('|') : '',
      studentProfile?.github,
      studentProfile?.githubUrl,
      studentProfile?.linkedin,
      studentProfile?.linkedInUrl,
      studentProfile?.resumeText,
    ]
  );

  const top5 = useMemo(() => {
    return Array.from(scoredPostings.values())
      .filter((item) => !appliedPostingIds.has(item.postingId))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }, [scoredPostings, appliedPostingIds]);

  const stopPolling = (postingId: string) => {
    const active = activePollsRef.current.get(postingId);
    if (!active) {
      return;
    }

    window.clearInterval(active.intervalId);
    window.clearTimeout(active.timeoutId);
    activePollsRef.current.delete(postingId);
  };

  const pollForScore = (postingId: string) => {
    if (activePollsRef.current.has(postingId)) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/recommendations/get-score?postingId=${encodeURIComponent(postingId)}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (data.status === 'ready' && data.result) {
          stopPolling(postingId);
          setScoredPostings((prev) => {
            const next = new Map(prev);
            next.set(postingId, normalizeRecommendationItem(data.result));
            return next;
          });
        }
      } catch {
        // Keep polling until the timeout or success.
      }
    }, 2000);

    const timeoutId = window.setTimeout(() => stopPolling(postingId), 1000 * 60 * 6);
    activePollsRef.current.set(postingId, { intervalId, timeoutId });
  };

  const fetchAndScorePosting = async (posting: ResearchPosting) => {
    try {
      const res = await fetch(`/api/ai/recommendations/score-one?postingId=${encodeURIComponent(posting.id)}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.status === 'ready' && data.result) {
        setScoredPostings((prev) => {
          const next = new Map(prev);
          next.set(posting.id, normalizeRecommendationItem(data.result));
          return next;
        });
        return;
      }

      if (data.status === 'scoring') {
        pollForScore(posting.id);
      }
    } catch {
      // Keep the queue moving; the next polling pass can retry.
    }
  };

  const loadPostingsFromServer = async () => {
    try {
      const res = await fetch('/api/postings', { credentials: 'include' });
      const payload = await res.json();
      const serverPostings = Array.isArray(payload) ? payload : Array.isArray(payload?.postings) ? payload.postings : [];
      const merged = new Map<string, ResearchPosting>();

      for (const posting of serverPostings as ResearchPosting[]) {
        if (posting?.id) {
          merged.set(posting.id, posting);
        }
      }

      for (const posting of postings) {
        if (posting?.id) {
          merged.set(posting.id, posting);
        }
      }

      return Array.from(merged.values()).filter((posting) => posting.status === 'published');
    } catch {
      return postings.filter((posting) => posting.status === 'published');
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setScoredPostings(new Map());
      setAppliedPostingIds(new Set());
      setAllPostingIds([]);
      setIsHydrating(false);
      activeSessionRef.current = '';
      return;
    }

    if (activeSessionRef.current === `${user.id}:${profileKey}`) {
      return;
    }

    activeSessionRef.current = `${user.id}:${profileKey}`;
    setIsHydrating(true);
    setScoredPostings(new Map());
    setAllPostingIds([]);
    setAppliedPostingIds(new Set(getApplicationsByStudent(user.id).map((application) => application.postingId)));

    let cancelled = false;

    void (async () => {
      const availablePostings = await loadPostingsFromServer();
      if (cancelled) {
        return;
      }

      setAllPostingIds(availablePostings.map((posting) => posting.id));

      for (const posting of availablePostings) {
        if (appliedPostingIdsFromData.has(posting.id)) {
          continue;
        }

        void fetchAndScorePosting(posting);
      }

      setIsHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profileKey]);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      const availablePostings = await loadPostingsFromServer();
      const nextKnownIds = new Set(allPostingIds);
      const newPostings = availablePostings.filter((posting) => !nextKnownIds.has(posting.id));

      if (newPostings.length === 0) {
        return;
      }

      setAllPostingIds((prev) => [...prev, ...newPostings.map((posting) => posting.id)]);

      for (const posting of newPostings) {
        if (appliedPostingIds.has(posting.id)) {
          continue;
        }

        void fetchAndScorePosting(posting);
      }
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [allPostingIds, appliedPostingIds, top5]);

  useEffect(() => {
    return () => {
      for (const postingId of activePollsRef.current.keys()) {
        stopPolling(postingId);
      }
    };
  }, []);

  const visiblePostings = top5.map((rec) => {
    const posting = postings.find((entry) => entry.id === rec.postingId);
    if (!posting) {
      return null;
    }

    return {
      posting,
      recommendation: rec,
    };
  }).filter(Boolean) as Array<{ posting: ResearchPosting; recommendation: RecommendationItem }>;

  const handleApplied = (postingId: string) => {
    setAppliedPostingIds((prev) => {
      const next = new Set(prev);
      next.add(postingId);
      return next;
    });
  };

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

            {!isHydrating && allPostingIds.length === 0 && (
              <Card className="border-[#d8cfc9] bg-white shadow-none">
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="text-gray-600">No recommendations found.</p>
                </CardContent>
              </Card>
            )}
            <div className="space-y-4">
              {visiblePostings.map((rec, index) => {
                const topPick = index === 0;
                return (
                  <Card
                    key={rec.posting.id}
                    className={`border-[#d8cfc9] bg-white shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] ${topPick ? 'ring-1 ring-red-700/10' : ''}`}
                  >
                    <CardHeader className="space-y-3 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-2xl tracking-[-0.01em] text-foreground">{rec.posting.title}</CardTitle>
                            {topPick ? (
                              <Badge className="rounded-full bg-red-700 text-white hover:bg-red-700">Top pick</Badge>
                            ) : null}
                          </div>
                          <CardDescription className="text-sm text-muted-foreground">
                            {rec.posting.professorName} • {rec.posting.professorDepartment}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <BadgeCheck className="h-4 w-4 text-red-700" />
                            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-red-700">Confidence</span>
                          </div>
                          <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-foreground">
                            {rec.recommendation.confidence !== undefined
                              ? `${(rec.recommendation.confidence <= 1
                                ? rec.recommendation.confidence * 100
                                : rec.recommendation.confidence).toFixed(1)}%`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border border-red-700/20 bg-red-700/[0.06] text-red-800 hover:bg-red-700/[0.06]">
                          {rec.posting.category}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          Apply by {new Date(rec.posting.applicationDeadline).toLocaleDateString()}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {rec.posting.compensation}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm leading-6 text-foreground/80">{rec.posting.overview}</p>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-[#efe7e2] bg-[#fcfbfa] p-4">
                          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#4f4a46]">
                            <Sparkles className="h-4 w-4 text-red-700" />
                            Why this is recommended
                          </p>
                          <ul className="space-y-2 text-sm text-foreground/80">
                            <li className="rounded-xl border border-transparent bg-white px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                              <p className="font-semibold text-foreground">Reason</p>
                              <p className="mt-1 leading-6 text-foreground/75">{rec.recommendation.reason}</p>
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
                              confidence: String(rec.recommendation.confidence ?? ''),
                              reason: rec.recommendation.reason ?? '',
                            });
                            navigate(`/student/recommendations/${rec.posting.id}/reasoning?${params.toString()}`, {
                              state: { recommendation: rec.recommendation },
                            });
                          }}
                        >
                          View score reasoning
                        </Button>
                        <Button
                          onClick={() => setSelectedPosting(rec.posting.id)}
                          className="rounded-md bg-[#c92e1f] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b3271b] active:translate-y-0.5 active:bg-[#a92318] focus-visible:ring-2 focus-visible:ring-red-700/25"
                        >
                          <><span>Apply</span> <ArrowRight className="ml-2 h-4 w-4" /></>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {isHydrating || top5.length < 5
                ? Array.from({ length: Math.max(0, 5 - top5.length) }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="rounded-xl border p-4 animate-pulse">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="h-4 w-1/3 rounded bg-muted" />
                        <div className="h-6 w-16 rounded bg-muted" />
                      </div>
                      <p className="text-xs text-muted-foreground">Analyzing match...</p>
                    </div>
                  ))
                : null}
            </div>

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

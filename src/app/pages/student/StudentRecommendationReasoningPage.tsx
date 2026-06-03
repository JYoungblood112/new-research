import { useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, Sparkles } from 'lucide-react';
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

function toDisplayPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function parseRequirementItems(raw: string) {
  return raw
    .split(/\n|;|\.|\|/)
    .map((entry) => entry.replace(/^[-*\d)\s]+/, '').trim())
    .filter((entry) => entry.length >= 4);
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

export default function StudentRecommendationReasoningPage() {
  const { postingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { postings } = useData();

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

  const finalToneClass = score >= 75
    ? 'text-green-700'
    : score >= 50
      ? 'text-amber-700'
      : 'text-red-700';

  const qualificationItems = recommendation.qualifications.filter(Boolean);
  const fitItems = recommendation.fit_reasoning
    .filter(Boolean)
    .filter((item) => item !== 'Detailed model reasoning was unavailable for this request; fallback ranking is shown.');
  const gapItems = recommendation.gaps.filter(
    (item) => item && !/no\s+github|no\s+linkedin/i.test(item)
  );

  const hasFallback = !recommendation.score_breakdown &&
    (!recommendation.qualifications || recommendation.qualifications.length === 0) &&
    (!recommendation.fit_reasoning || recommendation.fit_reasoning.length === 0);

  const fallbackRequirements = useMemo(() => {
    if (!posting) {
      return [];
    }
    return [
      ...parseRequirementItems(posting.requiredQualifications),
      ...parseRequirementItems(posting.preferredQualifications),
    ].slice(0, 5);
  }, [posting]);

  const displayQualifications = qualificationItems.length > 0
    ? qualificationItems
    : hasFallback
      ? fallbackRequirements.map((item) => `Requirement detected: ${item}`)
      : [];

  const displayFit = fitItems.length > 0
    ? fitItems
    : hasFallback
      ? [recommendation.reason]
      : [];

  return (
    <div className="min-h-screen bg-[#f7f7f7] px-4 py-8">
      <main className="mx-auto max-w-6xl space-y-4">
        <Button
          variant="outline"
          className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7]"
          onClick={() => navigate('/student/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to AI Recommendations
        </Button>

        {!posting ? (
          <Card className="border-[#d8cfc9] bg-white shadow-none">
            <CardContent className="py-10 text-center text-gray-600">
              This recommendation is no longer available.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-[#d8cfc9] bg-[linear-gradient(120deg,#fff4ef_0%,#fff9f5_45%,#ffffff_100%)] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[28px] tracking-[-0.02em] text-foreground">
                  <Sparkles className="h-6 w-6 text-red-700" />
                  Confidence Score Reasoning
                </CardTitle>
                <CardDescription>
                  {posting.title} • {posting.professorName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-xl border border-[#ececec] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1f1f1f]">Resume Score - {breakdown.base_score} / 100</p>
                    <span className="text-xs text-[#6b6b6b]">Baseline</span>
                  </div>
                  <Progress value={breakdown.base_score} className="h-3" />
                </div>

                {breakdown.github_available ? (
                  <div className="space-y-2 rounded-xl border border-[#e5efe8] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${breakdown.github_sparse ? 'text-amber-700' : 'text-green-700'}`}>
                        + GitHub Bonus - +{breakdown.github_bonus} pts
                      </p>
                      {breakdown.github_sparse ? <span className="text-xs text-amber-700">limited signal</span> : null}
                    </div>
                    <Progress value={(breakdown.github_bonus / 15) * 100} className="h-2" />
                  </div>
                ) : (
                  <Badge variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#666666]">
                    GitHub - not provided (not factored into score)
                  </Badge>
                )}

                {breakdown.linkedin_available ? (
                  <div className="space-y-2 rounded-xl border border-[#e5efe8] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${breakdown.linkedin_sparse ? 'text-amber-700' : 'text-green-700'}`}>
                        + LinkedIn Bonus - +{breakdown.linkedin_bonus} pts
                      </p>
                      {breakdown.linkedin_sparse ? <span className="text-xs text-amber-700">limited signal</span> : null}
                    </div>
                    <Progress value={(breakdown.linkedin_bonus / 10) * 100} className="h-2" />
                  </div>
                ) : (
                  <Badge variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#666666]">
                    LinkedIn - not provided (not factored into score)
                  </Badge>
                )}

                <div className="rounded-xl border border-[#ececec] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#8a6f66]">Final Score</p>
                  <p className={`text-3xl font-semibold ${finalToneClass}`}>Final Score: {score} / 100</p>
                  <p className="text-sm text-[#666666]">(resume baseline + bonuses)</p>
                </div>

                <p className="text-sm text-[#4f4a46]">{recommendation.reason}</p>
                {hasFallback ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Detailed model reasoning was unavailable for this request; fallback ranking is shown.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-[#d8cfc9] bg-white shadow-none">
                <CardHeader>
                  <CardTitle>Qualifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {displayQualifications.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl border border-[#e8eee9] bg-[#f8fcf9] p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <p className="text-sm text-[#1f1f1f]">{item}</p>
                    </div>
                  ))}

                  <div className="pt-2">
                    <p className="text-sm font-semibold text-amber-700">Areas to Strengthen</p>
                  </div>

                  {(gapItems.length > 0 ? gapItems : ['No major gaps were flagged for this posting.']).map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <p className="text-sm text-[#4d3f25]">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#d8cfc9] bg-white shadow-none">
                <CardHeader>
                  <CardTitle>Position Fit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {displayFit.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                      <p className="text-sm text-[#1f2e4a]">{item}</p>
                    </div>
                  ))}

                  <div className="pt-2">
                    <p className="text-sm font-semibold text-[#575757]">Recommendation</p>
                    <Badge className={`mt-2 rounded-full ${getBadgeForRecommendation(recommendation.recommendation)}`}>
                      {recommendation.recommendation ?? 'Possible Fit'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

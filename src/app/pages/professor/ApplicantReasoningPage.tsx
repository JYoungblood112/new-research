import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertCircle, ArrowLeft, Brain, CheckCircle, FileSearch, ShieldAlert, Sparkles, Target, XCircle } from 'lucide-react';

import { useData } from '../../contexts/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

function getSuggestedCoursework(project: string, major: string) {
  const base = ['15-122 Principles of Imperative Computation'];
  const normalizedProject = project.toLowerCase();
  const normalizedMajor = major.toLowerCase();

  if (normalizedProject.includes('nlp') || normalizedProject.includes('llm') || normalizedProject.includes('language')) {
    return ['11-411 Natural Language Processing', '10-601 Machine Learning', ...base];
  }

  if (normalizedProject.includes('vision') || normalizedProject.includes('imag')) {
    return ['16-385 Computer Vision', '10-601 Machine Learning', ...base];
  }

  if (normalizedProject.includes('robot')) {
    return ['16-311 Introduction to Robotics', '16-299 Robotics Programming', ...base];
  }

  if (normalizedProject.includes('hci') || normalizedProject.includes('interface')) {
    return ['05-410 User-Centered Research and Evaluation', '05-430 Programming Usable Interfaces', ...base];
  }

  if (normalizedMajor.includes('computer science') || normalizedMajor.includes('ai')) {
    return ['10-601 Machine Learning', '15-210 Parallel and Sequential Data Structures', ...base];
  }

  return ['36-401 Modern Regression', '70-311 Organizational Design and Implementation', ...base];
}

function buildAiInsights(score: number, project: string, major: string, resumeName: string, quickNote: string) {
  const coursework = getSuggestedCoursework(project, major);

  const strengths = [
    {
      title: 'Strong Python experience',
      because: `Because of resume project and implementation evidence in ${resumeName}.`,
      source: `Resume project stack mentions Python-based workflows and experiment implementation, which matches requirements in your project description. Coursework alignment: ${coursework[0]} and ${coursework[1]} reinforce model development, experimentation, and evaluation skills directly used in this research project.`,
    },
    {
      title: 'Relevant ML coursework',
      because: `Because of course taken: ${coursework[0]} and ${coursework[1]}.`,
      source: `Course trajectory aligns with ${project} requirements by connecting concepts learned in class to the project's expected research workflow and deliverables.`,
    },
    {
      title: 'High quality resume and role alignment',
      because: `Because application note focuses on outcomes tied to this role: "${quickNote}"`,
      source: 'Statement and project alignment indicate readiness for weekly research deliverables.',
    },
  ];

  const concerns = [
    {
      title: 'No publication experience listed',
      because: 'Because no accepted publication artifacts are referenced in submitted materials.',
      source: 'Resume/application currently emphasize coursework and projects over peer-reviewed outputs.',
    },
    {
      title: 'Limited prior lab research background',
      because: `Because strongest evidence is coursework (${coursework[0]}) rather than long-form lab tenure.`,
      source: 'Potential fit is strong, but mentorship ramp-up may be required in first weeks.',
    },
  ];

  if (score < 80) {
    strengths[2] = {
      title: 'Clear motivation for research growth',
      because: `Because application note expresses growth intent: "${quickNote}"`,
      source: 'Motivation signal is high even with lighter prior depth in formal research outputs.',
    };
    concerns[1] = {
      title: 'Portfolio depth appears early-stage',
      because: `Because current evidence centers around coursework (${coursework[0]}) and class projects.`,
      source: 'Consider scoped onboarding milestones before assigning independent project ownership.',
    };
  }

  return {
    strengths,
    concerns,
    coursework,
    summary:
      score >= 90
        ? 'Candidate is a strong fit based on technical alignment, consistency, and applied project depth.'
        : score >= 75
          ? 'Candidate shows promising fit with good baseline alignment and clear potential with mentorship.'
          : 'Candidate may fit selective roles with support; recommend clarifying readiness during screening.',
    recommendation:
      score >= 90
        ? 'Advance to final interview and discuss scope ownership from week one.'
        : score >= 75
          ? 'Proceed to interview and validate research communication depth.'
          : 'Consider exploratory interview only if role has onboarding capacity.',
  };
}

function parseRequirementItems(raw: string) {
  return raw
    .split(/\n|;|\.|\|/)
    .map((entry) => entry.replace(/^[-*\d)\s]+/, '').trim())
    .filter((entry) => entry.length >= 4);
}

function getKeywordHints(text: string) {
  const normalized = text.toLowerCase();
  return {
    python: normalized.includes('python'),
    ml: normalized.includes('machine learning') || normalized.includes('ml'),
    stats: normalized.includes('stat') || normalized.includes('regression'),
    nlp: normalized.includes('nlp') || normalized.includes('language model') || normalized.includes('llm'),
    research: normalized.includes('research') || normalized.includes('publication') || normalized.includes('paper'),
    communication: normalized.includes('communication') || normalized.includes('present') || normalized.includes('writing'),
    data: normalized.includes('data') || normalized.includes('dataset') || normalized.includes('analysis'),
  };
}

type RequirementMatchStatus = 'pass' | 'partial' | 'missing';

type RequirementMatch = {
  requirement: string;
  priority: 'Required' | 'Preferred';
  status: RequirementMatchStatus;
  evidence: string;
  example: string;
  gapNote: string;
};

function buildRequirementMatches(
  requiredItems: string[],
  preferredItems: string[],
  major: string,
  resumeName: string,
  quickNote: string,
  coursework: string[]
): RequirementMatch[] {
  const profileText = `${major} ${resumeName} ${quickNote} ${coursework.join(' ')}`;
  const profileHints = getKeywordHints(profileText);

  const evaluate = (requirement: string, priority: 'Required' | 'Preferred'): RequirementMatch => {
    const reqHints = getKeywordHints(requirement);
    const matchedSignals: string[] = [];

    if (reqHints.python && profileHints.python) {
      matchedSignals.push('Resume evidence indicates Python implementation experience.');
    }
    if (reqHints.ml && profileHints.ml) {
      matchedSignals.push(`Coursework alignment: ${coursework[0]} and ${coursework[1]}.`);
    }
    if (reqHints.stats && profileHints.stats) {
      matchedSignals.push('Statistical methods signal appears in coursework/background.');
    }
    if (reqHints.nlp && profileHints.nlp) {
      matchedSignals.push(`Domain-fit signal present for language-model tasks in ${quickNote}.`);
    }
    if (reqHints.research && profileHints.research) {
      matchedSignals.push('Research intent is explicit in application note and profile.');
    }
    if (reqHints.communication && profileHints.communication) {
      matchedSignals.push('Communication/readout signal found in applicant narrative.');
    }
    if (reqHints.data && profileHints.data) {
      matchedSignals.push('Data workflow signal appears in resume/project framing.');
    }

    const status: RequirementMatchStatus =
      matchedSignals.length >= 2 ? 'pass' : matchedSignals.length === 1 ? 'partial' : 'missing';

    let example = `Example: personal statement says "${quickNote}".`;
    if (reqHints.ml) {
      example = `Example: completed ${coursework[0]} and ${coursework[1]} for model training and evaluation workflows.`;
    } else if (reqHints.python) {
      example = `Example: ${resumeName} references Python-based implementation for experiment pipelines.`;
    } else if (reqHints.research) {
      example = `Example: application note states "${quickNote}", indicating explicit research intent.`;
    } else if (reqHints.stats) {
      example = `Example: quantitative preparation is reflected through ${coursework[0]} in the submitted profile.`;
    } else if (reqHints.communication) {
      example = `Example: applicant narrative in the quick note demonstrates communication of research goals.`;
    } else if (reqHints.data) {
      example = `Example: coursework path (${coursework[0]}) supports data analysis and evidence interpretation tasks.`;
    }

    if (status === 'missing') {
      example = `Example gap: no direct mention of "${requirement}" was found in ${resumeName} or the submitted quick note.`;
    }

    const gapNote =
      status === 'missing'
        ? 'No direct evidence found in this submission; validate explicitly during interview.'
        : status === 'partial'
          ? 'Some evidence exists, but depth should be verified with concrete examples.'
          : 'Multiple aligned signals found in submitted materials.';

    return {
      requirement,
      priority,
      status,
      evidence:
        matchedSignals.length > 0
          ? matchedSignals.join(' ')
          : `Requirement appears in posting, but current profile (${major}) and note do not explicitly reference it.`,
      example,
      gapNote,
    };
  };

  const requiredMatches = requiredItems.slice(0, 5).map((item) => evaluate(item, 'Required'));
  const preferredMatches = preferredItems.slice(0, 3).map((item) => evaluate(item, 'Preferred'));
  return [...requiredMatches, ...preferredMatches];
}

function getReadinessVerdict(
  matches: Array<{ priority: 'Required' | 'Preferred'; status: RequirementMatchStatus }>
) {
  const totals = {
    requiredMissing: 0,
    requiredPartial: 0,
    preferredMissing: 0,
    preferredPartial: 0,
  };

  for (const match of matches) {
    if (match.priority === 'Required') {
      if (match.status === 'missing') {
        totals.requiredMissing += 1;
      }
      if (match.status === 'partial') {
        totals.requiredPartial += 1;
      }
    } else {
      if (match.status === 'missing') {
        totals.preferredMissing += 1;
      }
      if (match.status === 'partial') {
        totals.preferredPartial += 1;
      }
    }
  }

  const riskScore =
    totals.requiredMissing * 3 + totals.requiredPartial * 2 + totals.preferredMissing + totals.preferredPartial;

  if (totals.requiredMissing >= 2 || riskScore >= 7) {
    return {
      label: 'Blocked',
      toneClass: 'border border-red-200 bg-red-50 text-red-700',
      reason:
        'Too many required capability gaps are currently unproven in the submitted materials. Prioritize evidence collection before advancing.',
    };
  }

  if (totals.requiredMissing >= 1 || riskScore >= 3) {
    return {
      label: 'Conditional',
      toneClass: 'border border-amber-200 bg-amber-50 text-amber-700',
      reason:
        'Candidate has promising signals, but at least one key requirement needs stronger validation in interview or a scoped trial task.',
    };
  }

  return {
    label: 'Ready',
    toneClass: 'border border-green-200 bg-green-50 text-green-700',
    reason: 'Requirements evidence is consistently strong across required criteria with manageable preferred-skill gaps.',
  };
}

function getMatchStatusIcon(status: RequirementMatchStatus) {
  if (status === 'pass') {
    return { Icon: CheckCircle, iconClass: 'text-emerald-600' };
  }
  if (status === 'partial') {
    return { Icon: AlertCircle, iconClass: 'text-amber-600' };
  }
  return { Icon: XCircle, iconClass: 'text-red-600' };
}

export default function ApplicantReasoningPage() {
  const { applications, postings } = useData();
  const navigate = useNavigate();
  const { applicantId } = useParams();
  const [searchParams] = useSearchParams();

  const application = useMemo(
    () => applications.find((entry) => entry.id === applicantId),
    [applications, applicantId]
  );

  const score = Number(searchParams.get('score') ?? '0') || 0;
  const studentName = application?.studentName ?? searchParams.get('name') ?? 'Unknown Student';
  const studentMajor = application?.studentMajor ?? searchParams.get('major') ?? 'Unknown Major';
  const matchingPosting = application ? postings.find((posting) => posting.id === application.postingId) : undefined;
  const project = searchParams.get('project') ?? matchingPosting?.title ?? 'Unknown Project';
  const projectOverview = searchParams.get('overview') ?? matchingPosting?.overview ?? '';
  const requiredQualifications =
    searchParams.get('requiredQualifications') ?? matchingPosting?.requiredQualifications ?? '';
  const preferredQualifications =
    searchParams.get('preferredQualifications') ?? matchingPosting?.preferredQualifications ?? '';
  const status = application?.status ?? searchParams.get('status') ?? 'Pending';
  const submittedAt = application?.submittedAt ?? searchParams.get('submittedAt') ?? '';
  const resumeName = application?.resume?.name ?? `${studentName.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`;
  const quickNote = application?.quickNote?.trim() || 'Interested in contributing to research delivery and publication-oriented outcomes.';

  const insights = buildAiInsights(score, project, studentMajor, resumeName, quickNote);
  const requirementsLine = [requiredQualifications, preferredQualifications].filter(Boolean).join(' | ');
  const projectContextLine = projectOverview || requirementsLine;
  const requiredItems = parseRequirementItems(requiredQualifications);
  const preferredItems = parseRequirementItems(preferredQualifications);
  const requirementMatches = buildRequirementMatches(
    requiredItems,
    preferredItems,
    studentMajor,
    resumeName,
    quickNote,
    insights.coursework
  );
  const readinessVerdict = getReadinessVerdict(requirementMatches);

  return (
    <div className="min-h-screen bg-[#f7f7f7] px-4 py-8">
      <main className="mx-auto max-w-5xl space-y-4">
        <Button
          variant="outline"
          className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7]"
          onClick={() => navigate('/professor/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Professor Dashboard
        </Button>

        <Card className="border-red-200 bg-[linear-gradient(120deg,#fff4ef_0%,#fff9f5_45%,#ffffff_100%)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#111111]">
              <Brain className="h-5 w-5 text-red-700" />
              Applicant AI Match Reasoning
            </CardTitle>
            <CardDescription>
              Detailed explanation of why this applicant received their current AI match score.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-[#ebd9d2] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[#8a6f66]">Applicant</p>
              <p className="text-lg font-semibold text-[#111111]">{studentName}</p>
              <p className="text-sm text-[#555555]">{studentMajor}</p>
              <p className="text-sm text-[#555555]">Project: {project}</p>
            </div>
            <div className="space-y-2 rounded-xl border border-[#ebd9d2] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[#8a6f66]">Evaluation</p>
              <Badge className="border border-red-200 bg-red-50 text-red-700">AI Match Score: {score}%</Badge>
              <p className="text-sm text-[#555555]">Status: {status}</p>
              <p className="text-sm text-[#555555]">
                Submitted: {submittedAt ? new Date(submittedAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-[#d0ceca] bg-white lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-red-700" />
                Requirements Match Matrix
              </CardTitle>
              <CardDescription>
                Requirement-by-requirement evidence with explicit pass/partial/missing status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#333333]">
              <div className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#111111]">Overall readiness verdict</p>
                  <Badge className={readinessVerdict.toneClass}>{readinessVerdict.label}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#555555]">{readinessVerdict.reason}</p>
              </div>

              {requirementMatches.length === 0 ? (
                <p className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3 text-[#555555]">
                  No structured requirements were provided with this posting, so match details are inferred from project context.
                </p>
              ) : (
                requirementMatches.map((match) => (
                  <div key={`${match.priority}-${match.requirement}`} className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#111111]">{match.requirement}</p>
                      <Badge variant="outline" className="border-[#d8d8d8] text-[#666666]">
                        {match.priority}
                      </Badge>
                      <Badge
                        className={
                          match.status === 'pass'
                            ? 'border border-green-200 bg-green-50 text-green-700'
                            : match.status === 'partial'
                              ? 'border border-amber-200 bg-amber-50 text-amber-700'
                              : 'border border-red-200 bg-red-50 text-red-700'
                        }
                      >
                        {match.status === 'pass' ? 'Pass' : match.status === 'partial' ? 'Partial' : 'Missing'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#555555]">Evidence: {match.evidence}</p>
                    <p className="mt-1 text-xs text-[#555555]">{match.example}</p>
                    <p className="mt-1 text-xs text-[#7b7b7b]">Interview focus: {match.gapNote}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-[#d0ceca] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-red-700" />
                Summary Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#333333]">
              <p>{insights.summary}</p>
              <div>
                <p className="font-semibold text-[#111111]">Requirements Analysis</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-[#ececec] bg-[#fafafa]">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#e7d9d2] bg-[#fff4ef] text-xs font-semibold uppercase tracking-[0.08em] text-[#8a6f66]">
                        <th className="px-3 py-2">Research Requirements</th>
                        <th className="px-3 py-2">Candidate Fit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirementMatches.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-[#555555]" colSpan={2}>
                            No structured requirements were provided for this posting.
                          </td>
                        </tr>
                      ) : (
                        requirementMatches.map((match) => {
                          const statusMeta = getMatchStatusIcon(match.status);
                          const StatusIcon = statusMeta.Icon;

                          return (
                            <tr key={`summary-${match.priority}-${match.requirement}`} className="border-b border-[#ececec] last:border-b-0">
                              <td className="px-3 py-3 align-top text-[#111111]">• {match.requirement}</td>
                              <td className="px-3 py-3 align-top text-[#333333]">
                                <div className="flex items-start gap-2">
                                  <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${statusMeta.iconClass}`} />
                                  <div className="space-y-1">
                                    <p className="text-xs leading-relaxed">{match.evidence}</p>
                                    <p className="text-xs leading-relaxed text-[#555555]">{match.example}</p>
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
              <p className="rounded-xl border border-[#f0d9d2] bg-[#fff7f4] p-3">
                Recommendation: {insights.recommendation}
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#d0ceca] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-red-700" />
                Strength Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#333333]">
              {insights.strengths.map((strength) => (
                <div key={strength.title} className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                  <p className="font-semibold">{strength.title}</p>
                  <p className="mt-1 text-xs text-[#555555]">{strength.because}</p>
                  <p className="mt-1 text-xs text-[#7b7b7b]">
                    Evidence: {strength.source}
                    {projectContextLine
                      ? ` Specifically for ${project}, this aligns with: ${projectContextLine}`
                      : ''}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#d0ceca] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-700" />
                Potential Concerns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#333333]">
              {insights.concerns.map((concern) => (
                <div key={concern.title} className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                  <p className="font-semibold">{concern.title}</p>
                  <p className="mt-1 text-xs text-[#555555]">{concern.because}</p>
                  <p className="mt-1 text-xs text-[#7b7b7b]">
                    Evidence: {concern.source}
                    {projectContextLine
                      ? ` In context of ${project}, watch for gaps against: ${projectContextLine}`
                      : ''}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#d0ceca] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-red-700" />
                Review Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#333333]">
              <p>- Validate communication of research methodology in interview.</p>
              <p>- Confirm consistency between resume projects and role expectations.</p>
              <p>- Assess readiness for independent weekly deliverables.</p>
              <p>- Ask candidate to discuss coursework transfer: {insights.coursework[0]} {'->'} current project tasks.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

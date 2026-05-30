import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Brain, FileSearch, ShieldAlert, Sparkles, Target } from 'lucide-react';

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
      source: 'Resume project stack mentions Python-based workflows and experiment implementation.',
    },
    {
      title: 'Relevant ML coursework',
      because: `Because of course taken: ${coursework[0]} and ${coursework[1]}.`,
      source: `Course trajectory aligns with ${project} requirements and model evaluation tasks.`,
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

export default function ApplicantReasoningPage() {
  const { applications } = useData();
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
  const project = searchParams.get('project') ?? 'Unknown Project';
  const status = application?.status ?? searchParams.get('status') ?? 'Pending';
  const submittedAt = application?.submittedAt ?? searchParams.get('submittedAt') ?? '';
  const resumeName = application?.resume?.name ?? `${studentName.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`;
  const quickNote = application?.quickNote?.trim() || 'Interested in contributing to research delivery and publication-oriented outcomes.';

  const insights = buildAiInsights(score, project, studentMajor, resumeName, quickNote);

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
          <Card className="border-[#d0ceca] bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-red-700" />
                Summary Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#333333]">
              <p>{insights.summary}</p>
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
                  <p className="mt-1 text-xs text-[#7b7b7b]">Evidence: {strength.source}</p>
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
                  <p className="mt-1 text-xs text-[#7b7b7b]">Evidence: {concern.source}</p>
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
              <p>- Ask candidate to discuss coursework transfer: {insights.coursework[0]} -> current project tasks.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Github,
  Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData, type ResearchPosting } from '../../contexts/DataContext';
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
  recommendation: FitLevel | null;
};

type FitLevel = 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit' | 'Low Fit';
type Alignment = 'Strong Match' | 'Moderate Match' | 'Limited Match' | 'Missing Evidence';
type SourceStatus = 'Used' | 'Not Used' | 'Missing';

type ComponentScore = {
  label: string;
  earned: number;
  possible: number;
  explanation: string;
  details: string;
};

type RequirementRow = {
  requirement: string;
  evidence: string;
  alignment: Alignment;
  improvement: string;
};

type Improvement = {
  title: string;
  gain: number;
  detail: string;
};

const PLACEHOLDER_PATTERNS = [
  /up to \d+ concise/i,
  /up to \d+ constructive/i,
  /short exact evidence phrase/i,
  /requirement_specific_fit|gap_signal|confidence_reasoning/i,
];

const INTERNAL_FIELD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bstudent_role\b/gi, 'student background'],
  [/\bskills_needed\b/gi, 'required skills'],
  [/\brequired_qualifications\b/gi, 'required qualifications'],
  [/\bpreferred_qualifications\b/gi, 'preferred qualifications'],
  [/\bfit_reasoning\b/gi, 'fit reasoning'],
];

function cleanText(value: string) {
  return INTERNAL_FIELD_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulText(value: string) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function toDisplayPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tokenize(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .filter(
      (word) =>
        !['and', 'the', 'for', 'with', 'from', 'this', 'that', 'your', 'role', 'student', 'research', 'project', 'position'].includes(word)
    );
}

function overlapScore(requirement: string, evidence: string) {
  const req = new Set(tokenize(requirement));
  const evidenceTokens = new Set(tokenize(evidence));
  let score = 0;
  req.forEach((token) => {
    if (evidenceTokens.has(token)) score += 1;
  });
  return score;
}

function toStringList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(toStringList).map(cleanText).filter(isUsefulText);
  }
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return [];
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        return toStringList(JSON.parse(raw));
      } catch {
        // Continue with plain text parsing.
      }
    }
    return raw
      .split(/\n|;|\||\.(?=\s+[A-Z0-9])/)
      .map((entry) => cleanText(entry.replace(/^[-*\d)\s]+/, '').trim()))
      .filter(isUsefulText);
  }
  if (input && typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).flatMap(toStringList);
  }
  return [];
}

function courseLabel(course: unknown) {
  if (typeof course === 'string') return cleanText(course);
  if (course && typeof course === 'object') {
    const row = course as { courseNumber?: string; courseName?: string; semester?: string };
    return [row.courseNumber, row.courseName].filter(Boolean).join(' - ').trim();
  }
  return '';
}

function getFitLevel(score: number): FitLevel {
  if (score >= 85) return 'Strong Fit';
  if (score >= 70) return 'Good Fit';
  if (score >= 55) return 'Possible Fit';
  if (score >= 40) return 'Weak Fit';
  return 'Low Fit';
}

function fitBadgeClass(level: FitLevel) {
  if (level === 'Strong Fit') return 'status-success';
  if (level === 'Good Fit') return 'status-info';
  if (level === 'Possible Fit') return 'status-warning';
  return 'status-danger';
}

function alignmentClass(alignment: Alignment) {
  if (alignment === 'Strong Match') return 'status-success';
  if (alignment === 'Moderate Match') return 'status-info';
  if (alignment === 'Limited Match') return 'status-warning';
  return 'status-danger';
}

function sourceStatusClass(status: SourceStatus) {
  if (status === 'Used') return 'status-success';
  if (status === 'Not Used') return 'status-info';
  return 'status-warning';
}

function splitRequirements(posting: ResearchPosting | null) {
  if (!posting) return [];
  const structured = [
    ...toStringList(posting.requiredQualifications),
    ...toStringList(posting.preferredQualifications),
    ...toStringList(posting.studentRoleDescription),
  ];
  const skills = posting.skillsNeeded.map((skill) => `${skill} experience`);
  return [...structured, ...skills]
    .filter((item, index, arr) => arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 8);
}

function getRelevantCoursework(courses: string[], posting: ResearchPosting | null) {
  const context = [posting?.title, posting?.overview, posting?.category, ...(posting?.researchAreas ?? []), ...(posting?.skillsNeeded ?? [])]
    .filter(Boolean)
    .join(' ');
  const scored = courses.map((course) => ({
    course,
    score:
      overlapScore(context, course) +
      (/\b(probability|statistics|statistical|regression|data|machine learning|ai|programming|sql|database|linear algebra|nlp|vision|robotics|computing|analytics)\b/i.test(course)
        ? 2
        : 0),
  }));
  const relevant = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.course).slice(0, 6);
  const lessRelevant = courses.filter((course) => !relevant.includes(course));
  return { relevant, lessRelevant };
}

function evaluateRequirements(requirements: string[], evidenceText: string, courseworkText: string): RequirementRow[] {
  if (requirements.length === 0) {
    return [
      {
        requirement: 'Research position requirements',
        evidence: 'This posting does not list structured requirements.',
        alignment: 'Missing Evidence',
        improvement: 'Ask the professor what skills or preparation matter most for this role.',
      },
    ];
  }

  return requirements.map((requirement) => {
    const evidenceOverlap = overlapScore(requirement, evidenceText);
    const courseOverlap = overlapScore(requirement, courseworkText);

    if (evidenceOverlap >= 3) {
      return {
        requirement,
        evidence: 'Your profile includes direct evidence that overlaps with this requirement.',
        alignment: 'Strong Match',
        improvement: 'Keep this evidence visible in future applications.',
      };
    }

    if (evidenceOverlap >= 1 || courseOverlap >= 2) {
      return {
        requirement,
        evidence: courseOverlap > 0 ? 'Relevant coursework or related profile evidence supports part of this requirement.' : 'Related profile evidence supports part of this requirement.',
        alignment: 'Moderate Match',
        improvement: `Add a project, artifact, or short explanation that directly proves ${requirement.toLowerCase()}.`,
      };
    }

    if (courseOverlap >= 1) {
      return {
        requirement,
        evidence: 'Only indirect academic preparation was found.',
        alignment: 'Limited Match',
        improvement: `Add clearer coursework, project, or resume evidence for ${requirement.toLowerCase()}.`,
      };
    }

    return {
      requirement,
      evidence: 'No clear evidence was found for this requirement.',
      alignment: 'Missing Evidence',
      improvement: `Add direct evidence for ${requirement.toLowerCase()} before applying to similar roles.`,
    };
  });
}

function alignmentValue(alignment: Alignment) {
  if (alignment === 'Strong Match') return 1;
  if (alignment === 'Moderate Match') return 0.6;
  if (alignment === 'Limited Match') return 0.25;
  return 0;
}

function getGithubPreview(payload: Record<string, unknown>) {
  const githubData = payload.githubData as Record<string, unknown> | undefined;
  const repos = Array.isArray(githubData?.top_repos) ? (githubData.top_repos as Array<Record<string, unknown>>) : [];
  return repos.slice(0, 3).map((repo) => ({
    name: String(repo.name ?? 'Repository'),
    description: String(repo.description ?? 'No description provided.'),
    language: String(repo.language ?? 'Code'),
    topics: Array.isArray(repo.topics) ? repo.topics.map(String).slice(0, 4) : [],
  }));
}

function buildEvaluation({
  score,
  posting,
  recommendation,
  profile,
}: {
  score: number;
  posting: ResearchPosting | null;
  recommendation: RecommendationDetails;
  profile: Record<string, unknown>;
}) {
  const rawCourses = Array.isArray(profile.coursework) ? profile.coursework.map(courseLabel).filter(Boolean) : [];
  const { relevant, lessRelevant } = getRelevantCoursework(rawCourses, posting);
  const requirements = splitRequirements(posting);
  const qualifications = toStringList(recommendation.qualifications);
  const fitReasoning = toStringList(recommendation.fit_reasoning);
  const gaps = toStringList(recommendation.gaps);
  const githubUrl = String(profile.github ?? profile.githubUrl ?? '').trim();
  const linkedinUrl = String(profile.linkedin ?? profile.linkedInUrl ?? profile.linkedinUrl ?? '').trim();
  const transcriptAvailable = Boolean(profile.transcript) || rawCourses.length > 0;
  const resumeAvailable = Boolean(profile.resume);
  const githubAvailable = Boolean(recommendation.score_breakdown?.github_available || githubUrl);
  const linkedinAvailable = Boolean(recommendation.score_breakdown?.linkedin_available || linkedinUrl);
  const githubRepos = getGithubPreview(recommendation as unknown as Record<string, unknown>);
  const evidenceText = [
    profile.major,
    profile.skills,
    profile.researchInterests,
    qualifications.join(' '),
    fitReasoning.join(' '),
    relevant.join(' '),
    githubRepos.map((repo) => `${repo.name} ${repo.description} ${repo.language} ${repo.topics.join(' ')}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
  const courseworkText = rawCourses.join(' ');
  const rows = evaluateRequirements(requirements, evidenceText, courseworkText);

  const requirementEarned = Math.round((rows.reduce((sum, row) => sum + alignmentValue(row.alignment), 0) / rows.length) * 40);
  const requestedSkills = posting?.skillsNeeded ?? [];
  const matchedSkills = requestedSkills.filter((skill) => overlapScore(skill, evidenceText) > 0).length;
  const skillsEarned = requestedSkills.length > 0 ? Math.round((matchedSkills / requestedSkills.length) * 20) : 0;
  const researchSignals = [
    /\bresearch|lab|paper|publication|poster|experiment|dataset|analysis|study\b/i.test(evidenceText),
    githubRepos.length > 0,
    fitReasoning.some((item) => /research|project|experiment|dataset/i.test(item)),
  ].filter(Boolean).length;
  const researchEarned = Math.round((researchSignals / 3) * 15);
  const courseworkEarned = Math.round(Math.min(1, relevant.length / 4) * 10);
  const sourcesUsed = [resumeAvailable, transcriptAvailable, githubAvailable, linkedinAvailable].filter(Boolean).length;
  const evidenceEarned = Math.round(Math.min(1, sourcesUsed / 4) * 10);
  const profileEarned = Math.round(
    ([resumeAvailable, transcriptAvailable, githubAvailable, linkedinAvailable, Boolean(profile.researchInterests)].filter(Boolean).length / 5) * 5
  );
  const computedScore = requirementEarned + skillsEarned + researchEarned + courseworkEarned + evidenceEarned + profileEarned;
  const finalScore = Number.isFinite(score) && score > 0 ? Math.round((score + computedScore) / 2) : computedScore;
  const fitLevel = getFitLevel(finalScore);

  const strengths = [
    matchedSkills > 0 ? 'Required skills have some supporting evidence' : '',
    relevant.length > 0 ? 'Relevant coursework contributed to the score' : '',
    researchEarned > 0 ? 'Project or research signals were found' : '',
    githubAvailable ? 'GitHub evidence was available for review' : '',
  ].filter(Boolean);

  const needsImprovement = [
    ...rows.filter((row) => row.alignment !== 'Strong Match').map((row) => row.requirement).slice(0, 3),
    !githubAvailable ? 'GitHub projects' : '',
    !linkedinAvailable ? 'LinkedIn profile' : '',
  ].filter(Boolean).slice(0, 5);

  const improvements: Improvement[] = [
    ...rows
      .filter((row) => row.alignment === 'Missing Evidence' || row.alignment === 'Limited Match')
      .slice(0, 3)
      .map((row, index) => ({
        title: row.alignment === 'Missing Evidence' ? `Add evidence for ${row.requirement}` : `Strengthen evidence for ${row.requirement}`,
        gain: index === 0 ? 8 : index === 1 ? 6 : 5,
        detail: row.improvement,
      })),
    !githubAvailable
      ? { title: 'Upload or connect GitHub projects', gain: 6, detail: 'Add projects with clear README files, technologies, and research-relevant implementation details.' }
      : null,
    !linkedinAvailable
      ? { title: 'Connect your LinkedIn profile', gain: 2, detail: 'LinkedIn can add context for internships, lab work, and professional experience.' }
      : null,
    relevant.length < 3
      ? { title: 'Add more coursework evidence', gain: 5, detail: 'Include transcript evidence for statistics, data analysis, programming, or the project domain.' }
      : null,
  ].filter((item): item is Improvement => Boolean(item)).slice(0, 5);

  return {
    finalScore,
    fitLevel,
    explanation:
      finalScore >= 70
        ? 'Your application has strong supporting evidence for this research opportunity, with a few areas to make even clearer.'
        : finalScore >= 55
          ? 'You show useful preparation, but the application needs more direct evidence for several project requirements.'
          : 'The current application does not yet show enough direct evidence for this opportunity.',
    components: [
      { label: 'Requirement Match', earned: requirementEarned, possible: 40, explanation: `${rows.filter((row) => row.alignment === 'Strong Match').length} strong matches found.`, details: 'Measures how directly your evidence satisfies the project requirements.' },
      { label: 'Skills Match', earned: skillsEarned, possible: 20, explanation: `${matchedSkills} of ${requestedSkills.length || 0} requested skills matched.`, details: 'Uses required skills from the posting and evidence from your profile, coursework, resume, and GitHub.' },
      { label: 'Research Experience', earned: researchEarned, possible: 15, explanation: `${researchSignals} research/project signals found.`, details: 'Looks for research, lab, dataset, experiment, publication, or project evidence.' },
      { label: 'Coursework Preparation', earned: courseworkEarned, possible: 10, explanation: `${relevant.length} relevant courses found.`, details: 'Scores relevant transcript/coursework evidence without showing your full transcript by default.' },
      { label: 'Evidence Quality', earned: evidenceEarned, possible: 10, explanation: `${sourcesUsed} evidence sources used.`, details: 'Rewards complete, specific, and source-backed evidence.' },
      { label: 'Profile Completeness', earned: profileEarned, possible: 5, explanation: 'Based on profile completeness.', details: 'Resume, transcript, GitHub, LinkedIn, and research interests improve completeness.' },
    ] as ComponentScore[],
    requirements: rows,
    sources: [
      { label: 'Resume', status: resumeAvailable ? 'Used' : 'Missing', detail: resumeAvailable ? 'Your resume contributed baseline evidence.' : 'Upload a resume so projects and skills can be evaluated.' },
      { label: 'Transcript', status: transcriptAvailable ? 'Used' : 'Missing', detail: transcriptAvailable ? `${relevant.length} relevant courses were summarized.` : 'No transcript/coursework evidence was available.' },
      { label: 'GitHub', status: githubAvailable ? 'Used' : 'Missing', detail: githubAvailable ? 'GitHub helped with project and technology evidence. Stars were not treated as a major signal.' : 'GitHub was not provided, so code/project evidence was not included.' },
      { label: 'LinkedIn', status: linkedinAvailable ? 'Used' : 'Missing', detail: linkedinAvailable ? 'LinkedIn added professional context.' : 'LinkedIn was not provided.' },
      { label: 'Progress Reports', status: 'Not Used', detail: 'No verified progress reports were available for this recommendation.' },
      { label: 'Faculty Verification', status: 'Not Used', detail: 'No faculty verification was available for this recommendation.' },
    ] as Array<{ label: string; status: SourceStatus; detail: string }>,
    relevantCourses: relevant,
    lessRelevantCourses: lessRelevant,
    githubRepos,
    strengths: strengths.length > 0 ? strengths : ['Your profile provided baseline evidence for review'],
    needsImprovement,
    improvements,
    checklist: [
      'Upload or polish GitHub projects',
      'Add direct experience for missing requirements',
      'Include research reports or project artifacts',
      'Connect LinkedIn profile',
      'Expand project descriptions with methods and outcomes',
    ],
  };
}

function ApplicationFitSummary({
  score,
  fitLevel,
  explanation,
  strengths,
  needsImprovement,
  posting,
}: {
  score: number;
  fitLevel: FitLevel;
  explanation: string;
  strengths: string[];
  needsImprovement: string[];
  posting: ResearchPosting;
}) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[230px_1fr]">
        <div className="rounded-2xl border border-[#ececec] bg-[#fbfaf8] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Application Fit Summary</p>
          <p className="mt-3 text-5xl font-semibold tracking-tight text-[#111111]">{score}</p>
          <p className="text-sm text-[#666666]">/ 100</p>
          <div className="mt-4">
            <Badge className={`rounded-full border px-3 py-1 ${fitBadgeClass(fitLevel)}`}>{fitLevel}</Badge>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">{posting.title}</h1>
            <p className="mt-1 text-sm text-[#666666]">{posting.professorName} - {posting.professorDepartment}</p>
            <p className="mt-3 text-sm leading-6 text-[#333333]">{explanation}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SignalList title="Strengths" items={strengths.slice(0, 3)} tone="success" />
            <SignalList title="Needs Improvement" items={needsImprovement.slice(0, 3)} tone="warning" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalList({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'warning' }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  const className = tone === 'success' ? 'border-[#dcefe3] bg-[#f8fcf9] text-[#166534]' : 'border-amber-200 bg-amber-50/70 text-amber-900';
  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <p key={item} className="flex gap-2 text-sm leading-5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ScoreBreakdown({ components, total }: { components: ComponentScore[]; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>How Your Score Was Calculated</CardTitle>
        <CardDescription>Each category shows the points earned and how to interpret them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {components.map((component) => (
          <button key={component.label} type="button" className="w-full rounded-xl border border-[#ececec] bg-white p-3 text-left" onClick={() => setOpen((current) => current === component.label ? null : component.label)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[#111111]">{component.label}</p>
                <p className="text-xs leading-5 text-[#666666]">{component.explanation}</p>
              </div>
              <p className="shrink-0 font-semibold text-[#111111]">{component.earned} / {component.possible}</p>
            </div>
            <Progress value={(component.earned / component.possible) * 100} className="mt-2 h-2" indicatorClassName={component.earned / component.possible >= 0.7 ? 'bg-green-600' : component.earned > 0 ? 'bg-amber-500' : 'bg-red-500'} />
            {open === component.label ? <p className="mt-2 text-xs leading-5 text-[#555555]">{component.details}</p> : null}
          </button>
        ))}
        <div className="flex items-center justify-between rounded-xl border border-[#d8d5cf] bg-[#fbfaf8] p-3">
          <p className="font-semibold text-[#111111]">Total</p>
          <p className="text-xl font-semibold text-[#111111]">{total} / 100</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RequirementsEvidence({ rows }: { rows: RequirementRow[] }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Requirements vs Your Evidence</CardTitle>
        <CardDescription>Shows where your application is strong and where it can be improved.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div key={row.requirement} className="grid gap-2 rounded-xl border border-[#ececec] bg-white p-3 text-sm md:grid-cols-[1fr_1fr_150px_1fr]">
            <p className="font-medium text-[#111111]">{row.requirement}</p>
            <p className="leading-6 text-[#555555]">{row.evidence}</p>
            <div><Badge className={`rounded-full border px-2.5 py-0.5 ${alignmentClass(row.alignment)}`}>{row.alignment}</Badge></div>
            <p className="leading-6 text-[#555555]">{row.improvement}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EvidenceSources({ sources }: { sources: Array<{ label: string; status: SourceStatus; detail: string }> }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Evidence Used in Your Score</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => (
          <div key={source.label} className="rounded-xl border border-[#ececec] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[#111111]">{source.label}</p>
              <Badge className={`rounded-full border px-2.5 py-0.5 ${sourceStatusClass(source.status)}`}>{source.status}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#555555]">{source.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CourseworkSummary({ relevant, lessRelevant }: { relevant: string[]; lessRelevant: string[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Relevant Coursework</CardTitle>
        <CardDescription>Your transcript is summarized so the page stays readable.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {relevant.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {relevant.map((course) => <Badge key={course} variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#555555]">{course}</Badge>)}
          </div>
        ) : (
          <p className="text-sm text-[#666666]">No clearly relevant coursework was found for this posting.</p>
        )}
        {lessRelevant.length > 0 ? (
          <div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setExpanded((value) => !value)}>
              {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {expanded ? 'Hide full transcript evidence' : 'View full transcript evidence'}
            </Button>
            {expanded ? (
              <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-[#ececec] bg-white p-3 text-sm leading-6 text-[#555555]">
                {[...relevant, ...lessRelevant].map((course) => <p key={course}>{course}</p>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GithubSummary({ repos }: { repos: Array<{ name: string; description: string; language: string; topics: string[] }> }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>GitHub Evidence</CardTitle>
        <CardDescription>Stars are not treated as important evidence. Project relevance matters more.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {repos.length > 0 ? repos.map((repo) => (
          <div key={repo.name} className="rounded-xl border border-[#ececec] bg-white p-3">
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4 text-[#333333]" />
              <p className="font-semibold text-[#111111]">{repo.name}</p>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#555555]">{repo.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">{repo.language}</Badge>
              {repo.topics.map((topic) => <Badge key={topic} variant="outline" className="rounded-full">{topic}</Badge>)}
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-[#ececec] bg-white p-3 text-sm leading-6 text-[#555555]">
            GitHub was not provided or did not contain usable project evidence for this recommendation.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Improvements({ improvements }: { improvements: Improvement[] }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>How to Improve Future Scores</CardTitle>
        <CardDescription>High-impact improvements based on this recommendation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {improvements.map((item, index) => (
          <div key={`${item.title}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-950">{index + 1}. {item.title}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">{item.detail}</p>
              </div>
              <Badge className="shrink-0 rounded-full border border-amber-300 bg-white text-amber-800">+{item.gain} pts</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NextSteps({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Recommended Next Steps</CardTitle>
        <CardDescription>Use this checklist before applying again.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-[#ececec] bg-white p-3 text-left text-sm text-[#333333]"
            onClick={() => setChecked((current) => ({ ...current, [item]: !current[item] }))}
          >
            {checked[item] ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-[#999999]" />}
            <span className={checked[item] ? 'text-[#777777] line-through' : ''}>{item}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
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
  const recommendation: RecommendationDetails =
    stateRecommendation ?? {
      postingId: postingId ?? '',
      confidence: fallbackConfidence,
      reason: searchParams.get('reason') ?? '',
      score_breakdown: null,
      qualifications: [],
      fit_reasoning: [],
      gaps: [],
      recommendation: null,
    };

  const profile = (setupState?.profile ?? {}) as Record<string, unknown>;
  const rawScore = toDisplayPercent(recommendation.confidence);
  const evaluation = useMemo(
    () => buildEvaluation({ score: rawScore, posting, recommendation, profile }),
    [rawScore, posting, recommendation, profile]
  );

  return (
    <div className="app-shell min-h-screen px-4 py-7">
      <main className="mx-auto max-w-6xl space-y-5">
        <Button variant="outline" className="w-fit rounded-xl bg-white" onClick={() => navigate('/student/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to AI Recommendations
        </Button>

        {!posting ? (
          <Card className="dashboard-surface rounded-2xl">
            <CardContent className="py-12 text-center text-sm text-[#666666]">This recommendation is no longer available.</CardContent>
          </Card>
        ) : (
          <>
            <ApplicationFitSummary
              score={evaluation.finalScore}
              fitLevel={evaluation.fitLevel}
              explanation={evaluation.explanation}
              strengths={evaluation.strengths}
              needsImprovement={evaluation.needsImprovement}
              posting={posting}
            />

            <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <ScoreBreakdown components={evaluation.components} total={evaluation.finalScore} />
              <RequirementsEvidence rows={evaluation.requirements} />
            </div>

            <EvidenceSources sources={evaluation.sources} />

            <div className="grid gap-5 lg:grid-cols-2">
              <CourseworkSummary relevant={evaluation.relevantCourses} lessRelevant={evaluation.lessRelevantCourses} />
              <GithubSummary repos={evaluation.githubRepos} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <Improvements improvements={evaluation.improvements} />
              <NextSteps items={evaluation.checklist} />
            </div>

            <Card className="dashboard-surface rounded-2xl">
              <CardContent className="flex flex-col gap-3 p-4 text-sm leading-6 text-[#555555] md:flex-row md:items-center">
                <Info className="h-5 w-5 shrink-0 text-blue-600" />
                <p>
                  This page summarizes the evidence used for your score and the most useful next steps. Detailed records stay tucked away unless you choose to expand them.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileQuestion,
  FileSearch,
  Github,
  GraduationCap,
  HelpCircle,
  Linkedin,
  MessageSquare,
  ShieldCheck,
  Target,
  XCircle,
} from 'lucide-react';

import { useData, type Application, type ResearchPosting } from '../../contexts/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';

type FitLevel = 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit' | 'Low Fit';
type AlignmentLevel = 'Strong Alignment' | 'Moderate Alignment' | 'Limited Alignment' | 'No Evidence';
type EvidenceStrength = 'Strong' | 'Moderate' | 'Limited' | 'Missing';
type SourceKind = 'Resume' | 'Transcript' | 'GitHub' | 'LinkedIn' | 'Progress Reports' | 'Faculty Verification';

type ScoreComponent = {
  key: string;
  label: string;
  earned: number;
  possible: number;
  explanation: string;
};

type RequirementAlignment = {
  requirement: string;
  alignment: AlignmentLevel;
  evidence: string;
  gap: string;
};

type EvidenceSource = {
  source: SourceKind;
  used: boolean;
  contribution: string;
  strength: EvidenceStrength;
};

type Evaluation = {
  finalScore: number;
  fitLevel: FitLevel;
  recommendationSentence: string;
  strengths: string[];
  concerns: string[];
  components: ScoreComponent[];
  requirements: RequirementAlignment[];
  sources: EvidenceSource[];
  relevantCourses: string[];
  lessRelevantCourses: string[];
  areasToStrengthen: string[];
  decisionAction: string;
  decisionWhy: string;
  interviewQuestions: string[];
};

const COMPONENT_WEIGHTS = {
  requirementMatch: 40,
  researchEvidence: 20,
  technicalSkills: 15,
  coursework: 10,
  evidenceQuality: 10,
  writingQuality: 5,
};

const PLACEHOLDER_PATTERNS = [
  /up to \d+ concise/i,
  /up to \d+ constructive/i,
  /short exact evidence phrase/i,
  /\b(?:student_role|skills_needed|fit_reasoning|required_qualifications|preferred_qualifications)\b/i,
];

function cleanText(value: string) {
  return value
    .replace(/\bstudent_role\b/gi, 'Student background')
    .replace(/\bskills_needed\b/gi, 'Required skills')
    .replace(/\brequired_qualifications\b/gi, 'Required qualifications')
    .replace(/\bpreferred_qualifications\b/gi, 'Preferred qualifications')
    .trim();
}

function isUsableText(value: string) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function splitItems(value: string) {
  return value
    .split(/\n|;|\||\.(?=\s+[A-Z0-9])/)
    .map((entry) => cleanText(entry.replace(/^[-*\d)\s]+/, '').trim()))
    .filter((entry) => entry.length >= 4)
    .filter(isUsableText);
}

function tokenize(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .filter(
      (word) =>
        ![
          'and',
          'the',
          'for',
          'with',
          'from',
          'this',
          'that',
          'role',
          'student',
          'research',
          'project',
          'experience',
          'work',
          'using',
        ].includes(word)
    );
}

function overlap(requirement: string, evidence: string) {
  const reqTokens = new Set(tokenize(requirement));
  const evidenceTokens = new Set(tokenize(evidence));
  let score = 0;
  reqTokens.forEach((token) => {
    if (evidenceTokens.has(token)) score += 1;
  });
  return score;
}

function courseLabel(course: Application['coursework'][number]) {
  if (typeof course === 'string') return course.trim();
  return [course.courseNumber, course.courseName].filter(Boolean).join(' - ').trim();
}

function classifyFit(score: number): FitLevel {
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

function evidenceBadgeClass(strength: EvidenceStrength | AlignmentLevel) {
  if (strength === 'Strong' || strength === 'Strong Alignment') return 'status-success';
  if (strength === 'Moderate' || strength === 'Moderate Alignment') return 'status-info';
  if (strength === 'Limited' || strength === 'Limited Alignment') return 'status-warning';
  return 'status-danger';
}

function alignmentScore(alignment: AlignmentLevel) {
  if (alignment === 'Strong Alignment') return 1;
  if (alignment === 'Moderate Alignment') return 0.6;
  if (alignment === 'Limited Alignment') return 0.25;
  return 0;
}

function buildRequirementText(posting?: ResearchPosting) {
  if (!posting) return [];
  const structured = [
    ...splitItems(posting.requiredQualifications),
    ...splitItems(posting.preferredQualifications),
    ...splitItems(posting.studentRoleDescription),
  ];
  const fromSkills = posting.skillsNeeded.map((skill) => `${skill} experience or preparation`);
  return [...structured, ...fromSkills]
    .filter((item, index, arr) => arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 8);
}

function inferCourseRelevance(courses: string[], posting?: ResearchPosting) {
  const projectText = [
    posting?.title,
    posting?.overview,
    posting?.category,
    ...(posting?.researchAreas ?? []),
    ...(posting?.skillsNeeded ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  const scored = courses.map((course) => ({
    course,
    score:
      overlap(projectText, course) +
      (/\b(probability|statistics|regression|data|machine learning|ai|programming|sql|database|linear algebra|nlp|vision|robotics|computing)\b/i.test(course)
        ? 2
        : 0),
  }));

  const relevant = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.course)
    .slice(0, 6);
  const lessRelevant = courses.filter((course) => !relevant.includes(course));
  return { relevant, lessRelevant };
}

function evaluateRequirement(requirement: string, evidenceText: string, courseworkText: string, githubProvided: boolean): RequirementAlignment {
  const evidenceOverlap = overlap(requirement, evidenceText);
  const courseOverlap = overlap(requirement, courseworkText);
  const normalizedRequirement = requirement.toLowerCase();

  const hasDirectEvidence = evidenceOverlap >= 3;
  const hasRelatedEvidence = evidenceOverlap >= 1 || courseOverlap >= 2;
  const hasWeakEvidence = courseOverlap >= 1 || /research|analysis|programming|software|data/.test(evidenceText.toLowerCase());

  if (hasDirectEvidence) {
    return {
      requirement,
      alignment: 'Strong Alignment',
      evidence: `Direct evidence overlaps with this requirement through the resume/application materials and ${courseOverlap > 0 ? 'related coursework' : 'submitted statement'}.`,
      gap: 'Validate depth and independence during interview.',
    };
  }

  if (hasRelatedEvidence) {
    const githubNote = githubProvided
      ? ' GitHub may provide related project context, but the submitted evidence is not direct enough to mark this strongly met.'
      : '';
    return {
      requirement,
      alignment: 'Moderate Alignment',
      evidence: `Related evidence exists, especially through coursework or general project preparation.${githubNote}`,
      gap: `Ask for a concrete example proving ${cleanText(requirement).toLowerCase()}.`,
    };
  }

  if (hasWeakEvidence) {
    return {
      requirement,
      alignment: 'Limited Alignment',
      evidence: 'Only indirect preparation was found. This does not strongly satisfy the requirement.',
      gap: `No direct artifact or coursework clearly proves ${cleanText(requirement).toLowerCase()}.`,
    };
  }

  return {
    requirement,
    alignment: 'No Evidence',
    evidence: 'No clear evidence was found in the submitted application materials.',
    gap: `Collect evidence for ${cleanText(requirement).toLowerCase()} before relying on this requirement.`,
  };
}

function evaluateApplication({
  application,
  posting,
  fallbackScore,
}: {
  application?: Application;
  posting?: ResearchPosting;
  fallbackScore: number;
}): Evaluation {
  const quickNote = application?.quickNote?.trim() ?? '';
  const answerText = Object.values(application?.answers ?? {}).join(' ');
  const coursework = (application?.coursework ?? []).map(courseLabel).filter(Boolean);
  const { relevant, lessRelevant } = inferCourseRelevance(coursework, posting);
  const requirements = buildRequirementText(posting);
  const resumeName = application?.resume?.name ?? '';
  const evidenceText = [
    application?.studentMajor,
    resumeName,
    quickNote,
    answerText,
    relevant.join(' '),
    posting?.skillsNeeded.join(' '),
  ]
    .filter(Boolean)
    .join(' ');
  const courseworkText = coursework.join(' ');
  const githubProvided = false;
  const linkedinProvided = false;
  const progressProvided = false;
  const facultyProvided = false;

  const requirementRows =
    requirements.length > 0
      ? requirements.map((requirement) => evaluateRequirement(requirement, evidenceText, courseworkText, githubProvided))
      : [
          {
            requirement: 'Project requirements were not specified',
            alignment: 'No Evidence' as AlignmentLevel,
            evidence: 'This posting does not include structured requirements, so requirement match could not be scored from direct criteria.',
            gap: 'Add required and preferred qualifications to make future scoring more precise.',
          },
        ];

  const requirementRatio =
    requirements.length > 0
      ? requirementRows.reduce((sum, row) => sum + alignmentScore(row.alignment), 0) / requirementRows.length
      : 0;
  const requirementPoints = Math.round(requirementRatio * COMPONENT_WEIGHTS.requirementMatch);

  const researchEvidenceSignals = [
    /\bresearch|lab|paper|publication|poster|study|experiment|dataset|analysis\b/i.test(evidenceText),
    progressProvided,
    facultyProvided,
  ].filter(Boolean).length;
  const researchEvidencePoints = Math.round((researchEvidenceSignals / 3) * COMPONENT_WEIGHTS.researchEvidence);

  const requestedSkills = posting?.skillsNeeded ?? [];
  const matchedSkills = requestedSkills.filter((skill) => overlap(skill, evidenceText) > 0).length;
  const technicalSkillRatio = requestedSkills.length > 0 ? matchedSkills / requestedSkills.length : 0;
  const technicalSkillPoints = Math.round(technicalSkillRatio * COMPONENT_WEIGHTS.technicalSkills);

  const courseworkPoints = Math.round(Math.min(1, relevant.length / 4) * COMPONENT_WEIGHTS.coursework);

  const evidenceSourcesUsed = [
    Boolean(resumeName),
    coursework.length > 0,
    quickNote.length > 0 || answerText.length > 0,
    githubProvided,
    linkedinProvided,
    progressProvided,
    facultyProvided,
  ].filter(Boolean).length;
  const evidenceQualityPoints = Math.round(Math.min(1, evidenceSourcesUsed / 5) * COMPONENT_WEIGHTS.evidenceQuality);

  const statementLength = `${quickNote} ${answerText}`.trim().length;
  const writingQualityPoints =
    statementLength >= 160 ? 5 : statementLength >= 80 ? 4 : statementLength >= 30 ? 2 : 0;

  const computedScore =
    requirementPoints +
    researchEvidencePoints +
    technicalSkillPoints +
    courseworkPoints +
    evidenceQualityPoints +
    writingQualityPoints;
  const finalScore = requirements.length > 0 || evidenceSourcesUsed > 0 ? computedScore : Math.max(0, Math.min(39, fallbackScore));
  const fitLevel = classifyFit(finalScore);

  const strongCount = requirementRows.filter((row) => row.alignment === 'Strong Alignment').length;
  const partialCount = requirementRows.filter((row) => row.alignment === 'Moderate Alignment' || row.alignment === 'Limited Alignment').length;
  const missingCount = requirementRows.filter((row) => row.alignment === 'No Evidence').length;

  const strengths = [
    relevant.length > 0 ? `Relevant coursework appears in ${relevant.slice(0, 2).join(', ')}.` : '',
    technicalSkillPoints > 0 ? `${matchedSkills} required skill${matchedSkills === 1 ? '' : 's'} have at least related evidence.` : '',
    writingQualityPoints >= 4 ? 'The application statement gives usable context for professor review.' : '',
  ].filter(Boolean);

  const concerns = [
    strongCount === 0 ? 'No project requirement is strongly met by direct evidence.' : '',
    missingCount > 0 ? `${missingCount} requirement${missingCount === 1 ? ' is' : 's are'} missing clear evidence.` : '',
    !githubProvided ? 'GitHub was not provided, so code/project depth was not included in this score.' : '',
    researchEvidencePoints < 10 ? 'Research experience evidence is limited or indirect.' : '',
  ].filter(Boolean);

  const areasToStrengthen = [
    ...requirementRows
      .filter((row) => row.alignment !== 'Strong Alignment')
      .map((row) => row.gap)
      .slice(0, 5),
    !githubProvided ? 'Add a GitHub project or artifact that demonstrates relevant technical work.' : '',
    relevant.length < 2 ? 'Add clearer transcript or coursework evidence tied to this research area.' : '',
    writingQualityPoints < 4 ? 'Add a more specific research statement with methods, datasets, or project outcomes.' : '',
  ].filter(Boolean);

  const decisionAction = finalScore >= 70 ? 'Interview' : finalScore >= 55 ? 'Interview if mentoring capacity exists' : finalScore >= 40 ? 'Waitlist' : 'Pass';
  const decisionWhy =
    finalScore >= 70
      ? 'The candidate has enough direct or related evidence to justify a focused interview.'
      : finalScore >= 55
        ? 'The candidate has plausible preparation, but key requirements need validation before acceptance.'
        : finalScore >= 40
          ? 'The candidate has limited evidence and should be considered only after stronger applicants are reviewed.'
          : 'The submitted materials do not currently support the research requirements.';

  const interviewQuestions = [
    ...requirementRows
      .filter((row) => row.alignment !== 'Strong Alignment')
      .slice(0, 3)
      .map((row) => `Can you describe concrete experience with ${row.requirement.toLowerCase()}?`),
    'Which prior project best demonstrates your readiness for this research position?',
    'What support would you need in the first month to contribute independently?',
  ].slice(0, 5);

  return {
    finalScore,
    fitLevel,
    recommendationSentence:
      `${fitLevel} - ${finalScore}/100. ` +
      (fitLevel === 'Strong Fit' || fitLevel === 'Good Fit'
        ? 'The candidate shows credible preparation for this research position, with remaining details to validate in interview.'
        : 'The candidate shows some preparation, but direct evidence is missing for important research requirements.'),
    strengths: strengths.length > 0 ? strengths : ['The application includes enough basic profile information to begin review.'],
    concerns: concerns.length > 0 ? concerns : ['No major concerns were detected from the available evidence.'],
    components: [
      { key: 'requirementMatch', label: 'Requirement Match', earned: requirementPoints, possible: 40, explanation: `${strongCount} strongly met, ${partialCount} partially met, ${missingCount} missing evidence.` },
      { key: 'researchEvidence', label: 'Research Experience / Project Evidence', earned: researchEvidencePoints, possible: 20, explanation: 'Based on research, lab, project, dataset, publication, or progress-report evidence.' },
      { key: 'technicalSkills', label: 'Technical Skills', earned: technicalSkillPoints, possible: 15, explanation: `${matchedSkills} of ${requestedSkills.length || 0} requested skills had related evidence.` },
      { key: 'coursework', label: 'Coursework / Academic Preparation', earned: courseworkPoints, possible: 10, explanation: `${relevant.length} relevant courses found.` },
      { key: 'evidenceQuality', label: 'Evidence Quality', earned: evidenceQualityPoints, possible: 10, explanation: `${evidenceSourcesUsed} usable evidence source${evidenceSourcesUsed === 1 ? '' : 's'} contributed.` },
      { key: 'writingQuality', label: 'Writing / Statement Quality', earned: writingQualityPoints, possible: 5, explanation: statementLength > 0 ? 'Based on specificity and usefulness of written application context.' : 'No written statement was available.' },
    ],
    requirements: requirementRows,
    sources: [
      { source: 'Resume', used: Boolean(resumeName), contribution: resumeName ? `${resumeName} provided the baseline application artifact.` : 'No resume file name was available.', strength: resumeName ? 'Moderate' : 'Missing' },
      { source: 'Transcript', used: coursework.length > 0, contribution: coursework.length > 0 ? `${relevant.length} relevant courses summarized from submitted coursework.` : 'Transcript/coursework was not provided, so it was not included in this score.', strength: relevant.length >= 3 ? 'Strong' : coursework.length > 0 ? 'Moderate' : 'Missing' },
      { source: 'GitHub', used: githubProvided, contribution: 'GitHub was not provided, so stars, repositories, commits, and languages were not included in this score.', strength: 'Missing' },
      { source: 'LinkedIn', used: linkedinProvided, contribution: 'LinkedIn was not provided, so professional context was not included in this score.', strength: 'Missing' },
      { source: 'Progress Reports', used: progressProvided, contribution: 'No verified progress reports were available for this applicant in this context.', strength: 'Missing' },
      { source: 'Faculty Verification', used: facultyProvided, contribution: 'No faculty verification was available for this applicant in this context.', strength: 'Missing' },
    ],
    relevantCourses: relevant,
    lessRelevantCourses: lessRelevant,
    areasToStrengthen,
    decisionAction,
    decisionWhy,
    interviewQuestions,
  };
}

function FitBadge({ level }: { level: FitLevel }) {
  return <Badge className={`rounded-full border px-3 py-1 ${fitBadgeClass(level)}`}>{level}</Badge>;
}

function EvidenceStrengthBadge({ strength }: { strength: EvidenceStrength | AlignmentLevel }) {
  return <Badge className={`rounded-full border px-2.5 py-0.5 text-xs ${evidenceBadgeClass(strength)}`}>{strength}</Badge>;
}

function FitSummaryHeader({
  studentName,
  studentMajor,
  project,
  evaluation,
}: {
  studentName: string;
  studentMajor: string;
  project: string;
  evaluation: Evaluation;
}) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[260px_1fr]">
        <div className="rounded-2xl border border-[#ececec] bg-[#fbfaf8] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Candidate Fit Summary</p>
          <p className="mt-3 text-5xl font-semibold tracking-tight text-[#111111]">{evaluation.finalScore}</p>
          <p className="text-sm text-[#666666]">/100 confidence score</p>
          <div className="mt-4">
            <FitBadge level={evaluation.fitLevel} />
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">{studentName}</h1>
            <p className="mt-1 text-sm text-[#666666]">{studentMajor} - {project}</p>
            <p className="mt-3 text-sm leading-6 text-[#333333]">{evaluation.recommendationSentence}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#e8eee9] bg-[#f8fcf9] p-3">
              <p className="text-sm font-semibold text-[#166534]">Key strengths</p>
              <ul className="mt-2 space-y-1 text-sm leading-5 text-[#31533c]">
                {evaluation.strengths.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-sm font-semibold text-amber-900">Main concerns</p>
              <ul className="mt-2 space-y-1 text-sm leading-5 text-amber-900">
                {evaluation.concerns.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBreakdownCard({ components, total }: { components: ScoreComponent[]; total: number }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Score Breakdown</CardTitle>
        <CardDescription>Deterministic weighted calculation used for this research fit score.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {components.map((component) => (
          <div key={component.key} className="rounded-xl border border-[#ececec] bg-white p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-[#111111]">{component.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-[#666666]">{component.explanation}</p>
              </div>
              <p className="shrink-0 font-semibold text-[#111111]">{component.earned}/{component.possible}</p>
            </div>
            <Progress value={(component.earned / component.possible) * 100} className="mt-2 h-2" indicatorClassName={component.earned === 0 ? 'bg-red-500' : component.earned / component.possible >= 0.7 ? 'bg-green-600' : 'bg-amber-500'} />
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl border border-[#d8d5cf] bg-[#fbfaf8] p-3">
          <p className="font-semibold text-[#111111]">Total</p>
          <p className="text-xl font-semibold text-[#111111]">{total}/100</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RequirementAlignmentTable({ rows }: { rows: RequirementAlignment[] }) {
  const stronglyMet = rows.filter((row) => row.alignment === 'Strong Alignment').length;
  const partiallyMet = rows.filter((row) => row.alignment === 'Moderate Alignment' || row.alignment === 'Limited Alignment').length;
  const missing = rows.filter((row) => row.alignment === 'No Evidence').length;

  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Requirement Alignment</CardTitle>
        <CardDescription>Moderate and limited alignment are partial evidence, not strongly met requirements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Strongly Met" value={stronglyMet} tone="success" />
          <SummaryMetric label="Partially Met" value={partiallyMet} tone="warning" />
          <SummaryMetric label="Missing Evidence" value={missing} tone="danger" />
        </div>
        <div className="overflow-hidden rounded-xl border border-[#ececec]">
          <div className="hidden grid-cols-[1.1fr_0.7fr_1.2fr_1.2fr] gap-3 bg-[#fbfaf8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#777777] md:grid">
            <span>Requirement</span>
            <span>Alignment</span>
            <span>Evidence</span>
            <span>Gap</span>
          </div>
          {rows.map((row) => (
            <div key={row.requirement} className="grid gap-2 border-t border-[#eeeeee] px-4 py-3 text-sm md:grid-cols-[1.1fr_0.7fr_1.2fr_1.2fr]">
              <p className="font-medium text-[#111111]">{row.requirement}</p>
              <div><EvidenceStrengthBadge strength={row.alignment} /></div>
              <p className="leading-6 text-[#444444]">{row.evidence}</p>
              <p className="leading-6 text-[#666666]">{row.gap}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
  const className = tone === 'success' ? 'status-success' : tone === 'warning' ? 'status-warning' : 'status-danger';
  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-[0.12em]">{label}</p>
    </div>
  );
}

function EvidenceSourceCard({ source }: { source: EvidenceSource }) {
  const Icon =
    source.source === 'GitHub'
      ? Github
      : source.source === 'LinkedIn'
        ? Linkedin
        : source.source === 'Transcript'
          ? GraduationCap
          : source.source === 'Progress Reports'
            ? FileSearch
            : source.source === 'Faculty Verification'
              ? ShieldCheck
              : FileSearch;
  return (
    <div className="rounded-xl border border-[#ececec] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#555555]" />
          <p className="font-semibold text-[#111111]">{source.source}</p>
        </div>
        <Badge variant="outline" className="rounded-full">{source.used ? 'Used in score' : 'Not used'}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#555555]">{source.contribution}</p>
      <div className="mt-2">
        <EvidenceStrengthBadge strength={source.strength} />
      </div>
    </div>
  );
}

function CourseworkEvidenceSummary({
  relevant,
  lessRelevant,
}: {
  relevant: string[];
  lessRelevant: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Coursework Evidence</CardTitle>
        <CardDescription>Transcript evidence is summarized instead of dumped into the page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-[#111111]">Relevant Coursework</p>
          {relevant.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {relevant.slice(0, 6).map((course) => (
                <Badge key={course} variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#555555]">{course}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#666666]">No clearly relevant coursework was found.</p>
          )}
        </div>
        {lessRelevant.length > 0 ? (
          <div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setExpanded((value) => !value)}>
              {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {expanded ? 'Hide full transcript evidence' : 'View full transcript evidence'}
            </Button>
            {expanded ? (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[#ececec] bg-white p-3 text-sm leading-6 text-[#555555]">
                {[...relevant, ...lessRelevant].map((course) => <p key={course}>{course}</p>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GitHubEvidenceSummary() {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>GitHub Evidence</CardTitle>
        <CardDescription>Repository evidence is evaluated by relevance, languages, project names, and activity. Stars are not used as a major signal.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-[#ececec] bg-white p-3 text-sm leading-6 text-[#555555]">
          GitHub was not provided, so repositories, languages, README quality, commits, topics, and recent activity were not included in this score.
        </div>
      </CardContent>
    </Card>
  );
}

function AreasToStrengthenCard({ items }: { items: string[] }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Areas to Strengthen</CardTitle>
        <CardDescription>Specific missing evidence that would raise confidence for this research position.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 7).map((item) => (
          <div key={item} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm leading-6 text-amber-900">
            <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProfessorDecisionSupportCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Professor Decision Support</CardTitle>
        <CardDescription>Suggested action and interview prompts based on this research-fit evidence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-[#ececec] bg-[#fbfaf8] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777777]">Recommended Action</p>
          <p className="mt-1 text-xl font-semibold text-[#111111]">{evaluation.decisionAction}</p>
          <p className="mt-2 text-sm leading-6 text-[#555555]">{evaluation.decisionWhy}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111111]">Suggested interview questions</p>
          <div className="mt-2 space-y-2">
            {evaluation.interviewQuestions.map((question) => (
              <div key={question} className="flex gap-2 rounded-xl border border-[#ececec] bg-white p-3 text-sm text-[#444444]">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>{question}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicantReasoningPage() {
  const { applications, postings } = useData();
  const navigate = useNavigate();
  const { applicantId } = useParams();
  const [searchParams] = useSearchParams();

  const application = useMemo(() => applications.find((entry) => entry.id === applicantId), [applications, applicantId]);
  const posting = application ? postings.find((entry) => entry.id === application.postingId) : undefined;

  const fallbackScore = Number(searchParams.get('score') ?? '0') || 0;
  const studentName = application?.studentName ?? searchParams.get('name') ?? 'Unknown Student';
  const studentMajor = application?.studentMajor ?? searchParams.get('major') ?? 'Unknown Major';
  const project = posting?.title ?? searchParams.get('project') ?? 'Unknown Research Position';
  const status = application?.status ?? searchParams.get('status') ?? 'Pending';
  const submittedAt = application?.submittedAt ?? searchParams.get('submittedAt') ?? '';

  const evaluation = useMemo(
    () => evaluateApplication({ application, posting, fallbackScore }),
    [application, posting, fallbackScore]
  );

  return (
    <div className="app-shell min-h-screen px-4 py-7">
      <main className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" className="w-fit rounded-xl bg-white" onClick={() => navigate('/professor/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Professor Dashboard
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#666666]">
            <Badge variant="outline" className="rounded-full bg-white">Status: {status}</Badge>
            <Badge variant="outline" className="rounded-full bg-white">
              Submitted: {submittedAt ? new Date(submittedAt).toLocaleDateString() : 'Unknown'}
            </Badge>
          </div>
        </div>

        {!application ? (
          <Card className="dashboard-surface rounded-2xl">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <FileQuestion className="h-8 w-8 text-[#777777]" />
              <p className="font-semibold text-[#111111]">Application data is unavailable</p>
              <p className="max-w-xl text-sm leading-6 text-[#666666]">
                The confidence explanation could not find the application record. Return to the dashboard and open the reasoning page from an applicant row.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <FitSummaryHeader studentName={studentName} studentMajor={studentMajor} project={project} evaluation={evaluation} />

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <ScoreBreakdownCard components={evaluation.components} total={evaluation.finalScore} />
              <RequirementAlignmentTable rows={evaluation.requirements} />
            </div>

            <Card className="dashboard-surface rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle>Evidence Signals</CardTitle>
                <CardDescription>Each source shows whether it contributed to the score and how strong that evidence was.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {evaluation.sources.map((source) => <EvidenceSourceCard key={source.source} source={source} />)}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <CourseworkEvidenceSummary relevant={evaluation.relevantCourses} lessRelevant={evaluation.lessRelevantCourses} />
              <GitHubEvidenceSummary />
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <AreasToStrengthenCard items={evaluation.areasToStrengthen} />
              <ProfessorDecisionSupportCard evaluation={evaluation} />
            </div>

            <Card className="dashboard-surface rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-red-700" />
                  Calculation Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-[#555555]">
                This score is deterministic and calculated from weighted components: Requirement Match 40%,
                Research Experience / Project Evidence 20%, Technical Skills 15%, Coursework 10%, Evidence Quality 10%,
                and Writing / Statement Quality 5%. Components with no evidence receive no points.
                <a className="ml-1 inline-flex items-center gap-1 text-red-700 underline-offset-2 hover:underline" href="#top">
                  Review evidence <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

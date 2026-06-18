import { useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData, type ResearchPosting } from '../../contexts/DataContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

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
  recommendation: FitLabel | null;
  githubData?: GitHubData | null;
};

type GitHubRepoEvidence = {
  name?: string;
  description?: string;
  language?: string;
  topics?: string[];
  html_url?: string;
  url?: string;
};

type GitHubData = {
  username?: string;
  profile_url?: string;
  top_repos?: GitHubRepoEvidence[];
  repositories?: GitHubRepoEvidence[];
  repos?: GitHubRepoEvidence[];
};

type FitLabel = 'Excellent Match' | 'Strong Match' | 'Good Match' | 'Possible Match' | 'Low Match' | 'Strong Fit' | 'Good Fit' | 'Possible Fit' | 'Weak Fit' | 'Low Fit';
type RequirementFitLevel = 'strong_match' | 'moderate_match' | 'limited_evidence' | 'no_evidence';
type EvidenceSource = 'resume' | 'github' | 'linkedin' | 'transcript' | 'progress_report' | 'research_project' | 'faculty_verification';

type EvidenceItem = {
  source: EvidenceSource;
  label: string;
  quote?: string;
  location?: string;
  url?: string;
};

type RequirementReasoning = {
  requirement: string;
  fitLevel: RequirementFitLevel;
  explanation: string;
  evidence: EvidenceItem[];
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
  [/_/g, ' '],
];

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  resume: 'Resume',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  transcript: 'Transcript',
  progress_report: 'Progress Report',
  research_project: 'Research Project',
  faculty_verification: 'Faculty Verification',
};

const CONCEPT_SYNONYMS: Record<string, string[]> = {
  python: ['python', 'py'],
  programming: ['programming', 'coding', 'software', 'javascript', 'typescript', 'java', 'c++', 'c/c++', 'react', 'node', 'fundamentals of programming', 'fndmtls of pgmg', 'imperative computation', 'imprtv comptatn'],
  data_structures: ['data structures', 'algorithms', 'imperative computation', 'imprtv comptatn', 'computer science', 'fundamentals of programming', 'fndmtls of pgmg', 'programming fundamentals'],
  computer_systems: ['computer systems', 'cmptr systems', 'systems'],
  nlp: ['nlp', 'natural language processing', 'natural language pr', 'language processing', 'language models', 'llm', 'llms'],
  transformers: ['transformer', 'transformers', 'bert', 'attention', 'language model', 'llm', 'llms', 'deep learning', 'deep lrng', 'natural language processing', 'ai/ml'],
  information_retrieval: ['information retrieval', 'info retrieval', 'retrieval', 'search systems', 'search', 'retrieval systems', 'literature search'],
  evaluation: ['evaluation', 'evaluate', 'benchmarking', 'benchmark', 'metrics', 'testing', 'experiments', 'experimental', 'analysis', 'model evaluation'],
  ai_ml: ['ai/ml', 'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'deep lrng', 'pytorch', 'neural networks'],
  statistics: ['statistics', 'statistical', 'probability', 'prob stat', 'prob & stat', 'reasoning data', 'reasoning with data', 'data analysis', 'analytics', 'metrics'],
  sql_data: ['sql', 'database', 'data modeling', 'data cleansing', 'data transformation', 'data analysis', 'pandas', 'power bi', 'tableau'],
};

const COURSE_TITLE_EXPANSIONS: Array<[RegExp, string]> = [
  [/15110\s*PRINCPLS OF COMPUTNG/i, '15110 - Principles of Computing'],
  [/15112\s*FNDMTLS OF PGMG\s*(?:AND|&)\s*CS/i, '15112 - Fundamentals of Programming and Computer Science'],
  [/15122\s*PRIN IMPRTV COMPTATN/i, '15122 - Principles of Imperative Computation'],
  [/18213\s*INTR CMPTR SYSTEMS/i, '18213 - Introduction to Computer Systems'],
  [/07280\s*AI\/ML I/i, '07280 - AI/ML I'],
  [/11411\s*NATURAL LANGUAGE PR/i, '11411 - Natural Language Processing'],
  [/11485\s*INTRO\.?\s*DEEP LRNG\.?/i, '11485 - Introduction to Deep Learning'],
  [/36200\s*REASONING DATA/i, '36200 - Reasoning with Data'],
  [/36235\s*PROB\s*(?:AND|&)\s*STAT INF I/i, '36235 - Probability and Statistical Inference I'],
  [/36236\s*PROB\s*(?:AND|&)\s*STAT INF II/i, '36236 - Probability and Statistical Inference II'],
];

function cleanText(value: unknown) {
  return INTERNAL_FIELD_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatch(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\sa-z0-9+#/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasNormalizedPhrase(value: string, phrase: string) {
  const normalizedPhrase = normalizeForMatch(phrase);
  if (!normalizedPhrase) return false;
  if (normalizedPhrase.length <= 3) {
    return new RegExp(`(^|\\s)${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(value);
  }
  return value.includes(normalizedPhrase);
}

function isUsefulText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function toStringList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(toStringList).map(cleanText).filter(isUsefulText);
  }
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return [];
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

function tokenize(value: unknown) {
  return normalizeForMatch(value)
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .filter((word) => !['and', 'the', 'for', 'with', 'from', 'this', 'that', 'your', 'role', 'student', 'research', 'project', 'position', 'experience'].includes(word));
}

function getConcepts(value: unknown) {
  const normalized = normalizeForMatch(value);
  const concepts = new Set<string>();
  Object.entries(CONCEPT_SYNONYMS).forEach(([concept, synonyms]) => {
    if (synonyms.some((synonym) => hasNormalizedPhrase(normalized, synonym))) {
      concepts.add(concept);
    }
  });
  return concepts;
}

function conceptOverlap(requirement: string, evidence: unknown) {
  const requirementConcepts = getConcepts(requirement);
  const evidenceConcepts = getConcepts(evidence);
  const shared = Array.from(requirementConcepts).filter((concept) => evidenceConcepts.has(concept));
  return {
    requirementConcepts,
    evidenceConcepts,
    shared,
    coverage: requirementConcepts.size > 0 ? shared.length / requirementConcepts.size : 0,
  };
}

function overlapCount(requirement: string, evidence: unknown) {
  const req = new Set(tokenize(requirement));
  const evidenceTokens = new Set(tokenize(evidence));
  let score = 0;
  req.forEach((token) => {
    if (evidenceTokens.has(token)) score += 1;
  });
  return score;
}

function hasAdequateEvidenceOverlap(requirement: string, evidence: unknown) {
  const concepts = conceptOverlap(requirement, evidence);
  if (concepts.requirementConcepts.size > 0 && concepts.shared.length > 0) return true;
  const requirementTokens = getRequirementTokens(requirement);
  const overlap = overlapCount(requirement, evidence);
  if (requirementTokens.length <= 2) return overlap >= 1;
  return overlap >= Math.min(2, requirementTokens.length);
}

function expandCourseLabel(label: string) {
  const normalized = normalizeForMatch(label);
  const exactExpansion = COURSE_TITLE_EXPANSIONS.find(([pattern]) => pattern.test(normalized));
  if (exactExpansion) return exactExpansion[1];
  return cleanText(label);
}

function courseLabel(course: unknown) {
  if (typeof course === 'string') return expandCourseLabel(course);
  if (course && typeof course === 'object') {
    const row = course as { courseNumber?: string; courseName?: string; semester?: string };
    return expandCourseLabel([row.courseNumber, row.courseName].filter(Boolean).join(' - ').trim());
  }
  return '';
}

function getTranscriptCourseLabels(profile: Record<string, unknown>) {
  const labels = Array.isArray(profile.coursework) ? profile.coursework.map(courseLabel).filter(Boolean) : [];
  const transcriptText = cleanText(profile.transcriptText);
  COURSE_TITLE_EXPANSIONS.forEach(([pattern, expansion]) => {
    if (pattern.test(normalizeForMatch(transcriptText))) labels.push(expansion);
  });
  return Array.from(new Set(labels));
}

function toDisplayScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
}

function getFitLabel(score: number, recommendation?: FitLabel | null): string {
  if (recommendation) {
    return recommendation.replace('Strong Fit', 'Strong Match').replace('Good Fit', 'Good Match').replace('Possible Fit', 'Possible Match').replace('Weak Fit', 'Low Match');
  }
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Strong Match';
  if (score >= 65) return 'Good Match';
  if (score >= 50) return 'Possible Match';
  return 'Low Match';
}

function fitBadgeClass(label: string) {
  if (/Excellent|Strong/.test(label)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (/Good/.test(label)) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (/Possible/.test(label)) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function requirementFitLabel(level: RequirementFitLevel) {
  if (level === 'strong_match') return 'Strong Match';
  if (level === 'moderate_match') return 'Moderate Match';
  if (level === 'limited_evidence') return 'Limited Evidence';
  return 'No Evidence';
}

function requirementFitClass(level: RequirementFitLevel) {
  if (level === 'strong_match') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (level === 'moderate_match') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (level === 'limited_evidence') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function splitRequirements(posting: ResearchPosting | null) {
  if (!posting) return [];
  const structured = [
    ...toStringList(posting.requiredQualifications),
    ...toStringList(posting.preferredQualifications),
    ...toStringList(posting.studentRoleDescription),
  ];
  const skills = (posting.skillsNeeded ?? []).map((skill) => `${skill} experience`);
  return [...structured, ...skills]
    .filter((item, index, arr) => arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 7);
}

function getRequirementTokens(requirement: string) {
  return tokenize(requirement);
}

function addUniqueEvidence(items: EvidenceItem[], item: EvidenceItem) {
  const quote = cleanText(item.quote);
  const url = cleanText(item.url);
  const location = cleanText(item.location);
  if (!quote) return;
  if (!location && !url) return;
  if (!item.source || !cleanText(item.label)) return;
  const normalized = { ...item, quote: quote || undefined, url: url || undefined, location: location || undefined };
  const key = `${normalized.source}-${normalized.label}-${normalized.quote ?? ''}-${normalized.url ?? ''}-${normalized.location ?? ''}`;
  if (!items.some((existing) => `${existing.source}-${existing.label}-${existing.quote ?? ''}` === key)) {
    items.push(normalized);
  }
}

function matchingConceptCoverage(requirement: string, evidenceItems: EvidenceItem[]) {
  const requirementConcepts = getConcepts(requirement);
  if (requirementConcepts.size === 0) return 0;
  const evidenceConcepts = new Set<string>();
  evidenceItems.forEach((item) => {
    getConcepts(item.quote).forEach((concept) => evidenceConcepts.add(concept));
    getConcepts(item.label).forEach((concept) => evidenceConcepts.add(concept));
  });
  const matched = Array.from(requirementConcepts).filter((concept) => evidenceConcepts.has(concept));
  return matched.length / requirementConcepts.size;
}

function findResumeSnippet(requirement: string, resumeText: string) {
  const cleaned = cleanText(resumeText);
  if (!cleaned) return '';
  const tokens = getRequirementTokens(requirement);
  if (!hasAdequateEvidenceOverlap(requirement, cleaned)) return '';
  const lower = normalizeForMatch(cleaned);
  const token = tokens.find((entry) => lower.includes(entry));
  const conceptTerm = Object.values(CONCEPT_SYNONYMS)
    .flat()
    .map(normalizeForMatch)
    .find((entry) => getConcepts(requirement).size > 0 && lower.includes(entry) && getConcepts(requirement).has(Array.from(getConcepts(entry))[0] ?? ''));
  const matchTerm = token ?? conceptTerm;
  if (!matchTerm) return cleaned.slice(0, 180);
  const index = lower.indexOf(matchTerm);
  const start = Math.max(0, index - 55);
  const end = Math.min(cleaned.length, index + matchTerm.length + 95);
  return `${start > 0 ? '...' : ''}${cleaned.slice(start, end)}${end < cleaned.length ? '...' : ''}`;
}

function getProfileSkills(profile: Record<string, unknown>) {
  const possibleSkills = [profile.skills, profile.technicalSkills, profile.programmingLanguages, profile.tools];
  return Array.from(new Set(possibleSkills.flatMap(toStringList)));
}

function getGitHubUrl(profile: Record<string, unknown>, recommendation: RecommendationDetails) {
  const profileUrl = cleanText(profile.githubUrl || profile.github);
  const githubDataUrl = cleanText(recommendation.githubData?.profile_url);
  const raw = githubDataUrl || profileUrl;
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function getGitHubRepos(recommendation: RecommendationDetails) {
  const githubData = recommendation.githubData;
  if (!githubData) return [];
  return [
    ...(Array.isArray(githubData.top_repos) ? githubData.top_repos : []),
    ...(Array.isArray(githubData.repositories) ? githubData.repositories : []),
    ...(Array.isArray(githubData.repos) ? githubData.repos : []),
  ].filter((repo) => repo && typeof repo === 'object');
}

function buildEvidenceForRequirement(requirement: string, profile: Record<string, unknown>, recommendation: RecommendationDetails) {
  const evidence: EvidenceItem[] = [];
  const resumeText = cleanText(profile.resumeText);
  const resumeName = typeof (profile.resume as { name?: string } | undefined)?.name === 'string' ? (profile.resume as { name: string }).name : '';
  const courses = getTranscriptCourseLabels(profile);
  const skills = getProfileSkills(profile);
  const resumeSnippet = findResumeSnippet(requirement, resumeText);
  const githubUrl = getGitHubUrl(profile, recommendation);

  const matchingSkills = skills.filter((skill) => hasAdequateEvidenceOverlap(requirement, skill)).slice(0, 5);
  if (matchingSkills.length > 0) {
    addUniqueEvidence(evidence, {
      source: 'resume',
      label: 'Profile skills',
      quote: matchingSkills.join(', '),
      location: 'Student profile skills',
    });
  }

  if (resumeSnippet) {
    addUniqueEvidence(evidence, {
      source: 'resume',
      label: resumeName || cleanText(profile.resumeFileName) || 'Resume',
      quote: resumeSnippet,
      location: 'Resume text',
    });
  }

  const matchingCourses = courses.filter((course) => hasAdequateEvidenceOverlap(requirement, course)).slice(0, 3);
  matchingCourses.forEach((course) => {
    addUniqueEvidence(evidence, {
      source: 'transcript',
      label: 'Coursework',
      quote: course,
      location: 'Extracted coursework',
    });
  });

  getGitHubRepos(recommendation).forEach((repo) => {
    const repoText = [repo.name, repo.language, repo.description, ...(Array.isArray(repo.topics) ? repo.topics : [])].filter(Boolean).join(' ');
    if (!hasAdequateEvidenceOverlap(requirement, repoText)) return;
    addUniqueEvidence(evidence, {
      source: 'github',
      label: cleanText(repo.name) || 'GitHub repository',
      quote: [repo.language, repo.description, ...(Array.isArray(repo.topics) ? repo.topics : [])].filter(Boolean).map(cleanText).join(' - '),
      location: 'GitHub repository',
      url: repo.html_url || repo.url || githubUrl || undefined,
    });
  });

  return evidence;
}

function buildRequirementReasoning({
  posting,
  recommendation,
  profile,
}: {
  posting: ResearchPosting | null;
  recommendation: RecommendationDetails;
  profile: Record<string, unknown>;
}): RequirementReasoning[] {
  if (!posting) return [];
  const requirements = splitRequirements(posting);
  const rows = requirements.length > 0 ? requirements : ['General preparation for this research opportunity'];

  return rows.map((requirement) => {
    const evidence = buildEvidenceForRequirement(requirement, profile, recommendation);
    const directEvidenceCount = evidence.filter((item) => item.source === 'resume' || item.source === 'github' || item.source === 'research_project' || item.source === 'progress_report' || item.source === 'faculty_verification').length;
    const indirectEvidenceCount = evidence.filter((item) => item.source === 'transcript' || item.source === 'linkedin').length;
    const coverage = matchingConceptCoverage(requirement, evidence);
    const fitLevel: RequirementFitLevel =
      evidence.length === 0
        ? 'no_evidence'
        : directEvidenceCount > 0 && (coverage >= 0.5 || getConcepts(requirement).size === 0)
          ? 'strong_match'
        : indirectEvidenceCount > 0
          ? 'moderate_match'
          : 'limited_evidence';

    if (fitLevel === 'no_evidence') {
      return {
        requirement,
        fitLevel,
        explanation: `No ${cleanText(requirement).toLowerCase()} evidence was found in resume, GitHub, LinkedIn, transcript, progress reports, research projects, or faculty verification.`,
        evidence: [],
      };
    }

    const strongestSources = Array.from(new Set(evidence.map((item) => SOURCE_LABELS[item.source]))).slice(0, 3);
    const explanation =
      fitLevel === 'strong_match'
        ? `This is marked Strong Match because ${strongestSources.join(', ')} provide direct quoted evidence for this requirement.`
        : fitLevel === 'moderate_match'
          ? `This is marked Moderate Match because ${strongestSources.join(', ')} provide real cited evidence, but the support is indirect or only partially direct.`
          : `This is marked Limited Evidence because a related source was found, but it does not directly prove this requirement.`;

    const row = validateRequirementReasoning({ requirement, fitLevel, explanation, evidence });
    if (import.meta.env.DEV) {
      console.debug('[confidence reasoning]', {
        requirement,
        concepts: Array.from(getConcepts(requirement)),
        fitLevel: row.fitLevel,
        evidence: row.evidence.map((item) => ({
          source: item.source,
          label: item.label,
          quote: item.quote,
          location: item.location,
          url: item.url,
        })),
      });
    }
    return row;
  });
}

function validateRequirementReasoning(row: RequirementReasoning): RequirementReasoning {
  const evidence = row.evidence.filter((item) => item.source && cleanText(item.label) && cleanText(item.quote) && (cleanText(item.location) || cleanText(item.url)));
  if (evidence.length === 0) {
    return {
      requirement: row.requirement,
      fitLevel: 'no_evidence',
      explanation: `No ${cleanText(row.requirement).toLowerCase()} evidence was found in resume, GitHub, LinkedIn, transcript, progress reports, research projects, or faculty verification.`,
      evidence: [],
    };
  }
  return { ...row, evidence };
}

function buildSummary(score: number, fitLabel: string, rows: RequirementReasoning[]) {
  const strongCount = rows.filter((row) => row.fitLevel === 'strong_match').length;
  const moderateCount = rows.filter((row) => row.fitLevel === 'moderate_match').length;
  const limitedCount = rows.filter((row) => row.fitLevel === 'limited_evidence' || row.fitLevel === 'no_evidence').length;

  if (strongCount > 0 && limitedCount === 0) {
    return `You received ${score}/100 (${fitLabel}) because multiple requirements have quoted evidence from verified sources.`;
  }
  if (strongCount + moderateCount > limitedCount) {
    return `You received ${score}/100 (${fitLabel}) because some requirements have traceable evidence, but other project-specific requirements need stronger proof.`;
  }
  return `You received ${score}/100 (${fitLabel}) because the current profile has limited direct evidence for several requirements.`;
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <div className="rounded-lg border border-[#eee7e2] bg-[#fcfbfa] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full border-[#d8d2cd] bg-white text-[#4f4a46]">{SOURCE_LABELS[item.source]}</Badge>
        <p className="text-sm font-medium text-[#111111]">{item.label}</p>
      </div>
      {item.quote ? <p className="mt-2 text-sm leading-6 text-[#555555]">"{item.quote}"</p> : null}
      {item.location ? <p className="mt-1 text-xs text-[#777777]">{item.location}</p> : null}
      {item.url ? (
        <a className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800" href={item.url} target="_blank" rel="noreferrer">
          View evidence <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function ScoreSummaryCard({
  score,
  fitLabel,
  posting,
  summary,
}: {
  score: number;
  fitLabel: string;
  posting: ResearchPosting;
  summary: string;
}) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[180px_1fr]">
        <div className="rounded-xl border border-[#ececec] bg-[#fbfaf8] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Confidence Score</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-5xl font-semibold tracking-tight text-[#111111]">{score}</span>
            <span className="pb-1 text-sm text-[#666666]">/100</span>
          </div>
          <Badge className={`mt-4 rounded-full border px-3 py-1 ${fitBadgeClass(fitLabel)}`}>{fitLabel}</Badge>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Project</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111111]">{posting.title}</h1>
            <p className="mt-1 text-sm text-[#666666]">{posting.professorName} - {posting.professorDepartment}</p>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[#333333]">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RequirementReasoningCard({ row }: { row: RequirementReasoning }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Requirement</p>
            <h3 className="mt-1 text-lg font-semibold text-[#111111]">{row.requirement}</h3>
          </div>
          <Badge className={`w-fit rounded-full border px-3 py-1 ${requirementFitClass(row.fitLevel)}`}>
            {requirementFitLabel(row.fitLevel)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Reason</p>
          <p className="mt-1 text-sm leading-6 text-[#44403c]">{row.explanation}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777777]">Evidence</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {row.evidence.length > 0
              ? row.evidence.map((item, index) => <EvidenceCard key={`${row.requirement}-${item.source}-${index}`} item={item} />)
              : <p className="text-sm text-[#666666]">None</p>}
          </div>
        </div>
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
  const { setupState } = useAuth();

  const posting = useMemo(
    () => postings.find((item) => item.id === postingId && item.status === 'published') ?? null,
    [postings, postingId]
  );

  const stateRecommendation = (location.state as { recommendation?: RecommendationDetails } | null)?.recommendation;
  const fallbackConfidence = toDisplayScore(searchParams.get('confidence') ?? '0');
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
  const score = toDisplayScore(recommendation.confidence);
  const fitLabel = getFitLabel(score, recommendation.recommendation);
  const requirementReasoning = useMemo(
    () => buildRequirementReasoning({ posting, recommendation, profile }),
    [posting, recommendation, profile]
  );
  const summary = buildSummary(score, fitLabel, requirementReasoning);

  return (
    <div className="app-shell min-h-screen px-4 py-7">
      <main className="mx-auto max-w-5xl space-y-5">
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
            <ScoreSummaryCard score={score} fitLabel={fitLabel} posting={posting} summary={summary} />

            <section className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7f79]">Why You Received This Score</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#111111]">Requirement-by-requirement reasoning</h2>
              </div>
              <div className="space-y-3">
                {requirementReasoning.map((row) => <RequirementReasoningCard key={row.requirement} row={row} />)}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

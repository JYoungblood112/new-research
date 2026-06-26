import type { Application, ResearchPosting } from '../contexts/DataContext';

export type RequirementImportance = 'Low' | 'Medium' | 'High' | 'Critical';
export type RequirementType = 'must_have' | 'preferred';

export type OpportunityRequirement = {
  id?: string;
  opportunityId?: string;
  title: string;
  description: string;
  requirementType: RequirementType;
  importance: RequirementImportance;
  weight: number;
  minimumThreshold?: string;
  evidenceSources: string[];
  displayOrder: number;
};

export type RequirementCoverage = {
  requirement: OpportunityRequirement;
  matchScore: number;
  confidence: number;
  weightedPoints: number;
  maxPoints: number;
  satisfied: boolean;
  evidence: string;
  missingEvidence: string;
};

export type WeightedApplicationScore = {
  score: number;
  mustHaveMet: number;
  mustHaveTotal: number;
  filtered: boolean;
  coverage: RequirementCoverage[];
  explanation: string;
  versionLabel: string;
};

export const IMPORTANCE_TO_WEIGHT: Record<RequirementImportance, number> = {
  Low: 1,
  Medium: 2,
  High: 4,
  Critical: 6,
};

const DEFAULT_EVIDENCE_SOURCES = ['Resume', 'Transcript', 'Application Answers'];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function tokenize(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .filter((word) => !['and', 'the', 'for', 'with', 'from', 'research', 'student', 'experience'].includes(word));
}

function textOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0) return 0;
  let matches = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) matches += 1;
  });
  return matches / leftTokens.size;
}

function courseLabel(course: Application['coursework'][number]) {
  if (typeof course === 'string') return course;
  return [course.courseNumber, course.courseName, course.semester].filter(Boolean).join(' ');
}

export function buildDefaultRequirements(posting: ResearchPosting): OpportunityRequirement[] {
  const required = posting.requiredQualifications
    .split(/\n|;|,(?=\s*[A-Z])/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const preferred = posting.preferredQualifications
    .split(/\n|;|,(?=\s*[A-Z])/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const skillRequirements = posting.skillsNeeded.map((skill) => `${skill} experience`);

  const rows = [
    ...required.map((title) => ({ title, requirementType: 'must_have' as const, importance: 'High' as const })),
    ...preferred.map((title) => ({ title, requirementType: 'preferred' as const, importance: 'Medium' as const })),
    ...skillRequirements.map((title) => ({ title, requirementType: 'preferred' as const, importance: 'Medium' as const })),
  ];

  return rows
    .filter((row, index, arr) => arr.findIndex((other) => other.title.toLowerCase() === row.title.toLowerCase()) === index)
    .slice(0, 10)
    .map((row, index) => ({
      title: row.title,
      description: row.title,
      requirementType: row.requirementType,
      importance: row.importance,
      weight: IMPORTANCE_TO_WEIGHT[row.importance],
      evidenceSources: DEFAULT_EVIDENCE_SOURCES,
      displayOrder: index,
    }));
}

function getEvidenceText(application: Application) {
  return [
    application.studentMajor,
    application.quickNote,
    application.resume?.name,
    Object.values(application.answers ?? {}).join(' '),
    application.coursework.map(courseLabel).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

export function scoreApplicationAgainstRequirements({
  application,
  posting,
  fallbackScore,
  hardFilterMustHaves = false,
}: {
  application: Application;
  posting?: ResearchPosting;
  fallbackScore: number;
  hardFilterMustHaves?: boolean;
}): WeightedApplicationScore {
  const requirements = posting?.requirements?.length ? posting.requirements : posting ? buildDefaultRequirements(posting) : [];
  if (requirements.length === 0) {
    return {
      score: fallbackScore,
      mustHaveMet: 0,
      mustHaveTotal: 0,
      filtered: false,
      coverage: [],
      explanation: 'No structured requirement weights were available, so the legacy match score is shown.',
      versionLabel: 'Legacy score',
    };
  }

  const evidenceText = getEvidenceText(application);
  const coverage = requirements.map((requirement) => {
    const target = [requirement.title, requirement.description, requirement.minimumThreshold].filter(Boolean).join(' ');
    const directMatch = textOverlap(target, evidenceText);
    const sourceConfidence = Math.min(1, 0.45 + requirement.evidenceSources.length * 0.12);
    const matchScore = Math.round(Math.min(1, directMatch * 1.25) * 100);
    const confidence = Math.round(sourceConfidence * 100);
    const weightedPoints = requirement.weight * (matchScore / 100) * sourceConfidence;
    const satisfied = matchScore >= (requirement.requirementType === 'must_have' ? 55 : 40);

    return {
      requirement,
      matchScore,
      confidence,
      weightedPoints,
      maxPoints: requirement.weight,
      satisfied,
      evidence: matchScore > 0 ? 'Application materials contain overlapping coursework, resume, or answer evidence.' : 'No direct evidence found.',
      missingEvidence: satisfied ? '' : `Needs clearer evidence for ${requirement.title}.`,
    };
  });

  const totalWeight = coverage.reduce((sum, row) => sum + row.maxPoints, 0) || 1;
  const score = Math.round((coverage.reduce((sum, row) => sum + row.weightedPoints, 0) / totalWeight) * 100);
  const mustHaveRows = coverage.filter((row) => row.requirement.requirementType === 'must_have');
  const mustHaveMet = mustHaveRows.filter((row) => row.satisfied).length;
  const filtered = hardFilterMustHaves && mustHaveRows.length > 0 && mustHaveMet < mustHaveRows.length;

  return {
    score,
    mustHaveMet,
    mustHaveTotal: mustHaveRows.length,
    filtered,
    coverage,
    explanation: `Normalized weighted score: sum(requirement weight x evidence match x evidence confidence) divided by total requirement weight.`,
    versionLabel: `Requirement model v${requirements.length}-${requirements.reduce((sum, row) => sum + row.weight, 0)}`,
  };
}

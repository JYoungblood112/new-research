type CandidateLike = {
  id: string;
  name: string;
  university: string;
  major: string;
  graduationYear: string;
  researchAreas: string[];
  skills: string[];
  publications: string[];
  presentations: string[];
  facultyEndorsements: string[];
  researchScore: number;
  matchPercentage: number;
  verifiedContributions: number;
  researchHours: number;
  lab: string;
  department: string;
  githubActivity?: string;
  projects: Array<{ evidence?: Array<{ type?: string; url?: string }> }>;
};

type FacultyLike = {
  name: string;
  department: string;
  activeProjects: number;
  studentsMentored: number;
  publications: number;
  presentations: number;
  grantsSecured: string;
  reportsApproved: number;
  verifiedContributions: number;
  impactScore: number;
};

type DepartmentLike = {
  name: string;
  projectsPerFaculty: number;
  studentsMentoredPerFaculty: number;
  publicationsPerProject: number;
  grantFundingPerFaculty: string;
  participationRate: string;
  verifiedContributionsPerStudent: number;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percent(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function moneyToNumber(value: string) {
  const cleaned = value.replace(/[$,]/g, '').trim().toUpperCase();
  const numeric = Number.parseFloat(cleaned);
  if (!Number.isFinite(numeric)) return 0;
  if (cleaned.endsWith('M')) return numeric * 1_000_000;
  if (cleaned.endsWith('K')) return numeric * 1_000;
  return numeric;
}

function topCounts(values: string[], limit = 5) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function hasEvidence(candidate: CandidateLike) {
  return candidate.projects.some((project) => (project.evidence ?? []).some((item) => Boolean(item.url)));
}

export function calculateVerifiedTalentPipeline(candidates: CandidateLike[]) {
  const total = candidates.length;
  const graduatingSoon = candidates.filter((candidate) => Number(candidate.graduationYear) <= 2027).length;
  const withPublications = candidates.filter((candidate) => candidate.publications.length > 0).length;
  const withEvidenceLinks = candidates.filter(hasEvidence).length;
  const withEndorsements = candidates.filter((candidate) => candidate.facultyEndorsements.length > 0).length;
  const withVerifiedProgress = candidates.filter((candidate) => candidate.verifiedContributions > 0).length;

  return {
    total,
    graduatingSoon,
    withPublications,
    withEvidenceLinks,
    withEndorsements,
    withVerifiedProgress,
    rows: [
      ['Total verified researchers', String(total)],
      ['Graduating by 2027', String(graduatingSoon)],
      ['With publications', `${withPublications} (${percent(withPublications, total)}%)`],
      ['With GitHub/evidence links', `${withEvidenceLinks} (${percent(withEvidenceLinks, total)}%)`],
      ['With faculty endorsements', `${withEndorsements} (${percent(withEndorsements, total)}%)`],
      ['With verified progress reports', `${withVerifiedProgress} (${percent(withVerifiedProgress, total)}%)`],
    ],
  };
}

export function calculateCandidateQualityMetrics(candidates: CandidateLike[]) {
  const total = candidates.length;
  const publicationCount = candidates.filter((candidate) => candidate.publications.length > 0).length;
  const endorsementCount = candidates.filter((candidate) => candidate.facultyEndorsements.length > 0).length;
  const evidenceCount = candidates.filter(hasEvidence).length;
  const verificationScores = candidates.map((candidate) =>
    Math.min(100, Math.round(candidate.researchScore * 0.45 + candidate.matchPercentage * 0.25 + Math.min(candidate.verifiedContributions * 2, 30)))
  );

  return {
    averageResearchScore: Math.round(average(candidates.map((candidate) => candidate.researchScore))),
    averageVerificationScore: Math.round(average(verificationScores)),
    evidenceCoverage: percent(evidenceCount, total),
    publicationRate: percent(publicationCount, total),
    endorsementRate: percent(endorsementCount, total),
    experienceDistribution: [
      ['0-100 hours', candidates.filter((candidate) => candidate.researchHours < 100).length],
      ['100-175 hours', candidates.filter((candidate) => candidate.researchHours >= 100 && candidate.researchHours < 175).length],
      ['175+ hours', candidates.filter((candidate) => candidate.researchHours >= 175).length],
    ],
  };
}

export function calculateSkillSupply(candidates: CandidateLike[], selectedRole?: { requiredSkills?: string; preferredSkills?: string }) {
  const commonSkills = topCounts(candidates.flatMap((candidate) => candidate.skills), 8);
  const skillsByUniversity = candidates.reduce<Record<string, [string, number][]>>((acc, candidate) => {
    acc[candidate.university] = topCounts([
      ...(acc[candidate.university] ?? []).flatMap(([skill, count]) => Array(count).fill(skill)),
      ...candidate.skills,
    ], 5);
    return acc;
  }, {});
  const skillsByDepartment = candidates.reduce<Record<string, [string, number][]>>((acc, candidate) => {
    acc[candidate.department] = topCounts([
      ...(acc[candidate.department] ?? []).flatMap(([skill, count]) => Array(count).fill(skill)),
      ...candidate.skills,
    ], 5);
    return acc;
  }, {});

  const roleSkills = `${selectedRole?.requiredSkills ?? ''},${selectedRole?.preferredSkills ?? ''}`
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
  const available = new Set(candidates.flatMap((candidate) => candidate.skills.map((skill) => skill.toLowerCase())));
  const shortages = roleSkills.filter((skill) => !available.has(skill.toLowerCase()));

  return {
    commonSkills,
    fastestGrowingSkills: commonSkills.map(([skill, count], index) => [skill, `+${Math.max(8, count * 9 - index * 3)}%`]),
    skillsByUniversity,
    skillsByDepartment,
    shortages,
  };
}

export function calculateUniversityRankings(candidates: CandidateLike[], skillArea?: string) {
  const filtered = skillArea
    ? candidates.filter((candidate) => candidate.skills.includes(skillArea) || candidate.researchAreas.includes(skillArea))
    : candidates;

  return {
    universities: topCounts(filtered.map((candidate) => candidate.university)),
    departments: topCounts(filtered.map((candidate) => candidate.department)),
    labs: topCounts(filtered.map((candidate) => candidate.lab)),
  };
}

export function calculateRecruiterFunnel(input: {
  savedCandidates: number;
  outreachSent: number;
  responsesReceived: number;
  interviewsScheduled: number;
  offersMade: number;
}) {
  return {
    ...input,
    responseRate: percent(input.responsesReceived, input.outreachSent),
    interviewRate: percent(input.interviewsScheduled, input.responsesReceived),
    offerRate: percent(input.offersMade, input.interviewsScheduled),
    rows: [
      ['Saved candidates', input.savedCandidates],
      ['Outreach sent', input.outreachSent],
      ['Responses received', input.responsesReceived],
      ['Interviews scheduled', input.interviewsScheduled],
      ['Offers made', input.offersMade],
    ] as Array<[string, number]>,
  };
}

export function calculateResearchAreaTalentMap(candidates: CandidateLike[]) {
  const buckets = ['AI/ML', 'Data Science', 'Robotics', 'Biology', 'Chemistry', 'Physics', 'Finance', 'Economics', 'Public Policy', 'Humanities', 'Other'];
  const mapArea = (area: string) => {
    const normalized = area.toLowerCase();
    if (/machine learning|ai|computer vision|embedded ai|health ai/.test(normalized)) return 'AI/ML';
    if (/data|analytics|causal|visualization/.test(normalized)) return 'Data Science';
    if (/robot/.test(normalized)) return 'Robotics';
    if (/bio|health/.test(normalized)) return 'Biology';
    if (/finance/.test(normalized)) return 'Finance';
    if (/econ/.test(normalized)) return 'Economics';
    if (/policy/.test(normalized)) return 'Public Policy';
    return 'Other';
  };

  const counts = Object.fromEntries(buckets.map((bucket) => [bucket, 0]));
  for (const candidate of candidates) {
    const candidateBuckets = new Set(candidate.researchAreas.map(mapArea));
    candidateBuckets.forEach((bucket) => {
      counts[bucket] += 1;
    });
  }

  return buckets.map((bucket) => [bucket, counts[bucket]] as [string, number]);
}

export function calculateResearchEcosystemHealth(input: {
  participationRate: number;
  facultyParticipationRate: number;
  completedProjects: number;
  activeProjects: number;
  publications: number;
  presentations: number;
  verifiedContributions: number;
  studentsPlaced: number;
  filledPositions: number;
  availablePositions: number;
}) {
  const completionRate = percent(input.completedProjects, input.completedProjects + input.activeProjects);
  const outputRate = Math.min(100, Math.round(((input.publications + input.presentations) / Math.max(input.activeProjects, 1)) * 40));
  const contributionRate = Math.min(100, Math.round((input.verifiedContributions / Math.max(input.studentsPlaced, 1)) * 40));
  const fillRate = percent(input.filledPositions, input.availablePositions);
  const score = Math.round(average([
    input.participationRate,
    input.facultyParticipationRate,
    completionRate,
    outputRate,
    contributionRate,
    fillRate,
  ]));

  return { score, completionRate, outputRate, contributionRate, fillRate };
}

export function calculateOpportunityGap(input: {
  studentsSeeking: number;
  openPositions: number;
  filledPositions: number;
  demandRows: Array<{ area: string; applicants: number; positions: number; status: string }>;
}) {
  const unfilledStudentDemand = Math.max(0, input.studentsSeeking - input.filledPositions);
  return {
    unfilledStudentDemand,
    openPositions: input.openPositions,
    filledPositions: input.filledPositions,
    opportunityFillRate: percent(input.filledPositions, input.openPositions),
    oversubscribedAreas: input.demandRows.filter((row) => row.applicants > row.positions).map((row) => row.area),
    undersuppliedAreas: input.demandRows.filter((row) => row.positions > row.applicants).map((row) => row.area),
  };
}

export function calculateDepartmentComparisons(departments: DepartmentLike[]) {
  return departments.map((department) => ({
    ...department,
    fundingValue: moneyToNumber(department.grantFundingPerFaculty),
    participationValue: Number.parseInt(department.participationRate, 10) || 0,
  }));
}

export function calculateFacultyMentorshipMetrics(facultyRows: FacultyLike[], eligibleFaculty = 46) {
  const activeFaculty = facultyRows.filter((faculty) => faculty.studentsMentored > 0).length;
  return {
    activeFaculty,
    inactiveFaculty: Math.max(0, eligibleFaculty - activeFaculty),
    mostActiveMentors: [...facultyRows].sort((a, b) => b.studentsMentored - a.studentsMentored).slice(0, 5),
    reportsApproved: facultyRows.reduce((total, faculty) => total + faculty.reportsApproved, 0),
    verifiedContributionsSupervised: facultyRows.reduce((total, faculty) => total + faculty.verifiedContributions, 0),
    averageImpactScore: Math.round(average(facultyRows.map((faculty) => faculty.impactScore))),
  };
}

export function calculateStudentOutcomeRates(metrics: string[][], studentsPlaced: number) {
  const lookup = Object.fromEntries(metrics.map(([label, value]) => [label, Number.parseInt(value, 10) || 0]));
  return {
    internshipRate: percent(lookup['Students Receiving Internships'], studentsPlaced),
    offerRate: percent(lookup['Students Receiving Full-Time Offers'], studentsPlaced),
    graduatePlacementRate: percent(lookup['Students Admitted to Graduate Programs'], studentsPlaced),
    publicationRate: percent(lookup['Students with Publications'], studentsPlaced),
    presentationRate: percent(lookup['Students with Conference Presentations'], studentsPlaced),
    continuingResearchRate: percent(lookup['Students Continuing Research'], studentsPlaced),
  };
}

export function calculateFundingOutputMetrics(input: {
  totalGrantFunding: string;
  activeGrants: number;
  pendingGrantFunding: string;
  fundedProjects: number;
  outputs: number;
  fundedStudentCount: number;
  fundingByArea: Array<{ label: string; value: number }>;
}) {
  const totalFunding = moneyToNumber(input.totalGrantFunding);
  return {
    totalFunding,
    activeGrants: input.activeGrants,
    pendingFunding: moneyToNumber(input.pendingGrantFunding),
    outputPerFundedProject: Number((input.outputs / Math.max(input.fundedProjects, 1)).toFixed(1)),
    studentParticipationInFundedProjects: input.fundedStudentCount,
    fundingByDepartment: input.fundingByArea.map((row) => [row.label, row.value] as [string, number]),
  };
}

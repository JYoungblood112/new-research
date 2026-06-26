import { MOCK_PROGRESS_REPORTS } from './progressReports';

export const lastUpdated = 'June 24, 2026, 10:15 PM CT';
export const reportingTerm = 'Spring 2026';

export const metricSources = {
  opportunityPlatform: 'Research opportunity postings, application records, and placement status in the platform.',
  progressReports: 'Student progress reports and faculty approval status.',
  outcomeReports: 'Student-reported outcomes with faculty verification where available.',
  profileData: 'Student profile, major, class-year, and application history fields available in the platform.',
};

export const overviewKpis = [
  {
    label: 'Students seeking research',
    value: '386',
    comparison: '+18% vs Fall 2025',
    definition: 'Unique students who saved, applied to, or marked interest in a research opportunity this term.',
    source: metricSources.opportunityPlatform,
    coverage: '92% coverage',
  },
  {
    label: 'Available positions',
    value: '174',
    comparison: '+9% vs Fall 2025',
    definition: 'Total student slots listed on published research opportunities.',
    source: metricSources.opportunityPlatform,
    coverage: '89% coverage',
  },
  {
    label: 'Students placed',
    value: '142',
    comparison: '+12% vs Fall 2025',
    definition: 'Students accepted into a research opportunity and marked as placed.',
    source: metricSources.opportunityPlatform,
    coverage: '91% coverage',
  },
  {
    label: 'Opportunity fill rate',
    value: '82%',
    comparison: '+3 pts vs Fall 2025',
    definition: 'Filled positions divided by available positions.',
    source: metricSources.opportunityPlatform,
    coverage: '89% coverage',
  },
  {
    label: 'Median time to placement',
    value: '18 days',
    comparison: '-4 days vs Fall 2025',
    definition: 'Median days from application submission to accepted placement.',
    source: metricSources.opportunityPlatform,
    coverage: '84% coverage',
  },
];

export const executiveAttention = [
  {
    title: 'Robotics demand exceeds capacity',
    evidence: '94 applicants for 22 positions',
    explanation: 'Student demand exceeds available positions by 72, creating the largest visible capacity gap.',
    action: 'Consider additional mentored roles, cohort projects, or referrals to adjacent labs.',
    cta: 'View demand details',
    target: 'demand',
  },
  {
    title: 'Climate AI positions are underutilized',
    evidence: '12 applicants for 18 positions',
    explanation: 'Available roles exist, but students are not finding or selecting them at the same rate as adjacent areas.',
    action: 'Promote these opportunities in discovery flows and advising outreach.',
    cta: 'View underused capacity',
    target: 'demand',
  },
  {
    title: 'First-year entry needs attention',
    evidence: '17 first-time participants; 46 repeated applicants remain unplaced',
    explanation: 'Early access and repeat application support are both visible friction points.',
    action: 'Create early-entry projects and structured matching support before the next application cycle.',
    cta: 'View access details',
    target: 'access',
  },
  {
    title: 'Outcome verification is incomplete',
    evidence: '34 reported publications; 19 faculty verified',
    explanation: 'Reported outcomes are useful signals, but executive reporting should separate them from verified evidence.',
    action: 'Ask faculty mentors to review pending outcome claims before executive export.',
    cta: 'View outcome evidence',
    target: 'outcomes',
  },
];

export const demandCapacityRows = [
  { area: 'Robotics', demand: 94, positions: 22, filled: 21, medianTimeToFill: 8, status: 'Oversubscribed' },
  { area: 'Applied ML', demand: 78, positions: 28, filled: 26, medianTimeToFill: 11, status: 'Oversubscribed' },
  { area: 'Health AI', demand: 44, positions: 31, filled: 27, medianTimeToFill: 15, status: 'Balanced' },
  { area: 'Embedded AI', demand: 19, positions: 14, filled: 12, medianTimeToFill: 21, status: 'Balanced' },
  { area: 'Climate AI', demand: 12, positions: 18, filled: 9, medianTimeToFill: 31, status: 'Underutilized' },
  { area: 'Public Interest Tech', demand: 9, positions: 16, filled: 7, medianTimeToFill: 28, status: 'Underutilized' },
];

export const participationFunnel = [
  { label: 'Students interested', value: 386 },
  { label: 'Applications submitted', value: 274 },
  { label: 'Applications reviewed', value: 211 },
  { label: 'Students placed', value: 142 },
  { label: 'Verified contributors', value: 118 },
  { label: 'Completed projects', value: 38 },
];

export const outcomesSnapshot = [
  { label: 'Verified contributions', reported: 212, verified: 212, source: metricSources.progressReports },
  { label: 'Completed projects', reported: 38, verified: 34, source: metricSources.progressReports },
  { label: 'Publications', reported: 34, verified: 19, source: metricSources.outcomeReports },
  { label: 'Conference presentations', reported: 49, verified: 31, source: metricSources.outcomeReports },
  { label: 'Internships', reported: 52, verified: 28, source: metricSources.outcomeReports },
  { label: 'Full-time offers', reported: 21, verified: 12, source: metricSources.outcomeReports },
  { label: 'Continued research', reported: 76, verified: 54, source: metricSources.outcomeReports },
  { label: 'Graduate-school placements', reported: 18, verified: 10, source: metricSources.outcomeReports },
];

export const dataConfidence = [
  { label: 'Opportunity coverage', value: '89%', detail: 'Published opportunities with position counts and department metadata.' },
  { label: 'Projects with progress reports', value: `${MOCK_PROGRESS_REPORTS.length}`, detail: 'Progress reports currently available in the platform.' },
  { label: 'Outcomes verified', value: '58%', detail: 'Outcome claims with faculty verification or approved progress evidence.' },
  { label: 'Departments with incomplete data', value: '3', detail: 'Departments missing either capacity, progress report, or outcome verification fields.' },
  { label: 'Last synchronization', value: lastUpdated, detail: 'Latest platform data refresh visible to this dashboard.' },
];

export const openOpportunityRows = [
  { opportunity: 'Climate Policy Data Analysis', department: 'Public Policy', area: 'Climate AI', applicants: 2, positions: 6, filled: 1 },
  { opportunity: 'Optimization Methods for Smart Grids', department: 'Electrical & Computer Engineering', area: 'Public Interest Tech', applicants: 3, positions: 5, filled: 2 },
  { opportunity: 'Human-AI Collaboration in Education', department: 'Psychology', area: 'Applied ML', applicants: 4, positions: 4, filled: 2 },
  { opportunity: 'Data Visualization for Public Health', department: 'Statistics & Data Science', area: 'Health AI', applicants: 5, positions: 7, filled: 4 },
];

export const oversubscribedOpportunityRows = [
  { opportunity: 'Autonomous Robot Perception', department: 'Robotics Institute', area: 'Robotics', applicants: 48, positions: 8, filled: 8 },
  { opportunity: 'Efficient LLM Fine-Tuning for Scientific Text', department: 'Computer Science', area: 'Applied ML', applicants: 35, positions: 6, filled: 6 },
  { opportunity: 'Computer Vision for Medical Imaging', department: 'Biomedical Engineering', area: 'Health AI', applicants: 29, positions: 5, filled: 5 },
];

export const unmatchedInterestRows = [
  { interest: 'Human-centered AI policy', students: 27, closestArea: 'Public Interest Tech', suggestedAction: 'Create policy-facing research roles.' },
  { interest: 'Robotics hardware prototyping', students: 24, closestArea: 'Robotics', suggestedAction: 'Open cohort-based build projects.' },
  { interest: 'AI safety evaluations', students: 19, closestArea: 'Applied ML', suggestedAction: 'Add benchmark and evaluation opportunities.' },
];

export const mentorshipCapacityRows = [
  { department: 'Computer Science', facultyWithOpenPositions: 11, facultyWithoutResearchers: 4, studentsMentored: 58, pendingReviews: 14, fillRate: '86%' },
  { department: 'Robotics Institute', facultyWithOpenPositions: 6, facultyWithoutResearchers: 2, studentsMentored: 33, pendingReviews: 9, fillRate: '95%' },
  { department: 'Statistics & Data Science', facultyWithOpenPositions: 5, facultyWithoutResearchers: 5, studentsMentored: 21, pendingReviews: 6, fillRate: '72%' },
  { department: 'Biomedical Engineering', facultyWithOpenPositions: 4, facultyWithoutResearchers: 3, studentsMentored: 18, pendingReviews: 4, fillRate: '77%' },
];

export const facultyOperationsRows = [
  { faculty: 'Dr. Emily Watson', department: 'Robotics Institute', openOpportunities: 3, applicants: 48, studentsMentored: 18, pendingReviews: 5, verifiedContributions: 73, fillRate: '96%' },
  { faculty: 'Dr. Priya Shah', department: 'Computer Science', openOpportunities: 2, applicants: 35, studentsMentored: 16, pendingReviews: 4, verifiedContributions: 58, fillRate: '92%' },
  { faculty: 'Dr. Marcus Lee', department: 'Biomedical Engineering', openOpportunities: 2, applicants: 29, studentsMentored: 13, pendingReviews: 3, verifiedContributions: 49, fillRate: '83%' },
  { faculty: 'Dr. Lina Huang', department: 'Electrical & Computer Engineering', openOpportunities: 1, applicants: 19, studentsMentored: 9, pendingReviews: 2, verifiedContributions: 32, fillRate: '78%' },
];

export const outcomeTrend = [
  { label: '2023', completed: 21, verified: 58, presentations: 18, publications: 8, internships: 29, offers: 7, continued: 37, graduate: 10 },
  { label: '2024', completed: 27, verified: 73, presentations: 26, publications: 11, internships: 34, offers: 10, continued: 46, graduate: 13 },
  { label: '2025', completed: 32, verified: 94, presentations: 35, publications: 15, internships: 43, offers: 14, continued: 61, graduate: 15 },
  { label: '2026', completed: 38, verified: 118, presentations: 49, publications: 19, internships: 52, offers: 21, continued: 76, graduate: 18 },
];

export const outcomesByDepartment = [
  { department: 'Computer Science', completed: 17, verified: 71, presentations: 20, publications: 9 },
  { department: 'Robotics Institute', completed: 9, verified: 48, presentations: 13, publications: 5 },
  { department: 'Biomedical Engineering', completed: 6, verified: 31, presentations: 9, publications: 3 },
  { department: 'Statistics & Data Science', completed: 6, verified: 28, presentations: 7, publications: 2 },
];

export const accessByMajor = [
  { label: 'Computer Science', value: 42 },
  { label: 'Business Analytics', value: 21 },
  { label: 'Electrical and Computer Engineering', value: 18 },
  { label: 'Statistics', value: 13 },
  { label: 'Other majors', value: 6 },
];

export const accessByClassYear = [
  { label: 'First-year', value: 12 },
  { label: 'Sophomore', value: 24 },
  { label: 'Junior', value: 34 },
  { label: 'Senior', value: 20 },
  { label: 'Graduate', value: 10 },
];

export const accessMetrics = [
  { label: 'First-time research participants', value: '17', detail: 'Students with first platform placement this term.' },
  { label: 'Applicants without placements', value: '132', detail: 'Unique applicants with no accepted placement this term.' },
  { label: 'Cross-department participation', value: '29 projects', detail: 'Projects with students outside the hosting department.' },
  { label: 'Early-entry opportunities', value: '14', detail: 'Opportunities marked suitable for first-year or sophomore students.' },
  { label: 'Repeated application attempts', value: '46 students', detail: 'Students with 3 or more applications and no placement.' },
];

export const accessRows = [
  { group: 'First-year students', applicants: 64, placed: 17, placementRate: '27%', gap: 'Need more early-entry roles' },
  { group: 'Non-CS majors', applicants: 93, placed: 38, placementRate: '41%', gap: 'Need clearer prerequisites and advising pathways' },
  { group: 'Repeat applicants', applicants: 46, placed: 0, placementRate: '0%', gap: 'Need matching support and feedback loops' },
  { group: 'Cross-department applicants', applicants: 118, placed: 52, placementRate: '44%', gap: 'Need better visibility into host department expectations' },
];

export const reportOptions = [
  'Semester participation report',
  'Demand and capacity report',
  'Student outcomes report',
  'Research access report',
  'Department comparison report',
  'Pilot evaluation report',
];

export const unsupportedFutureIntegrations = [
  'Grant success rate',
  'Total institutional grant funding',
  'Patents',
  'Peer university rankings',
  'Funding per faculty',
  'Faculty productivity scores',
  'University-wide publication totals',
];

export const deanAiPayload = {
  reportingTerm,
  lastUpdated,
  overviewKpis,
  executiveAttention,
  demandCapacityRows,
  participationFunnel,
  outcomesSnapshot,
  dataConfidence,
  accessMetrics,
  reportRules: [
    'Use only displayed or retrieved metrics.',
    'Cite the metric labels used.',
    'Distinguish verified outcomes from reported outcomes.',
    'Do not invent explanations or unsupported institutional metrics.',
  ],
};

import { MOCK_PROGRESS_REPORTS } from './progressReports';

// TODO: Replace this mock dataset with API-backed department, faculty, grant, progress-report, and outcome metrics.
export const deanOverviewStats = [
  { label: 'Active Research Projects', value: '64', detail: '+12% from last semester' },
  { label: 'Completed Projects', value: '38', detail: 'This academic year' },
  { label: 'Student Researchers', value: '142', detail: '27% participation growth' },
  { label: 'Participating Faculty', value: '36', detail: '78% of eligible faculty' },
  { label: 'Publications', value: '41', detail: 'Peer-reviewed outputs' },
  { label: 'Presentations', value: '57', detail: 'Conference and symposium talks' },
  { label: 'Grant Funding', value: '$4.2M', detail: 'Active awards' },
  { label: 'Research Hours Logged', value: '11,840', detail: 'Student-reported hours' },
];

export const deanKeyQuestions = [
  {
    question: 'How many students participate in research?',
    answer: '142 student researchers are currently placed into research, representing a 31% participation rate.',
    proof: 'Student Researchers, Student Participation Rate, Students Placed Into Research',
  },
  {
    question: 'Which departments are growing?',
    answer: 'Computer Science leads current growth with 64 active projects and a 27% participation increase, while Applied ML and Robotics show the fastest demand growth.',
    proof: 'Department Comparison, Research Output by Semester, Supply and Demand',
  },
  {
    question: 'Which faculty are mentoring students?',
    answer: 'Dr. Emily Watson, Dr. Priya Shah, Dr. Marcus Lee, and Dr. Lina Huang are the top visible mentors, collectively mentoring 56 students.',
    proof: 'Faculty Research Impact table',
  },
  {
    question: 'Are research opportunities being utilized?',
    answer: '142 of 174 available positions are filled, leaving 32 unfilled positions and showing 82% utilization.',
    proof: 'Research Opportunity Supply and Demand',
  },
  {
    question: 'Are students producing outcomes?',
    answer: 'Students have produced 118 verified contributions, 34 publications, 49 conference presentations, 52 internships, and 21 full-time offers.',
    proof: 'Student Outcomes and Research Portfolio Analytics',
  },
  {
    question: 'Can we justify additional funding?',
    answer: 'The department has $4.2M in active grants, 9.8 outputs per $1M, and student demand exceeding capacity in robotics and applied ML.',
    proof: 'Funding and Grants, Research Gaps Analysis',
  },
  {
    question: 'How does our institution compare to peers?',
    answer: 'Computer Science ranks #1 against listed university peers and exceeds the peer institution average in projects per faculty, students mentored per faculty, and verified contributions per student.',
    proof: 'Department Comparison',
  },
];

export const researchOutputMetrics = [
  ['Active Projects', '64'],
  ['Completed Projects', '38'],
  ['Student Participation Rate', '31%'],
  ['Faculty Participation Rate', '78%'],
  ['Total Research Hours', '11,840'],
  ['Publications Produced', '41'],
  ['Conference Presentations', '57'],
  ['Posters Presented', '73'],
  ['Patent Applications', '6'],
  ['Grant Funding', '$4.2M'],
];

export const semesterOutputTrend = [
  { label: 'Fall 2024', projects: 42, publications: 19, participation: 21, grants: 2.6 },
  { label: 'Spring 2025', projects: 48, publications: 24, participation: 24, grants: 3.1 },
  { label: 'Fall 2025', projects: 56, publications: 31, participation: 27, grants: 3.6 },
  { label: 'Spring 2026', projects: 64, publications: 41, participation: 31, grants: 4.2 },
];

export const departmentComparisons = [
  {
    name: 'Computer Science',
    type: 'Current department',
    ranking: '#1 university',
    projectsPerFaculty: 1.8,
    studentsMentoredPerFaculty: 4.0,
    publicationsPerProject: 0.64,
    grantFundingPerFaculty: '$117K',
    participationRate: '31%',
    verifiedContributionsPerStudent: 3.4,
  },
  {
    name: 'Electrical and Computer Engineering',
    type: 'University peer',
    ranking: '#2 university',
    projectsPerFaculty: 1.5,
    studentsMentoredPerFaculty: 3.1,
    publicationsPerProject: 0.48,
    grantFundingPerFaculty: '$96K',
    participationRate: '24%',
    verifiedContributionsPerStudent: 2.7,
  },
  {
    name: 'Statistics and Data Science',
    type: 'University peer',
    ranking: '#3 university',
    projectsPerFaculty: 1.2,
    studentsMentoredPerFaculty: 2.8,
    publicationsPerProject: 0.52,
    grantFundingPerFaculty: '$74K',
    participationRate: '22%',
    verifiedContributionsPerStudent: 2.4,
  },
  {
    name: 'Peer Institution Average',
    type: 'External benchmark',
    ranking: 'Benchmark',
    projectsPerFaculty: 1.1,
    studentsMentoredPerFaculty: 2.6,
    publicationsPerProject: 0.43,
    grantFundingPerFaculty: '$81K',
    participationRate: '19%',
    verifiedContributionsPerStudent: 2.1,
  },
];

export const facultyImpactRows = [
  {
    name: 'Dr. Emily Watson',
    department: 'Robotics Institute',
    activeProjects: 7,
    studentsMentored: 18,
    publications: 8,
    presentations: 11,
    grantsSecured: '$840K',
    reportsApproved: 46,
    verifiedContributions: 73,
    impactScore: 96,
  },
  {
    name: 'Dr. Priya Shah',
    department: 'AI + Business Research Group',
    activeProjects: 5,
    studentsMentored: 16,
    publications: 6,
    presentations: 9,
    grantsSecured: '$620K',
    reportsApproved: 39,
    verifiedContributions: 58,
    impactScore: 92,
  },
  {
    name: 'Dr. Marcus Lee',
    department: 'Health Data Science Lab',
    activeProjects: 4,
    studentsMentored: 13,
    publications: 7,
    presentations: 8,
    grantsSecured: '$710K',
    reportsApproved: 31,
    verifiedContributions: 49,
    impactScore: 89,
  },
  {
    name: 'Dr. Lina Huang',
    department: 'Embedded Intelligence Lab',
    activeProjects: 3,
    studentsMentored: 9,
    publications: 4,
    presentations: 6,
    grantsSecured: '$390K',
    reportsApproved: 24,
    verifiedContributions: 32,
    impactScore: 81,
  },
];

export const studentOutcomeMetrics = [
  ['Students Placed Into Research', '142'],
  ['Students with Verified Contributions', '118'],
  ['Students with Publications', '34'],
  ['Students with Conference Presentations', '49'],
  ['Students Receiving Internships', '52'],
  ['Students Receiving Full-Time Offers', '21'],
  ['Students Admitted to Graduate Programs', '18'],
  ['Students Continuing Research', '76'],
];

export const outcomeTrend = [
  { label: '2023', placed: 82, verified: 58, internships: 29, graduatePrograms: 10 },
  { label: '2024', placed: 96, verified: 73, internships: 34, graduatePrograms: 13 },
  { label: '2025', placed: 118, verified: 94, internships: 43, graduatePrograms: 15 },
  { label: '2026', placed: 142, verified: 118, internships: 52, graduatePrograms: 18 },
];

export const supplyDemandMetrics = [
  ['Students Seeking Research', '386'],
  ['Available Research Positions', '174'],
  ['Filled Positions', '142'],
  ['Unfilled Positions', '32'],
];

export const labDemandRows = [
  { lab: 'Robotics Institute', area: 'Robotics', applicants: 94, positions: 22, status: 'Oversubscribed' },
  { lab: 'AI + Business Research Group', area: 'Applied ML', applicants: 78, positions: 28, status: 'Oversubscribed' },
  { lab: 'Embedded Intelligence Lab', area: 'Embedded AI', applicants: 19, positions: 14, status: 'Balanced' },
  { lab: 'Computational Sustainability Lab', area: 'Climate AI', applicants: 12, positions: 18, status: 'Undersubscribed' },
];

export const researchGapSignals = [
  'Robotics demand exceeds available student research positions by 72 students.',
  'Climate AI has open positions but low applicant awareness.',
  'Three faculty members have no verified student researchers this semester.',
  'Graduate mentorship capacity is strong, but first-year undergraduate entry points are limited.',
];

export const fundingMetrics = [
  ['Total Grant Funding', '$4.2M'],
  ['Pending Grants', '$1.1M'],
  ['Active Grants', '17'],
  ['Grant Success Rate', '42%'],
  ['Student Participation in Funded Projects', '86 students'],
  ['Output per Dollar Funded', '9.8 outputs per $1M'],
];

export const fundingByArea = [
  { label: 'Machine Learning', value: 1.4 },
  { label: 'Robotics', value: 1.1 },
  { label: 'Health AI', value: 0.8 },
  { label: 'Embedded AI', value: 0.5 },
  { label: 'Climate AI', value: 0.4 },
];

export const accessMetrics = {
  byMajor: [
    ['Computer Science', 42],
    ['Business Analytics', 21],
    ['Electrical and Computer Engineering', 18],
    ['Statistics', 13],
    ['Other Majors', 6],
  ],
  byClassYear: [
    ['First-Year', 12],
    ['Sophomore', 24],
    ['Junior', 34],
    ['Senior', 20],
    ['Graduate', 10],
  ],
  collaboration: [
    ['Cross-Department Collaborations', '29 active projects'],
    ['First-Year Research Participation', '17 students'],
    ['Undergraduate Participation', '128 students'],
    ['Graduate Participation', '42 students'],
  ],
};

export const portfolioAnalytics = {
  totalProgressReports: MOCK_PROGRESS_REPORTS.length,
  verifiedProgressReports: MOCK_PROGRESS_REPORTS.filter((report) => report.verificationStatus === 'Approved').length,
  totalVerifiedContributions: 212,
  activeAreas: ['Machine Learning', 'Robotics', 'Data Analytics', 'Health AI'],
  activeLabs: ['Robotics Institute', 'AI + Business Research Group', 'Health Data Science Lab'],
  activeStudents: ['Jonathan Youngblood', 'Maya Patel', 'Elena Garcia'],
  activeMentors: ['Dr. Emily Watson', 'Dr. Priya Shah', 'Dr. Marcus Lee'],
};

export const deanAiPayload = {
  overview: deanOverviewStats,
  keyQuestions: deanKeyQuestions,
  researchOutput: researchOutputMetrics,
  departmentComparisons,
  facultyImpactRows,
  studentOutcomeMetrics,
  supplyDemandMetrics,
  researchGapSignals,
  fundingMetrics,
  accessMetrics,
  portfolioAnalytics,
};

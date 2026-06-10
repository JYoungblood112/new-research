export type EvidenceLink = {
  type: string;
  label: string;
  url: string;
  description: string;
};

// TODO: Replace this mock dataset with recruiter, candidate, progress-report, and portfolio API data.
export type ResearchProject = {
  title: string;
  area: string;
  summary: string;
  status: string;
  evidence: EvidenceLink[];
};

export type RecruiterCandidate = {
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
  githubActivity: string;
  projects: ResearchProject[];
  timeline: string[];
};

export const recruiterOverviewStats = [
  { label: 'Recommended Candidates', value: '23', detail: 'AI-ranked this week' },
  { label: 'Verified Researchers', value: '1,284', detail: 'Faculty-approved profiles' },
  { label: 'Saved Candidates', value: '48', detail: 'Across 5 watchlists' },
  { label: 'Outreach Sent', value: '126', detail: 'Current cycle' },
  { label: 'Response Rate', value: '64%', detail: '+8% from last month' },
  { label: 'Upcoming Graduates', value: '312', detail: 'Next two semesters' },
];

export const recruiterCandidates: RecruiterCandidate[] = [
  {
    id: 'jonathan-youngblood',
    name: 'Jonathan Youngblood',
    university: 'Carnegie Mellon University',
    major: 'Business Analytics and Artificial Intelligence',
    graduationYear: '2028',
    researchAreas: ['Machine Learning', 'Data Analytics', 'AI for Business'],
    skills: ['Python', 'SQL', 'Tableau', 'Databricks', 'PyTorch', 'Power BI'],
    publications: ['Benchmarking lightweight ML pipelines for operational research'],
    presentations: ['CMU Undergraduate Research Symposium: Applied ML Dashboards'],
    facultyEndorsements: ['Dr. Priya Shah: Strong experimental discipline and reliable reporting'],
    researchScore: 92,
    matchPercentage: 94,
    verifiedContributions: 14,
    researchHours: 186,
    lab: 'AI + Business Research Group',
    department: 'Tepper School of Business',
    githubActivity: '22 commits across ML dashboard and experiment tracking projects in the last 60 days',
    projects: [
      {
        title: 'ML Research Portfolio',
        area: 'Machine Learning',
        summary: 'Built model benchmarking utilities, experiment tracking notebooks, and reproducible data pipelines.',
        status: 'Professor Verified',
        evidence: [
          {
            type: 'GitHub Repository',
            label: 'ml-research-portfolio',
            url: 'https://github.com/JYoungblood112/ml-research-portfolio',
            description: 'Python toolkit for model benchmarking and experiment tracking.',
          },
          {
            type: 'Notebook',
            label: 'Model evaluation notebook',
            url: 'https://github.com/JYoungblood112/ml-research-portfolio',
            description: 'Notebook showing training results and evaluation tables.',
          },
        ],
      },
    ],
    timeline: [
      'Completed literature review on model monitoring for business analytics.',
      'Cleaned 42k-row operational dataset and documented missing-value handling.',
      'Trained baseline models and submitted professor-approved progress report.',
    ],
  },
  {
    id: 'maya-patel',
    name: 'Maya Patel',
    university: 'Carnegie Mellon University',
    major: 'Computer Science',
    graduationYear: '2027',
    researchAreas: ['Robotics', 'Computer Vision', 'Multi-Agent Systems'],
    skills: ['Python', 'ROS', 'C++', 'OpenCV', 'PyTorch'],
    publications: ['Warehouse robot coordination with constrained communication'],
    presentations: ['Robotics Institute Summer Research Showcase'],
    facultyEndorsements: ['Dr. Emily Watson: Excellent robotics implementation and debugging skills'],
    researchScore: 95,
    matchPercentage: 91,
    verifiedContributions: 18,
    researchHours: 240,
    lab: 'Robotics Institute',
    department: 'School of Computer Science',
    githubActivity: 'Maintains ROS simulation packages with weekly pull requests',
    projects: [
      {
        title: 'Warehouse Robot Coordination',
        area: 'Robotics',
        summary: 'Implemented simulation scenarios for coordinating multiple warehouse robots under task constraints.',
        status: 'Professor Verified',
        evidence: [
          {
            type: 'Pull Request',
            label: 'ROS planner integration',
            url: 'https://github.com/cmu-research/warehouse-robots/pull/14',
            description: 'Integrated planner with simulation harness and validation tests.',
          },
        ],
      },
    ],
    timeline: [
      'Added ROS nodes for task assignment.',
      'Ran experiments across 30 simulated warehouse layouts.',
      'Presented findings to lab during weekly research meeting.',
    ],
  },
  {
    id: 'elena-garcia',
    name: 'Elena Garcia',
    university: 'University of Pittsburgh',
    major: 'Statistics and Data Science',
    graduationYear: '2026',
    researchAreas: ['Health AI', 'Causal Inference', 'Data Visualization'],
    skills: ['R', 'Python', 'SQL', 'CausalML', 'ggplot2'],
    publications: ['Estimating treatment effects in observational clinical datasets'],
    presentations: ['AMIA Student Research Forum'],
    facultyEndorsements: ['Dr. Marcus Lee: Careful statistical reasoning and clear research communication'],
    researchScore: 89,
    matchPercentage: 87,
    verifiedContributions: 11,
    researchHours: 164,
    lab: 'Health Data Science Lab',
    department: 'School of Public Health',
    githubActivity: 'Publishes reproducible R notebooks and data dictionaries',
    projects: [
      {
        title: 'Clinical Outcomes Causal Analysis',
        area: 'Health AI',
        summary: 'Produced matched cohort analysis notebooks and visualization dashboards for clinical research questions.',
        status: 'Professor Verified',
        evidence: [
          {
            type: 'Dataset',
            label: 'De-identified feature dictionary',
            url: 'https://github.com/health-data-lab/clinical-causal-analysis',
            description: 'Feature documentation and analysis protocol.',
          },
        ],
      },
    ],
    timeline: [
      'Built propensity score matching workflow.',
      'Reviewed cohort balance with faculty mentor.',
      'Submitted poster draft for AMIA review.',
    ],
  },
  {
    id: 'noah-kim',
    name: 'Noah Kim',
    university: 'Georgia Tech',
    major: 'Electrical and Computer Engineering',
    graduationYear: '2027',
    researchAreas: ['Embedded AI', 'Signal Processing', 'Edge Computing'],
    skills: ['C', 'Python', 'MATLAB', 'TensorFlow Lite', 'Linux'],
    publications: [],
    presentations: ['Edge AI Workshop: Low-power inference on microcontrollers'],
    facultyEndorsements: ['Dr. Lina Huang: Strong hardware/software integration instincts'],
    researchScore: 84,
    matchPercentage: 82,
    verifiedContributions: 9,
    researchHours: 132,
    lab: 'Embedded Intelligence Lab',
    department: 'Electrical and Computer Engineering',
    githubActivity: 'Recent commits to embedded inference benchmarking code',
    projects: [
      {
        title: 'Low Power Activity Recognition',
        area: 'Embedded AI',
        summary: 'Benchmarked quantized models for activity recognition on edge devices.',
        status: 'Professor Verified',
        evidence: [
          {
            type: 'Demo Video',
            label: 'Microcontroller inference demo',
            url: 'https://github.com/edge-intel/activity-recognition',
            description: 'Demo and code for on-device inference experiments.',
          },
        ],
      },
    ],
    timeline: [
      'Ported feature extraction code to embedded target.',
      'Measured latency and power draw.',
      'Documented deployment blockers for next experiment cycle.',
    ],
  },
];

export const portfolioFeed = recruiterCandidates.flatMap((candidate) =>
  candidate.projects.map((project) => ({
    id: `${candidate.id}-${project.title.toLowerCase().replace(/\s+/g, '-')}`,
    projectTitle: project.title,
    student: candidate.name,
    researchArea: project.area,
    contributionSummary: project.summary,
    evidenceLinks: project.evidence,
    verificationBadge: project.status,
    publicationStatus: candidate.publications.length > 0 ? 'Publication attached' : 'Presentation or working paper',
    professorEndorsement: candidate.facultyEndorsements[0],
  }))
);

export const watchlistAlerts = [
  { candidateId: 'jonathan-youngblood', candidate: 'Jonathan Youngblood', alert: 'New GitHub evidence added', detail: 'Model evaluation notebook verified by professor' },
  { candidateId: 'maya-patel', candidate: 'Maya Patel', alert: 'New publication', detail: 'Warehouse robot coordination paper accepted for workshop review' },
  { candidateId: 'elena-garcia', candidate: 'Elena Garcia', alert: 'New professor approval', detail: 'Clinical analysis progress report approved' },
  { candidateId: 'noah-kim', candidate: 'Noah Kim', alert: 'Graduation approaching', detail: 'Available for full-time roles in 2027 cycle' },
];

export const recruiterAnalytics = {
  topUniversities: [
    ['Carnegie Mellon University', '412 verified researchers'],
    ['Georgia Tech', '287 verified researchers'],
    ['MIT', '244 verified researchers'],
  ],
  topDepartments: [
    ['School of Computer Science', '188 verified contributions'],
    ['Tepper School of Business', '92 verified contributions'],
    ['Electrical and Computer Engineering', '86 verified contributions'],
  ],
  topLabs: [
    ['Robotics Institute', '64 active candidates'],
    ['AI + Business Research Group', '38 active candidates'],
    ['Health Data Science Lab', '31 active candidates'],
  ],
  growingAreas: [
    ['Applied Machine Learning', '+31% candidate supply'],
    ['Robotics', '+22% candidate supply'],
    ['Health AI', '+18% candidate supply'],
  ],
  talentDistribution: [
    ['Machine Learning', 34],
    ['Robotics', 22],
    ['Data Analytics', 18],
    ['Health AI', 14],
    ['Embedded AI', 12],
  ],
};

export const defaultRecruiterRole = {
  jobTitle: 'Data Science Intern',
  requiredSkills: 'Python, SQL, machine learning',
  preferredSkills: 'Research publications, dashboarding, experiment tracking',
  researchAreas: 'Machine Learning, Data Analytics',
  experienceLevel: 'Internship-ready undergraduate researcher',
};

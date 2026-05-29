import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface ApplicationQuestion {
  question: string;
  wordLimit?: number;
}

export interface ResearchPosting {
  id: string;
  professorId: string;
  professorName: string;
  professorEmail: string;
  professorBioUrl?: string;
  professorDepartment: string;
  category: string;
  title: string;
  overview: string;
  studentRoleDescription: string;
  studentGain: string;
  requiredQualifications: string;
  preferredQualifications: string;
  timeCommitmentExpected: string;
  startDate: string;
  duration: string;
  applicationDeadline: string;
  compensation: 'stipend' | 'volunteer' | 'course credit' | 'tbd';
  questions: ApplicationQuestion[];
  createdAt: string;
  status: 'published' | 'pending_approval' | 'closed';
}

export interface Application {
  id: string;
  postingId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentMajor: string;
  resume: {
    name: string;
    uploadDate: string;
  };
  answers?: Record<string, string>;
  quickNote: string;
  status: 'Pending' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Accepted';
  submittedAt: string;
}

interface DataContextType {
  postings: ResearchPosting[];
  applications: Application[];
  addPosting: (posting: Omit<ResearchPosting, 'id' | 'createdAt'>) => void;
  updatePosting: (id: string, updates: Partial<ResearchPosting>) => void;
  addApplication: (application: Omit<Application, 'id' | 'submittedAt'>) => void;
  updateApplicationStatus: (id: string, status: Application['status']) => void;
  getPostingsByProfessor: (professorId: string) => ResearchPosting[];
  getApplicationsByPosting: (postingId: string) => Application[];
  getApplicationsByStudent: (studentId: string) => Application[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MOCK_POSTINGS: ResearchPosting[] = [
  {
    id: '1',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'Machine Learning',
    title: 'Deep Learning for Medical Image Analysis',
    overview: 'This project develops deep learning architectures for automated diagnosis from radiological images and targets publication-quality outcomes.',
    studentRoleDescription: 'Implement and evaluate model pipelines, run experiments, and contribute to weekly research syncs.',
    studentGain: 'Hands-on research publication experience and mentorship in modern ML workflows.',
    requiredQualifications: 'Strong Python and machine learning fundamentals.',
    preferredQualifications: 'PyTorch/TensorFlow and computer vision coursework.',
    timeCommitmentExpected: '10-15 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester (Fall 2026)',
    applicationDeadline: '2026-06-15',
    compensation: 'stipend',
    questions: [
      { question: 'Describe your experience with deep learning frameworks', wordLimit: 150 },
      { question: 'What interests you most about this research area?', wordLimit: 100 },
    ],
    createdAt: '2026-05-01',
    status: 'published',
  },
  {
    id: '2',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'Human-Computer Interaction',
    title: 'Accessibility in Virtual Reality Environments',
    overview: 'Investigating how to make VR experiences accessible to users with disabilities through user studies and prototype validation.',
    studentRoleDescription: 'Support study design, prototype interaction flows, and analyze feedback data.',
    studentGain: 'Experience in inclusive design research and mixed-method evaluation.',
    requiredQualifications: 'Interest in HCI and accessibility, strong communication skills.',
    preferredQualifications: 'Unity/Unreal experience.',
    timeCommitmentExpected: '12-18 hours per week',
    startDate: '2026-08-25',
    duration: '2 semesters (Fall 2026 - Spring 2027)',
    applicationDeadline: '2026-06-20',
    compensation: 'course credit',
    questions: [
      { question: 'Have you worked with VR development before?', wordLimit: 100 },
      { question: 'Why are you interested in accessibility research?', wordLimit: 150 },
    ],
    createdAt: '2026-05-05',
    status: 'published',
  },
  {
    id: '3',
    professorId: 'prof3',
    professorName: 'Dr. Emily Watson',
    professorEmail: 'ewatson@andrew.cmu.edu',
    professorDepartment: 'Robotics Institute',
    category: 'Robotics',
    title: 'Multi-Robot Coordination for Warehouse Automation',
    overview: 'Developing coordination algorithms for fleets of autonomous warehouse robots and validating in simulation and hardware.',
    studentRoleDescription: 'Build coordination modules, run benchmark scenarios, and document experiment results.',
    studentGain: 'Applied robotics systems experience in a production-style research environment.',
    requiredQualifications: 'Algorithms and systems programming fundamentals.',
    preferredQualifications: 'ROS experience and robotics coursework.',
    timeCommitmentExpected: '15-20 hours per week',
    startDate: '2026-08-25',
    duration: '1 academic year',
    applicationDeadline: '2026-06-10',
    compensation: 'tbd',
    questions: [
      { question: 'What robotics stack have you used in prior projects?', wordLimit: 150 },
      { question: 'Describe a challenging debugging issue and how you resolved it.', wordLimit: 150 },
    ],
    createdAt: '2026-05-03',
    status: 'published',
  },
  {
    id: '4',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'Natural Language Processing',
    title: 'Efficient LLM Fine-Tuning for Scientific Text',
    overview: 'Study parameter-efficient tuning methods for domain-specific scientific corpora and evaluate quality-cost tradeoffs.',
    studentRoleDescription: 'Build training/evaluation scripts, run ablations, and summarize results in lab notes.',
    studentGain: 'Practical experience with modern NLP pipelines and research experimentation.',
    requiredQualifications: 'Python, basic deep learning, and data handling skills.',
    preferredQualifications: 'Transformers experience and familiarity with Hugging Face.',
    timeCommitmentExpected: '10-12 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester (Fall 2026)',
    applicationDeadline: '2026-06-22',
    compensation: 'stipend',
    questions: [
      { question: 'Describe your NLP project experience.', wordLimit: 120 },
      { question: 'What would you measure to evaluate model quality?', wordLimit: 120 },
    ],
    createdAt: '2026-05-06',
    status: 'published',
  },
  {
    id: '5',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'Human-Computer Interaction',
    title: 'Adaptive Interfaces for First-Time Programmers',
    overview: 'Design and test adaptive UI cues that help novices debug and understand code more effectively.',
    studentRoleDescription: 'Prototype interaction patterns, run user studies, and clean/analyze usage logs.',
    studentGain: 'Hands-on HCI study design and quantitative/qualitative analysis.',
    requiredQualifications: 'Interest in education technology and UX research.',
    preferredQualifications: 'Figma or frontend prototyping experience.',
    timeCommitmentExpected: '8-12 hours per week',
    startDate: '2026-08-25',
    duration: '2 semesters',
    applicationDeadline: '2026-06-25',
    compensation: 'course credit',
    questions: [
      { question: 'How would you evaluate whether an interface helps learning?', wordLimit: 120 },
      { question: 'Share one UX improvement idea for coding tools.', wordLimit: 100 },
    ],
    createdAt: '2026-05-07',
    status: 'published',
  },
  {
    id: '6',
    professorId: 'prof3',
    professorName: 'Dr. Emily Watson',
    professorEmail: 'ewatson@andrew.cmu.edu',
    professorDepartment: 'Robotics Institute',
    category: 'Robotics',
    title: 'SLAM Benchmarking in Indoor Dynamic Scenes',
    overview: 'Benchmark modern SLAM stacks in dynamic indoor environments using custom datasets and metrics.',
    studentRoleDescription: 'Run pipelines, instrument metrics, and document reproducible experiment protocols.',
    studentGain: 'Experience with robotics evaluation and reproducibility best practices.',
    requiredQualifications: 'Strong programming and systems debugging ability.',
    preferredQualifications: 'ROS2 and sensor fusion familiarity.',
    timeCommitmentExpected: '12-15 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester (Fall 2026)',
    applicationDeadline: '2026-06-18',
    compensation: 'tbd',
    questions: [
      { question: 'What metrics matter for SLAM evaluation?', wordLimit: 130 },
      { question: 'Describe a time you improved an experiment pipeline.', wordLimit: 130 },
    ],
    createdAt: '2026-05-08',
    status: 'published',
  },
  {
    id: '7',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'Data Science',
    title: 'Causal Inference for Campus Mobility Data',
    overview: 'Apply causal inference techniques to understand interventions that improve campus transit efficiency.',
    studentRoleDescription: 'Curate datasets, implement models, and create visual summaries for stakeholders.',
    studentGain: 'Applied causal modeling and data storytelling skills.',
    requiredQualifications: 'Statistics and Python data analysis.',
    preferredQualifications: 'Prior work with causal inference libraries.',
    timeCommitmentExpected: '10 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-23',
    compensation: 'volunteer',
    questions: [
      { question: 'What is one challenge in observational data analysis?', wordLimit: 120 },
      { question: 'How would you communicate uncertainty to non-experts?', wordLimit: 100 },
    ],
    createdAt: '2026-05-09',
    status: 'published',
  },
  {
    id: '8',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'Human-Computer Interaction',
    title: 'Voice UI Usability in Noisy Environments',
    overview: 'Investigate interaction breakdowns and design robust prompts for voice interfaces in realistic settings.',
    studentRoleDescription: 'Prototype flows, recruit participants, and code usability sessions.',
    studentGain: 'Real-world UX research and mixed-method analysis experience.',
    requiredQualifications: 'Communication skills and curiosity about user behavior.',
    preferredQualifications: 'Survey/interview or audio processing exposure.',
    timeCommitmentExpected: '8-10 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-21',
    compensation: 'course credit',
    questions: [
      { question: 'What makes voice interfaces frustrating to users?', wordLimit: 120 },
      { question: 'How would you structure a usability test?', wordLimit: 120 },
    ],
    createdAt: '2026-05-10',
    status: 'published',
  },
  {
    id: '9',
    professorId: 'prof3',
    professorName: 'Dr. Emily Watson',
    professorEmail: 'ewatson@andrew.cmu.edu',
    professorDepartment: 'Robotics Institute',
    category: 'Robotics',
    title: 'Low-Cost Manipulator Control for Lab Automation',
    overview: 'Develop robust controllers for low-cost robotic arms in repetitive lab tasks.',
    studentRoleDescription: 'Implement control loops, collect telemetry, and tune for robustness.',
    studentGain: 'Practical robotics control and hardware integration skills.',
    requiredQualifications: 'Control systems basics and strong coding skills.',
    preferredQualifications: 'Embedded systems or motor-control experience.',
    timeCommitmentExpected: '12-16 hours per week',
    startDate: '2026-08-25',
    duration: '2 semesters',
    applicationDeadline: '2026-06-19',
    compensation: 'stipend',
    questions: [
      { question: 'What is your approach to tuning controllers?', wordLimit: 120 },
      { question: 'Describe experience with hardware debugging.', wordLimit: 120 },
    ],
    createdAt: '2026-05-11',
    status: 'published',
  },
  {
    id: '10',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'Computer Vision',
    title: 'Self-Supervised Learning for Satellite Imagery',
    overview: 'Explore self-supervised representations for downstream land-use classification tasks.',
    studentRoleDescription: 'Prepare geospatial datasets, train models, and benchmark transfer performance.',
    studentGain: 'Computer vision research experience on real-world remote sensing data.',
    requiredQualifications: 'Python and machine learning coursework.',
    preferredQualifications: 'Experience with PyTorch and geospatial tooling.',
    timeCommitmentExpected: '10-14 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-24',
    compensation: 'stipend',
    questions: [
      { question: 'What is self-supervised learning and why is it useful?', wordLimit: 120 },
      { question: 'How would you evaluate representation quality?', wordLimit: 120 },
    ],
    createdAt: '2026-05-12',
    status: 'published',
  },
  {
    id: '11',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'Education Technology',
    title: 'AI Tutor Feedback Timing Study',
    overview: 'Analyze when AI-generated hints are most helpful for novice problem solving.',
    studentRoleDescription: 'Instrument study prototypes, collect logs, and perform statistical comparisons.',
    studentGain: 'Experimental design and product-oriented research skills.',
    requiredQualifications: 'Statistics basics and scripting ability.',
    preferredQualifications: 'Prior study/research assistant work.',
    timeCommitmentExpected: '8-12 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-26',
    compensation: 'course credit',
    questions: [
      { question: 'How would you define a useful hint?', wordLimit: 120 },
      { question: 'What confounders would you watch for?', wordLimit: 120 },
    ],
    createdAt: '2026-05-13',
    status: 'published',
  },
  {
    id: '12',
    professorId: 'prof3',
    professorName: 'Dr. Emily Watson',
    professorEmail: 'ewatson@andrew.cmu.edu',
    professorDepartment: 'Robotics Institute',
    category: 'Autonomous Systems',
    title: 'Trajectory Planning Under Uncertainty',
    overview: 'Investigate planning algorithms that maintain safety under uncertain sensing conditions.',
    studentRoleDescription: 'Implement planners, evaluate safety metrics, and improve runtime performance.',
    studentGain: 'Strong exposure to autonomous system planning pipelines.',
    requiredQualifications: 'Algorithms and probability fundamentals.',
    preferredQualifications: 'Motion planning libraries or robotics simulations.',
    timeCommitmentExpected: '10-15 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-20',
    compensation: 'tbd',
    questions: [
      { question: 'How do you think about safety in planning?', wordLimit: 130 },
      { question: 'Describe your most complex algorithmic project.', wordLimit: 130 },
    ],
    createdAt: '2026-05-14',
    status: 'published',
  },
  {
    id: '13',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'Machine Learning',
    title: 'Fairness Auditing for Scholarship Recommendation Models',
    overview: 'Build auditing pipelines to quantify and mitigate bias in recommendation systems.',
    studentRoleDescription: 'Implement fairness metrics, run mitigation experiments, and report findings.',
    studentGain: 'Practical ML fairness and responsible AI experience.',
    requiredQualifications: 'Data analysis and machine learning basics.',
    preferredQualifications: 'Experience with fairness metrics/toolkits.',
    timeCommitmentExpected: '9-12 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-27',
    compensation: 'volunteer',
    questions: [
      { question: 'What fairness definition do you find most practical and why?', wordLimit: 120 },
      { question: 'How would you present bias results to stakeholders?', wordLimit: 120 },
    ],
    createdAt: '2026-05-15',
    status: 'published',
  },
  {
    id: '14',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'Design Research',
    title: 'Cross-Cultural Interface Icon Comprehension',
    overview: 'Study how icon metaphors are interpreted across cultural backgrounds and contexts.',
    studentRoleDescription: 'Prepare study materials, coordinate participants, and synthesize outcomes.',
    studentGain: 'End-to-end design research process experience.',
    requiredQualifications: 'Strong written communication and organization.',
    preferredQualifications: 'Survey/statistical analysis familiarity.',
    timeCommitmentExpected: '8-10 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-28',
    compensation: 'course credit',
    questions: [
      { question: 'How would you avoid bias in participant recruitment?', wordLimit: 120 },
      { question: 'What is one culturally specific UI assumption you have seen?', wordLimit: 120 },
    ],
    createdAt: '2026-05-16',
    status: 'published',
  },
  {
    id: '15',
    professorId: 'prof3',
    professorName: 'Dr. Emily Watson',
    professorEmail: 'ewatson@andrew.cmu.edu',
    professorDepartment: 'Robotics Institute',
    category: 'Robotics',
    title: 'Perception-Driven Grasp Planning',
    overview: 'Use 3D perception to improve grasp success in cluttered tabletop scenes.',
    studentRoleDescription: 'Develop grasp ranking features and evaluate success rates in simulation.',
    studentGain: 'Perception + manipulation integration experience.',
    requiredQualifications: 'Linear algebra and programming.',
    preferredQualifications: '3D geometry or point cloud processing experience.',
    timeCommitmentExpected: '10-14 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-22',
    compensation: 'stipend',
    questions: [
      { question: 'What makes grasping hard in clutter?', wordLimit: 120 },
      { question: 'How would you measure grasp planner quality?', wordLimit: 120 },
    ],
    createdAt: '2026-05-17',
    status: 'published',
  },
  {
    id: '16',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'Data Engineering',
    title: 'Streaming Pipelines for Campus Sensor Data',
    overview: 'Build resilient real-time pipelines for ingesting and analyzing campus-wide sensor streams.',
    studentRoleDescription: 'Implement ETL jobs, validate data quality, and optimize query performance.',
    studentGain: 'Production-style data engineering and observability skills.',
    requiredQualifications: 'SQL and Python fundamentals.',
    preferredQualifications: 'Kafka/Spark or cloud data platform exposure.',
    timeCommitmentExpected: '10-12 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-26',
    compensation: 'tbd',
    questions: [
      { question: 'How do you detect data quality regressions?', wordLimit: 120 },
      { question: 'What tradeoffs matter in streaming design?', wordLimit: 120 },
    ],
    createdAt: '2026-05-18',
    status: 'published',
  },
  {
    id: '17',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'Cognitive Science',
    title: 'Attention Patterns in Multi-Panel Dashboards',
    overview: 'Understand how users allocate attention across dense analytics dashboards.',
    studentRoleDescription: 'Design tasks, analyze interaction logs, and produce actionable design guidance.',
    studentGain: 'Cognitive UX research methods and analytics practice.',
    requiredQualifications: 'Interest in cognition and interaction design.',
    preferredQualifications: 'Eye-tracking or clickstream analysis background.',
    timeCommitmentExpected: '8-10 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-23',
    compensation: 'course credit',
    questions: [
      { question: 'What signals indicate cognitive overload?', wordLimit: 120 },
      { question: 'How would you compare two dashboard layouts?', wordLimit: 120 },
    ],
    createdAt: '2026-05-19',
    status: 'published',
  },
  {
    id: '18',
    professorId: 'prof3',
    professorName: 'Dr. Emily Watson',
    professorEmail: 'ewatson@andrew.cmu.edu',
    professorDepartment: 'Robotics Institute',
    category: 'Embedded Systems',
    title: 'Energy Profiling for Mobile Robot Subsystems',
    overview: 'Measure and optimize power consumption for sensing, planning, and actuation components.',
    studentRoleDescription: 'Instrument subsystems, run profiling experiments, and recommend optimizations.',
    studentGain: 'Embedded profiling and systems optimization experience.',
    requiredQualifications: 'C/C++ and systems thinking.',
    preferredQualifications: 'Microcontroller or hardware lab experience.',
    timeCommitmentExpected: '10-14 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-24',
    compensation: 'stipend',
    questions: [
      { question: 'What is one technique for reducing power usage?', wordLimit: 120 },
      { question: 'How would you design a repeatable profiling experiment?', wordLimit: 120 },
    ],
    createdAt: '2026-05-20',
    status: 'published',
  },
  {
    id: '19',
    professorId: 'prof1',
    professorName: 'Dr. Sarah Chen',
    professorEmail: 'schen@andrew.cmu.edu',
    professorDepartment: 'Computer Science',
    category: 'NLP',
    title: 'Multilingual Summarization for Technical Documents',
    overview: 'Develop and evaluate summarization pipelines for multilingual technical writing.',
    studentRoleDescription: 'Create evaluation datasets, tune models, and compare baseline systems.',
    studentGain: 'NLP model evaluation and multilingual data handling experience.',
    requiredQualifications: 'Python and ML foundations.',
    preferredQualifications: 'NLP coursework and model evaluation familiarity.',
    timeCommitmentExpected: '10-12 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-29',
    compensation: 'stipend',
    questions: [
      { question: 'How would you evaluate summary quality?', wordLimit: 120 },
      { question: 'What challenges appear in multilingual NLP?', wordLimit: 120 },
    ],
    createdAt: '2026-05-21',
    status: 'published',
  },
  {
    id: '20',
    professorId: 'prof2',
    professorName: 'Dr. Michael Rodriguez',
    professorEmail: 'mrodriguez@andrew.cmu.edu',
    professorDepartment: 'Human-Computer Interaction Institute',
    category: 'User Research',
    title: 'Collaboration Friction in Hybrid Student Teams',
    overview: 'Identify communication and workflow pain points in hybrid collaboration and test interventions.',
    studentRoleDescription: 'Conduct interviews, code themes, and support intervention pilot studies.',
    studentGain: 'Qualitative research rigor and stakeholder communication practice.',
    requiredQualifications: 'Strong communication and organization skills.',
    preferredQualifications: 'Prior interview or thematic analysis experience.',
    timeCommitmentExpected: '8-11 hours per week',
    startDate: '2026-08-25',
    duration: '1 semester',
    applicationDeadline: '2026-06-30',
    compensation: 'course credit',
    questions: [
      { question: 'How would you ensure interview consistency?', wordLimit: 120 },
      { question: 'What would make an intervention practical for students?', wordLimit: 120 },
    ],
    createdAt: '2026-05-22',
    status: 'published',
  },
];

const requireProjectApproval = import.meta.env.VITE_REQUIRE_PROJECT_APPROVAL === 'true';

const PROFESSOR_BIO_URL_BY_EMAIL: Record<string, string> = {
  'schen@andrew.cmu.edu': 'https://www.cs.cmu.edu/directory/schen',
  'mrodriguez@andrew.cmu.edu': 'https://hcii.cmu.edu/people/michael-rodriguez',
  'ewatson@andrew.cmu.edu': 'https://www.ri.cmu.edu/ri-faculty/emily-watson',
};

function withProfessorBioUrl(posting: ResearchPosting): ResearchPosting {
  if (posting.professorBioUrl?.trim()) {
    return posting;
  }

  const mappedUrl = PROFESSOR_BIO_URL_BY_EMAIL[posting.professorEmail];
  if (mappedUrl) {
    return { ...posting, professorBioUrl: mappedUrl };
  }

  return {
    ...posting,
    professorBioUrl: `https://www.google.com/search?q=${encodeURIComponent(
      `${posting.professorName} ${posting.professorDepartment}`
    )}`,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [postings, setPostings] = useState<ResearchPosting[]>(() => {
    const saved = localStorage.getItem('postings');
    if (!saved) {
      return MOCK_POSTINGS.map(withProfessorBioUrl);
    }

    try {
      const parsed = JSON.parse(saved) as ResearchPosting[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return MOCK_POSTINGS.map(withProfessorBioUrl);
      }

      const existingIds = new Set(parsed.map((posting) => posting.id));
      const missingSeeds = MOCK_POSTINGS.filter((posting) => !existingIds.has(posting.id));
      return [...parsed, ...missingSeeds].map(withProfessorBioUrl);
    } catch {
      return MOCK_POSTINGS.map(withProfessorBioUrl);
    }
  });

  const [applications, setApplications] = useState<Application[]>(() => {
    const saved = localStorage.getItem('applications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('postings', JSON.stringify(postings));
  }, [postings]);

  useEffect(() => {
    localStorage.setItem('applications', JSON.stringify(applications));
  }, [applications]);

  const addPosting = (posting: Omit<ResearchPosting, 'id' | 'createdAt'>) => {
    const newPosting = withProfessorBioUrl({
      ...posting,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      status: requireProjectApproval ? 'pending_approval' : posting.status,
    });
    setPostings((prev) => [newPosting, ...prev]);
  };

  const updatePosting = (id: string, updates: Partial<ResearchPosting>) => {
    setPostings((prev) =>
      prev.map((posting) =>
        posting.id === id ? withProfessorBioUrl({ ...posting, ...updates }) : posting
      )
    );
  };

  const addApplication = (application: Omit<Application, 'id' | 'submittedAt'>) => {
    const newApplication: Application = {
      ...application,
      id: Math.random().toString(36).substr(2, 9),
      submittedAt: new Date().toISOString(),
    };
    setApplications((prev) => [newApplication, ...prev]);
  };

  const updateApplicationStatus = (id: string, status: Application['status']) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status } : app))
    );
  };

  const getPostingsByProfessor = (professorId: string) => {
    return postings.filter((p) => p.professorId === professorId);
  };

  const getApplicationsByPosting = (postingId: string) => {
    return applications.filter((a) => a.postingId === postingId);
  };

  const getApplicationsByStudent = (studentId: string) => {
    return applications.filter((a) => a.studentId === studentId);
  };

  return (
    <DataContext.Provider
      value={{
        postings,
        applications,
        addPosting,
        updatePosting,
        addApplication,
        updateApplicationStatus,
        getPostingsByProfessor,
        getApplicationsByPosting,
        getApplicationsByStudent,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

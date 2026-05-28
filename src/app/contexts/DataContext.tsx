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
];

const requireProjectApproval = import.meta.env.VITE_REQUIRE_PROJECT_APPROVAL === 'true';

export function DataProvider({ children }: { children: ReactNode }) {
  const [postings, setPostings] = useState<ResearchPosting[]>(() => {
    const saved = localStorage.getItem('postings');
    return saved ? JSON.parse(saved) : MOCK_POSTINGS;
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
    const newPosting: ResearchPosting = {
      ...posting,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      status: requireProjectApproval ? 'pending_approval' : posting.status,
    };
    setPostings((prev) => [newPosting, ...prev]);
  };

  const updatePosting = (id: string, updates: Partial<ResearchPosting>) => {
    setPostings((prev) =>
      prev.map((posting) => (posting.id === id ? { ...posting, ...updates } : posting))
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

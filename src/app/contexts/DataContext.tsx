import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { listPublicProjects } from '../lib/researchPlatformQueries';
import type { Json, ProjectCompensation, ProjectStatus } from '../lib/database.types';

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
  quickNoteEnabled?: boolean;
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
  projectsLoading: boolean;
  projectsError: string | null;
  refreshProjects: () => Promise<void>;
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

function buildSeedApplications(postings: ResearchPosting[]): Application[] {
  const applicants = [
    {
      studentId: 'seed_student_jonathan',
      studentName: 'Jonathan Youngblood',
      studentEmail: 'jyounb2@andrew.cmu.edu',
      studentMajor: 'AI + Business',
      quickNote: 'I am excited to contribute to this project and deepen my research skills.',
      status: 'Shortlisted' as const,
      resumeName: 'jonathan_youngblood_resume.pdf',
      submittedAt: '2026-05-21T14:00:00.000Z',
    },
    {
      studentId: 'seed_student_sarah',
      studentName: 'Sarah Chen',
      studentEmail: 'schen2@andrew.cmu.edu',
      studentMajor: 'Computer Science',
      quickNote: 'Strong interest in model development and empirical evaluation.',
      status: 'Interview' as const,
      resumeName: 'sarah_chen_resume.pdf',
      submittedAt: '2026-05-19T10:30:00.000Z',
    },
    {
      studentId: 'seed_student_alex',
      studentName: 'Alex Rivera',
      studentEmail: 'arivera@andrew.cmu.edu',
      studentMajor: 'Information Systems',
      quickNote: 'Motivated to grow in research and contribute to project execution.',
      status: 'Pending' as const,
      resumeName: 'alex_rivera_resume.pdf',
      submittedAt: '2026-05-18T09:15:00.000Z',
    },
  ];

  return postings.slice(0, 9).map((posting, index) => {
    const seed = applicants[index % applicants.length];
    return {
      id: `seed_app_${posting.id}`,
      postingId: posting.id,
      studentId: `${seed.studentId}_${posting.id}`,
      studentName: seed.studentName,
      studentEmail: seed.studentEmail,
      studentMajor: seed.studentMajor,
      resume: {
        name: seed.resumeName,
        uploadDate: seed.submittedAt,
      },
      answers: {
        'Why are you interested in this research project?': seed.quickNote,
      },
      quickNote: seed.quickNote,
      status: seed.status,
      submittedAt: seed.submittedAt,
    };
  });
}

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

type SupabasePublicProject = Awaited<ReturnType<typeof listPublicProjects>>[number];

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asQuestionArray(value: Json): ApplicationQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const question = asString(entry.question);
      if (!question) {
        return null;
      }

      const wordLimit = typeof entry.wordLimit === 'number' ? entry.wordLimit : undefined;
      return { question, wordLimit };
    })
    .filter((entry): entry is ApplicationQuestion => Boolean(entry));
}

function getProfessorDisplayName(professor: SupabasePublicProject['professors']) {
  const metadata = professor && typeof professor.metadata === 'object' && !Array.isArray(professor.metadata)
    ? professor.metadata
    : {};

  return (
    asString(metadata.full_name) ||
    asString(metadata.name) ||
    asString(professor?.title) ||
    'Research Professor'
  );
}

function mapSupabaseProjectToPosting(project: SupabasePublicProject): ResearchPosting {
  const professor = project.professors;

  return withProfessorBioUrl({
    id: project.id,
    professorId: project.professor_id ?? '',
    professorName: getProfessorDisplayName(professor),
    professorEmail: asString(professor?.contact_email),
    professorBioUrl: professor?.bio_url ?? undefined,
    professorDepartment: asString(professor?.department, 'Research'),
    category: asString(project.category, 'Other'),
    title: project.title,
    overview: asString(project.overview),
    studentRoleDescription: asString(project.student_role_description),
    studentGain: asString(project.student_gain),
    requiredQualifications: asString(project.required_qualifications),
    preferredQualifications: asString(project.preferred_qualifications),
    timeCommitmentExpected: asString(project.time_commitment_expected),
    startDate: asString(project.start_date),
    duration: asString(project.duration),
    applicationDeadline: asString(project.application_deadline),
    compensation: (project.compensation ?? 'tbd') as ProjectCompensation,
    questions: asQuestionArray(project.questions),
    quickNoteEnabled: project.quick_note_enabled,
    createdAt: project.created_at,
    status: (project.status === 'archived' ? 'closed' : project.status) as Exclude<ProjectStatus, 'archived'>,
  });
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [postings, setPostings] = useState<ResearchPosting[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>(() => {
    const saved = localStorage.getItem('applications');
    const seedApplications = buildSeedApplications(postings);

    if (!saved) {
      return seedApplications;
    }

    try {
      const parsed = JSON.parse(saved) as Application[];
      if (!Array.isArray(parsed)) {
        return seedApplications;
      }

      const existingIds = new Set(parsed.map((application) => application.id));
      const missingSeeds = seedApplications.filter((application) => !existingIds.has(application.id));
      return [...parsed, ...missingSeeds];
    } catch {
      return seedApplications;
    }
  });

  const refreshProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const projects = await listPublicProjects();
      setPostings(projects.map(mapSupabaseProjectToPosting));
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : 'Unable to load research projects.');
      setPostings([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    void refreshProjects();
  }, []);

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
        projectsLoading,
        projectsError,
        refreshProjects,
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


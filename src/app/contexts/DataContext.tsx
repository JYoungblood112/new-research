import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  createApplication,
  listMyApplications,
  listProjectApplications,
  listPublicProjects,
  updateProjectApplicationStatus,
} from '../lib/researchPlatformQueries';
import type { ApplicationRow, ApplicationStatus, Json, ProjectCompensation, ProjectStatus } from '../lib/database.types';

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
  professorResearchAreas?: string[];
  professorResearchInterests?: string[];
  category: string;
  researchAreas: string[];
  skillsNeeded: string[];
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
  applicationsLoading: boolean;
  applicationsError: string | null;
  refreshApplications: () => Promise<void>;
  addPosting: (posting: Omit<ResearchPosting, 'id' | 'createdAt'>) => void;
  updatePosting: (id: string, updates: Partial<ResearchPosting>) => void;
  addApplication: (application: Omit<Application, 'id' | 'submittedAt'>) => Promise<Application>;
  updateApplicationStatus: (id: string, status: Application['status']) => Promise<void>;
  getPostingsByProfessor: (professorId: string) => ResearchPosting[];
  getApplicationsByPosting: (postingId: string) => Application[];
  getApplicationsByStudent: (studentId: string) => Application[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const requireProjectApproval = import.meta.env.VITE_REQUIRE_PROJECT_APPROVAL === 'true';

const PROFESSOR_BIO_URL_BY_EMAIL: Record<string, string> = {
  'schen@andrew.cmu.edu': 'https://www.cs.cmu.edu/directory/schen',
  'mrodriguez@andrew.cmu.edu': 'https://hcii.cmu.edu/people/michael-rodriguez',
  'ewatson@andrew.cmu.edu': 'https://www.ri.cmu.edu/ri-faculty/emily-watson',
};

function withProfessorBioUrl(posting: ResearchPosting): ResearchPosting {
  const normalizedPosting = {
    ...posting,
    researchAreas: Array.isArray(posting.researchAreas) ? posting.researchAreas : [],
    skillsNeeded: Array.isArray(posting.skillsNeeded) ? posting.skillsNeeded : [],
    professorResearchAreas: Array.isArray(posting.professorResearchAreas) ? posting.professorResearchAreas : [],
    professorResearchInterests: Array.isArray(posting.professorResearchInterests) ? posting.professorResearchInterests : [],
  };

  if (posting.professorBioUrl?.trim()) {
    return normalizedPosting;
  }

  const mappedUrl = PROFESSOR_BIO_URL_BY_EMAIL[posting.professorEmail];
  if (mappedUrl) {
    return { ...normalizedPosting, professorBioUrl: mappedUrl };
  }

  return {
    ...normalizedPosting,
    professorBioUrl: `https://www.google.com/search?q=${encodeURIComponent(
      `${posting.professorName} ${posting.professorDepartment}`
    )}`,
  };
}

type SupabasePublicProject = Awaited<ReturnType<typeof listPublicProjects>>[number];

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
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
    professorResearchAreas: Array.isArray(professor?.research_areas) ? professor.research_areas : [],
    professorResearchInterests: Array.isArray(professor?.research_interests) ? professor.research_interests : [],
    category: asString(project.category, 'Other'),
    researchAreas: asStringArray(project.research_areas),
    skillsNeeded: asStringArray(project.skills_needed),
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

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asAnswerRecord(value: Json): Record<string, string> | undefined {
  const record = asRecord(value);
  const entries = Object.entries(record)
    .filter(([, answer]) => typeof answer === 'string')
    .map(([question, answer]) => [question, answer as string]);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function asResume(value: Json): Application['resume'] {
  const record = asRecord(value);
  return {
    name: asString(record.name, 'Resume.pdf'),
    uploadDate: asString(record.uploadDate, new Date().toISOString()),
  };
}

function mapSupabaseApplicationToApplication(row: ApplicationRow): Application {
  const snapshot = asRecord(row.student_snapshot);

  return {
    id: row.id,
    postingId: row.project_id,
    studentId: row.student_id,
    studentName: asString(snapshot.name, 'Student Applicant'),
    studentEmail: asString(snapshot.email),
    studentMajor: asString(snapshot.major, 'Undeclared'),
    resume: asResume(row.resume),
    answers: asAnswerRecord(row.answers),
    quickNote: row.quick_note ?? '',
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [postings, setPostings] = useState<ResearchPosting[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);

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

  const refreshApplications = async () => {
    if (!user) {
      setApplications([]);
      setApplicationsError(null);
      setApplicationsLoading(false);
      return;
    }

    setApplicationsLoading(true);
    setApplicationsError(null);

    try {
      if (user.role === 'student') {
        const rows = await listMyApplications(user.id);
        setApplications(rows.map((row) => mapSupabaseApplicationToApplication(row as ApplicationRow)));
        return;
      }

      if (user.role === 'professor') {
        const ownedPostings = postings.filter((posting) => posting.professorId === user.id);
        const rows = await Promise.all(ownedPostings.map((posting) => listProjectApplications(posting.id)));
        setApplications(rows.flat().map((row) => mapSupabaseApplicationToApplication(row as ApplicationRow)));
        return;
      }

      setApplications([]);
    } catch (error) {
      setApplicationsError(error instanceof Error ? error.message : 'Unable to load applications.');
      setApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  };

  useEffect(() => {
    void refreshApplications();
  }, [user?.id, user?.role, postings]);

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

  const addApplication = async (application: Omit<Application, 'id' | 'submittedAt'>) => {
    const row = await createApplication({
      project_id: application.postingId,
      student_id: application.studentId,
      answers: (application.answers ?? {}) as Json,
      quick_note: application.quickNote,
      resume: application.resume as Json,
      status: application.status,
      student_snapshot: {
        name: application.studentName,
        email: application.studentEmail,
        major: application.studentMajor,
      } as Json,
    });
    const savedApplication = mapSupabaseApplicationToApplication(row);
    setApplications((prev) => [savedApplication, ...prev.filter((entry) => entry.id !== savedApplication.id)]);
    return savedApplication;
  };

  const updateApplicationStatus = async (id: string, status: Application['status']) => {
    await updateProjectApplicationStatus(id, status as ApplicationStatus);
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
        applicationsLoading,
        applicationsError,
        refreshApplications,
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


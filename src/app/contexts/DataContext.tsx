import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  createApplication,
  createProject,
  getCurrentProfessor,
  listMyApplications,
  listProjectApplications,
  listProfessorProjects,
  listPublicProjects,
  updateProject,
  updateProjectApplicationStatus,
} from '../lib/researchPlatformQueries';
import { supabase } from '../lib/supabase';
import type { ProfessorSetupProfile, User } from '../lib/api';
import type { ApplicationRow, ApplicationStatus, Json, ProjectCompensation, ProjectRow, ProjectStatus } from '../lib/database.types';

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
  coursework: Array<string | { courseNumber?: string; courseName?: string; semester?: string }>;
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
  addPosting: (posting: Omit<ResearchPosting, 'id' | 'createdAt'>) => Promise<ResearchPosting>;
  updatePosting: (id: string, updates: Partial<ResearchPosting>) => Promise<void>;
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
type ProjectInsert = Parameters<typeof createProject>[0];
type ProjectUpdate = Parameters<typeof updateProject>[1];

type ProfessorSnapshot = {
  name: string;
  email: string;
  department: string;
  bioUrl?: string;
  researchAreas?: string[];
  researchInterests?: string[];
};

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

function asProjectRecord(project: unknown): Record<string, any> {
  return project && typeof project === 'object' && !Array.isArray(project) ? project as Record<string, any> : {};
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
  const projectRecord = asProjectRecord(project);
  const professor = projectRecord.professors;

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

function mapProjectRowToPosting(project: ProjectRow, professor: ProfessorSnapshot): ResearchPosting {
  return withProfessorBioUrl({
    id: project.id,
    professorId: project.professor_id ?? '',
    professorName: professor.name,
    professorEmail: professor.email,
    professorBioUrl: professor.bioUrl,
    professorDepartment: professor.department,
    professorResearchAreas: professor.researchAreas ?? [],
    professorResearchInterests: professor.researchInterests ?? [],
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

export function createProjectPayload(
  formState: Omit<ResearchPosting, 'id' | 'createdAt' | 'professorId'>,
  currentUser: User,
  professorProfile: ProfessorSetupProfile
): ProjectInsert {
  if (currentUser.role !== 'professor') {
    throw new Error('Only professor accounts can create research opportunities.');
  }

  if (!professorProfile.id || professorProfile.id !== currentUser.id) {
    throw new Error('Professor profile is missing or does not match the signed-in user.');
  }

  return {
    professor_id: currentUser.id,
    title: formState.title.trim(),
    category: formState.category.trim() || null,
    research_areas: formState.researchAreas.filter(Boolean),
    skills_needed: formState.skillsNeeded.filter(Boolean),
    overview: formState.overview.trim() || null,
    student_role_description: formState.studentRoleDescription.trim() || null,
    student_gain: formState.studentGain.trim() || null,
    required_qualifications: formState.requiredQualifications.trim() || null,
    preferred_qualifications: formState.preferredQualifications.trim() || null,
    time_commitment_expected: formState.timeCommitmentExpected.trim() || null,
    start_date: formState.startDate || null,
    duration: formState.duration || null,
    application_deadline: formState.applicationDeadline || null,
    compensation: formState.compensation,
    questions: formState.questions as Json,
    quick_note_enabled: formState.quickNoteEnabled ?? true,
    status: requireProjectApproval ? 'pending_approval' : formState.status,
  };
}

function postingUpdatesToProjectUpdate(updates: Partial<ResearchPosting>): ProjectUpdate {
  const projectUpdate: ProjectUpdate = {};

  if (updates.category !== undefined) projectUpdate.category = updates.category;
  if (updates.researchAreas !== undefined) projectUpdate.research_areas = updates.researchAreas;
  if (updates.skillsNeeded !== undefined) projectUpdate.skills_needed = updates.skillsNeeded;
  if (updates.title !== undefined) projectUpdate.title = updates.title;
  if (updates.overview !== undefined) projectUpdate.overview = updates.overview;
  if (updates.studentRoleDescription !== undefined) projectUpdate.student_role_description = updates.studentRoleDescription;
  if (updates.studentGain !== undefined) projectUpdate.student_gain = updates.studentGain;
  if (updates.requiredQualifications !== undefined) projectUpdate.required_qualifications = updates.requiredQualifications;
  if (updates.preferredQualifications !== undefined) projectUpdate.preferred_qualifications = updates.preferredQualifications;
  if (updates.timeCommitmentExpected !== undefined) projectUpdate.time_commitment_expected = updates.timeCommitmentExpected;
  if (updates.startDate !== undefined) projectUpdate.start_date = updates.startDate;
  if (updates.duration !== undefined) projectUpdate.duration = updates.duration;
  if (updates.applicationDeadline !== undefined) projectUpdate.application_deadline = updates.applicationDeadline;
  if (updates.compensation !== undefined) projectUpdate.compensation = updates.compensation;
  if (updates.questions !== undefined) projectUpdate.questions = updates.questions as Json;
  if (updates.quickNoteEnabled !== undefined) projectUpdate.quick_note_enabled = updates.quickNoteEnabled;
  if (updates.status !== undefined) projectUpdate.status = updates.status;

  return projectUpdate;
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

function asCoursework(value: unknown): Application['coursework'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }

      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const courseNumber = asString(entry.courseNumber);
      const courseName = asString(entry.courseName);
      const semester = asString(entry.semester);

      if (!courseNumber && !courseName) {
        return null;
      }

      return { courseNumber, courseName, semester };
    })
    .filter((entry): entry is Application['coursework'][number] => Boolean(entry));
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
    coursework: asCoursework(snapshot.coursework),
    resume: asResume(row.resume),
    answers: asAnswerRecord(row.answers),
    quickNote: row.quick_note ?? '',
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, setupState } = useAuth();
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
      const publicPostings = projects.map(mapSupabaseProjectToPosting);

      if (user?.role !== 'professor') {
        setPostings(publicPostings);
        return;
      }

      const professorProfile = setupState?.profile as
        | {
            department?: string;
            bioUrl?: string;
            researchAreas?: string[];
            researchInterests?: string[];
          }
        | null
        | undefined;
      const professorSnapshot: ProfessorSnapshot = {
        name: user.name,
        email: user.email,
        department: professorProfile?.department ?? 'Research',
        bioUrl: professorProfile?.bioUrl,
        researchAreas: professorProfile?.researchAreas ?? [],
        researchInterests: professorProfile?.researchInterests ?? [],
      };
      const professorProjects = await listProfessorProjects(user.id);
      const ownPostings = professorProjects.map((project) => mapProjectRowToPosting(project as ProjectRow, professorSnapshot));
      const postingMap = new Map<string, ResearchPosting>();

      for (const posting of publicPostings) {
        postingMap.set(posting.id, posting);
      }
      for (const posting of ownPostings) {
        postingMap.set(posting.id, posting);
      }

      setPostings(Array.from(postingMap.values()));
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : 'Unable to load research projects.');
      setPostings([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    void refreshProjects();
  }, [user?.id, user?.role, setupState?.profile]);

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

  const addPosting = async (posting: Omit<ResearchPosting, 'id' | 'createdAt'>) => {
    if (!user || user.role !== 'professor') {
      throw new Error('Only professor accounts can create research opportunities.');
    }

    const { data: authData, error: authError } = supabase
      ? await supabase.auth.getUser()
      : { data: { user: null }, error: new Error('Supabase is not configured.') };

    if (authError || !authData.user) {
      throw new Error('Your session expired. Please sign in again before creating a project.');
    }

    if (authData.user.id !== user.id) {
      throw new Error('Signed-in Supabase user does not match the active professor account.');
    }

    const professorRow = await getCurrentProfessor().catch(() => null);
    if (!professorRow || professorRow.id !== authData.user.id) {
      throw new Error('Complete your professor profile before creating a research opportunity.');
    }

    const professorProfile = {
      id: professorRow.id,
      department: professorRow.department ?? undefined,
      title: professorRow.title ?? undefined,
      contactEmail: professorRow.contact_email ?? undefined,
      bioUrl: professorRow.bio_url ?? undefined,
      researchAreas: professorRow.research_areas,
      researchInterests: professorRow.research_interests,
    } satisfies ProfessorSetupProfile;
    const insertPayload = createProjectPayload(posting, user, professorProfile);
    if (import.meta.env.DEV) {
      console.debug('Create Opportunity insert payload', insertPayload);
    }
    const row = await createProject(insertPayload);
    const newPosting = withProfessorBioUrl({
      ...posting,
      professorId: row.professor_id ?? user.id,
      id: row.id,
      createdAt: row.created_at,
      status: (row.status === 'archived' ? 'closed' : row.status) as Exclude<ProjectStatus, 'archived'>,
    });
    setPostings((prev) => [newPosting, ...prev]);
    return newPosting;
  };

  const updatePosting = async (id: string, updates: Partial<ResearchPosting>) => {
    const row = await updateProject(id, postingUpdatesToProjectUpdate(updates));
    setPostings((prev) =>
      prev.map((posting) =>
        posting.id === id
          ? withProfessorBioUrl({
              ...posting,
              ...updates,
              createdAt: row.created_at,
              status: (row.status === 'archived' ? 'closed' : row.status) as Exclude<ProjectStatus, 'archived'>,
            })
          : posting
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
        coursework: application.coursework,
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


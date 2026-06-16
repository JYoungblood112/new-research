import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  ProfessorSetupProfile,
  SetupState,
  StudentSetupProfile,
  User,
  UserRole,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { upsertProfessor, upsertProfile, upsertStudent } from '../lib/researchPlatformQueries';
import type { AppRole, Json, ProfessorRow, StudentRow } from '../lib/database.types';

export type { UserRole, User };

type StudentProfileInput = {
  name?: string;
  email?: string;
  photoBase64?: string;
  linkedin?: string;
  github?: string;
  major?: string;
  degree?: string;
  graduationYear?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  skills?: string[];
  interests?: string[];
  resume?: { name: string; uploadDate: string } | null;
  transcript?: { name: string; uploadDate: string } | null;
  transcriptText?: string | null;
  coursework?: Array<string | { courseNumber?: string; courseName?: string; semester?: string }>;
};

type ProfessorProfileInput = {
  name?: string;
  department?: string;
  title?: string;
  contactEmail?: string;
  officeHours?: string;
  bioUrl?: string;
  researchAreas?: string[];
  professorWebsite?: string;
  publicationsLink?: string;
  researchInterests?: string[];
  researchSummary?: string;
  photoBase64?: string;
};

interface AuthContextType {
  user: User | null;
  setupState: SetupState | null;
  loadingSession: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<{ user: User; setup: SetupState }>;
  signup: (payload: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }) => Promise<{ user: User | null; setup: SetupState | null; needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateStudentProfile: (profile: StudentProfileInput) => Promise<void>;
  updateProfessorProfile: (profile: ProfessorProfileInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function emptySetup(): SetupState {
  return {
    completed: false,
    profile: null,
    steps: {
      basic: false,
    },
  };
}

function asProfileObject(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : undefined;
}

function coerceStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;|\n\r]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function getUploadedFile(value: Json): { name: string; uploadDate: string } | null {
  const record = asProfileObject(value);
  const name = getString(record.name);
  if (!name) {
    return null;
  }

  return {
    name,
    uploadDate: getString(record.uploadDate) ?? new Date().toISOString(),
  };
}

function studentRowToProfile(row: StudentRow | null, user: User): StudentSetupProfile | null {
  if (!row) return null;
  const metadata = asProfileObject(row.metadata);

  return {
    id: row.id,
    userId: row.id,
    name: user.name,
    photoBase64: getString(metadata.photoBase64),
    linkedin: row.linkedin_url ?? undefined,
    github: row.github_url ?? undefined,
    linkedInUrl: row.linkedin_url ?? undefined,
    githubUrl: row.github_url ?? undefined,
    major: row.major ?? undefined,
    degree: row.degree ?? undefined,
    graduationYear: row.academic_year ?? undefined,
    skills: getStringArray(metadata.skills),
    interests: row.research_interests.length > 0 ? row.research_interests : getStringArray(metadata.interests),
    resume: getUploadedFile(row.resume),
    transcript: getUploadedFile(row.transcript),
    transcriptText: row.transcript_text ?? undefined,
    coursework: Array.isArray(row.coursework) ? (row.coursework as StudentSetupProfile['coursework']) : undefined,
  };
}

function studentSetupFromRow(row: StudentRow | null, user: User): SetupState {
  const profile = studentRowToProfile(row, user);
  const skills = profile?.skills ?? [];
  const interests = profile?.interests ?? [];
  const basic = Boolean(profile?.major && profile.graduationYear);
  const resume = Boolean(profile?.resume);

  return {
    completed: Boolean(basic && resume && interests.length > 0),
    profile,
    steps: {
      basic,
      resume,
      transcript: Boolean(profile?.transcript),
      skills: skills.length > 0,
      interests: interests.length > 0,
    },
  };
}

function professorRowToProfile(row: ProfessorRow | null, user: User): ProfessorSetupProfile | null {
  if (!row) return null;
  const metadata = asProfileObject(row.metadata);

  return {
    id: row.id,
    userId: row.id,
    name: user.name,
    department: row.department ?? undefined,
    title: row.title ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    officeHours: row.office_hours ?? undefined,
    bioUrl: row.bio_url ?? undefined,
    researchAreas: coerceStringArray(row.research_areas),
    professorWebsite: row.professor_website ?? undefined,
    publicationsLink: row.publications_link ?? undefined,
    researchInterests: coerceStringArray(row.research_interests),
    researchSummary: getString(metadata.researchSummary),
    photoBase64: getString(metadata.photoBase64),
  };
}

function professorSetupFromRow(row: ProfessorRow | null, user: User): SetupState {
  const profile = professorRowToProfile(row, user);
  const contact = Boolean(profile?.contactEmail && profile.bioUrl);
  const researchAreas = profile?.researchAreas ?? [];
  const researchInterests = profile?.researchInterests ?? [];
  const basic = Boolean(profile?.department && profile.title && researchAreas.length > 0);

  return {
    completed: Boolean(basic && contact && researchInterests.length > 0),
    profile,
    steps: {
      basic,
      contact,
    },
  };
}

async function loadSetupForUser(user: User): Promise<SetupState> {
  if (!supabase) return emptySetup();

  if (user.role === 'student') {
    const { data, error } = await supabase.from('students').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return studentSetupFromRow(data, user);
  }

  if (user.role === 'professor') {
    const { data, error } = await supabase.from('professors').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return professorSetupFromRow(data, user);
  }

  return {
    completed: true,
    profile: null,
    steps: {
      basic: true,
    },
  };
}

async function ensureProfileForSession(fallbackRole?: UserRole): Promise<User | null> {
  if (!supabase) return null;

  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !authUser?.email) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw error;

  const metadataRole = authUser.user_metadata?.role as UserRole | undefined;
  const metadataName =
    typeof authUser.user_metadata?.full_name === 'string'
      ? authUser.user_metadata.full_name
      : typeof authUser.user_metadata?.name === 'string'
        ? authUser.user_metadata.name
        : authUser.email;

  const role = (profile?.role ?? metadataRole ?? fallbackRole ?? 'student') as UserRole;
  const fullName = profile?.full_name ?? metadataName;

  if (!profile) {
    await upsertProfile({
      id: authUser.id,
      email: authUser.email,
      full_name: fullName,
      role: role as AppRole,
    });
  }

  return {
    id: authUser.id,
    email: authUser.email,
    name: fullName,
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  async function refreshSession(): Promise<void> {
    setLoadingSession(true);
    try {
      const nextUser = await ensureProfileForSession();
      if (!nextUser) {
        setUser(null);
        setSetupState(null);
        return;
      }

      const setup = await loadSetupForUser(nextUser);
      setUser(nextUser);
      setSetupState(setup);
    } finally {
      setLoadingSession(false);
    }
  }

  useEffect(() => {
    void refreshSession();

    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string, role?: UserRole): Promise<{ user: User; setup: SetupState }> {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const nextUser = await ensureProfileForSession(role);
    if (!nextUser) throw new Error('Unable to load Supabase user profile.');

    const setup = await loadSetupForUser(nextUser);
    setUser(nextUser);
    setSetupState(setup);
    return { user: nextUser, setup };
  }

  async function signup(payload: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }): Promise<{ user: User | null; setup: SetupState | null; needsEmailConfirmation: boolean }> {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.name,
          role: payload.role,
        },
      },
    });
    if (error) throw error;

    if (!data.session) {
      return {
        user: null,
        setup: null,
        needsEmailConfirmation: true,
      };
    }

    const nextUser = await ensureProfileForSession(payload.role);
    if (!nextUser) throw new Error('Unable to load Supabase user profile.');

    const setup = await loadSetupForUser(nextUser);
    setUser(nextUser);
    setSetupState(setup);
    return { user: nextUser, setup, needsEmailConfirmation: false };
  }

  async function logout(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSetupState(null);
  }

  async function updateStudentProfile(profile: StudentProfileInput): Promise<void> {
    if (!user || user.role !== 'student') throw new Error('Student role required.');
    const currentProfile = setupState?.profile as StudentSetupProfile | null;

    if (profile.name?.trim()) {
      await upsertProfile({
        id: user.id,
        email: profile.email?.trim() || user.email,
        role: 'student',
        full_name: profile.name.trim(),
      });
    }

    const metadata = {
      skills: profile.skills ?? currentProfile?.skills ?? [],
      interests: profile.interests ?? currentProfile?.interests ?? [],
      photoBase64: profile.photoBase64 ?? currentProfile?.photoBase64,
    };

    const updated = await upsertStudent({
      id: user.id,
      major: profile.major ?? currentProfile?.major,
      degree: profile.degree ?? currentProfile?.degree,
      academic_year: profile.graduationYear ?? currentProfile?.graduationYear,
      linkedin_url: profile.linkedInUrl ?? profile.linkedin ?? currentProfile?.linkedInUrl ?? currentProfile?.linkedin,
      github_url: profile.githubUrl ?? profile.github ?? currentProfile?.githubUrl ?? currentProfile?.github,
      research_interests: profile.interests ?? currentProfile?.interests,
      resume: (profile.resume !== undefined ? profile.resume : currentProfile?.resume ?? null) as Json,
      transcript: (profile.transcript !== undefined ? profile.transcript : currentProfile?.transcript ?? null) as Json,
      transcript_text: profile.transcriptText === null
        ? null
        : profile.transcriptText ?? currentProfile?.transcriptText,
      coursework: (profile.coursework ?? currentProfile?.coursework ?? []) as Json,
      metadata: metadata as Json,
    });
    const nextUser = profile.name?.trim() ? { ...user, name: profile.name.trim() } : user;
    setUser(nextUser);
    setSetupState(studentSetupFromRow(updated, nextUser));
  }

  async function updateProfessorProfile(profile: ProfessorProfileInput): Promise<void> {
    if (!user || user.role !== 'professor') throw new Error('Professor role required.');

    const nextName = profile.name?.trim() || user.name;
    await upsertProfile({
      id: user.id,
      email: user.email,
      role: 'professor',
      full_name: nextName,
    });

    const currentProfile = setupState?.profile as ProfessorSetupProfile | null;
    const metadata = {
      photoBase64: profile.photoBase64 ?? currentProfile?.photoBase64,
      researchSummary: profile.researchSummary ?? currentProfile?.researchSummary,
    };

    const updated = await upsertProfessor({
      id: user.id,
      department: profile.department ?? currentProfile?.department,
      title: profile.title ?? currentProfile?.title,
      contact_email: profile.contactEmail ?? currentProfile?.contactEmail,
      office_hours: profile.officeHours ?? currentProfile?.officeHours,
      bio_url: profile.bioUrl ?? currentProfile?.bioUrl,
      research_areas: profile.researchAreas ?? currentProfile?.researchAreas ?? [],
      professor_website: profile.professorWebsite ?? currentProfile?.professorWebsite,
      publications_link: profile.publicationsLink ?? currentProfile?.publicationsLink,
      research_interests: profile.researchInterests ?? currentProfile?.researchInterests ?? [],
      metadata: metadata as Json,
    });
    const nextUser = { ...user, name: nextName };
    setUser(nextUser);
    setSetupState(professorSetupFromRow(updated, nextUser));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setupState,
        loadingSession,
        login,
        signup,
        logout,
        refreshSession,
        updateStudentProfile,
        updateProfessorProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import {
  getSession,
  logoutSession,
  stubSsoLogin,
  updateProfessorSetup,
  updateStudentSetup,
  type SetupState,
  type User,
  type UserRole,
} from '../lib/api';

export type { UserRole, User };

interface AuthContextType {
  user: User | null;
  setupState: SetupState | null;
  loadingSession: boolean;
  login: (
    email: string,
    name: string,
    role: UserRole
  ) => Promise<{ user: User; setup: SetupState }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateStudentProfile: (profile: {
    name?: string;
    email?: string;
    photoBase64?: string;
    major?: string;
    graduationYear?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    skills?: string[];
    interests?: string[];
    resume?: { name: string; uploadDate: string } | null;
  }) => Promise<void>;
  updateProfessorProfile: (profile: {
    name?: string;
    department?: string;
    title?: string;
    contactEmail?: string;
    officeHours?: string;
    bioUrl?: string;
    researchAreas?: string;
    professorWebsite?: string;
    publicationsLink?: string;
    researchInterests?: string;
    photoBase64?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  async function refreshSession(): Promise<void> {
    try {
      const data = await getSession();
      setUser(data.user);
      setSetupState(data.setup);
    } catch {
      setUser(null);
      setSetupState(null);
    } finally {
      setLoadingSession(false);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function login(
    email: string,
    name: string,
    role: UserRole
  ): Promise<{ user: User; setup: SetupState }> {
    const data = await stubSsoLogin({ email, name, role });
    setUser(data.user);
    setSetupState(data.setup);
    return { user: data.user, setup: data.setup };
  }

  async function logout(): Promise<void> {
    try {
      await logoutSession();
    } finally {
      setUser(null);
      setSetupState(null);
    }
  }

  async function updateStudentProfile(profile: {
    name?: string;
    email?: string;
    photoBase64?: string;
    major?: string;
    graduationYear?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    skills?: string[];
    interests?: string[];
    resume?: { name: string; uploadDate: string } | null;
  }): Promise<void> {
    const data = await updateStudentSetup(profile);
    setSetupState(data.setup);
  }

  async function updateProfessorProfile(profile: {
    name?: string;
    department?: string;
    title?: string;
    contactEmail?: string;
    officeHours?: string;
    bioUrl?: string;
    researchAreas?: string;
    professorWebsite?: string;
    publicationsLink?: string;
    researchInterests?: string;
    photoBase64?: string;
  }): Promise<void> {
    const data = await updateProfessorSetup(profile);
    setSetupState(data.setup);
    if (profile.name?.trim()) {
      setUser((current) => (current ? { ...current, name: profile.name!.trim() } : current));
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setupState,
        loadingSession,
        login,
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

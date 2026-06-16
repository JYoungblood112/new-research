export type UserRole = 'student' | 'professor' | 'recruiter' | 'dean';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type StudentSetupProfile = {
  id?: string;
  userId?: string;
  name?: string;
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
  setupCompleted?: boolean;
};

export type ProfessorSetupProfile = {
  id?: string;
  userId?: string;
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
  setupCompleted?: boolean;
};

export type SetupState = {
  completed: boolean;
  profile: StudentSetupProfile | ProfessorSetupProfile | null;
  steps: {
    basic: boolean;
    resume?: boolean;
    transcript?: boolean;
    skills?: boolean;
    interests?: boolean;
    contact?: boolean;
  };
};

export type ResumeAutofillResult = {
  fullName?: string;
  email?: string;
  major?: string;
  academicYear?: string;
  skills: string[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Your session expired. Please sign in again.');
    }
    throw new Error(errorPayload.error || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function stubSsoLogin(payload: {
  email: string;
  name: string;
  role: UserRole;
}): Promise<{ user: User; setup: SetupState }> {
  return request('/api/auth/stub-sso', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getSession(): Promise<{ user: User; setup: SetupState }> {
  return request('/api/auth/session');
}

export async function logoutSession(): Promise<{ ok: boolean }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export async function updateStudentSetup(payload: {
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
  setupCompleted?: boolean;
}): Promise<{ setup: SetupState }> {
  return request('/api/setup/student', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateProfessorSetup(payload: {
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
  setupCompleted?: boolean;
}): Promise<{ setup: SetupState }> {
  return request('/api/setup/professor', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function parseResumeWithAi(payload: {
  resumeBase64: string;
  fileName?: string;
  mode: 'autofill' | 'skills';
}): Promise<{ result: ResumeAutofillResult | string[]; source?: 'ollama' | 'fallback'; warning?: string }> {
  return request('/api/ai/parse-resume', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getStudentInterestCounts(): Promise<{ counts: Record<string, number>; totalStudents: number }> {
  return request('/api/insights/student-interest-counts');
}

export type RecruiterCandidateMatch = {
  candidateId: string;
  candidateName: string;
  matchScore: number;
  explanation: string;
  reasons: string[];
};

export async function rankRecruiterCandidates(payload: {
  role: {
    jobTitle: string;
    requiredSkills: string;
    preferredSkills: string;
    researchAreas: string;
    experienceLevel: string;
  };
  candidates: unknown[];
}): Promise<{ matches: RecruiterCandidateMatch[]; source: 'ollama' | 'fallback'; warning?: string }> {
  return request('/api/recruiter/ai/match-candidates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateRecruiterCandidateSummary(payload: {
  candidate: unknown;
}): Promise<{ summary: string; source: 'ollama' | 'fallback'; warning?: string }> {
  return request('/api/recruiter/ai/candidate-summary', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateRecruiterOutreach(payload: {
  candidate: unknown;
  position: string;
}): Promise<{ message: string; source: 'ollama' | 'fallback'; warning?: string }> {
  return request('/api/recruiter/ai/outreach', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type DeanInsight = {
  title: string;
  category: string;
  summary: string;
  action: string;
};

export async function generateDeanResearchReport(payload: {
  metrics: unknown;
}): Promise<{ report: string; source: 'ollama' | 'fallback'; warning?: string }> {
  return request('/api/dean/ai/research-report', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateDeanInsights(payload: {
  metrics: unknown;
}): Promise<{ insights: DeanInsight[]; source: 'ollama' | 'fallback'; warning?: string }> {
  return request('/api/dean/ai/insights', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

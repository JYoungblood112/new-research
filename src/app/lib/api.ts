export type UserRole = 'student' | 'professor';

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
  major?: string;
  graduationYear?: string;
  skills?: string[];
  interests?: string[];
  resume?: { name: string; uploadDate: string } | null;
};

export type ProfessorSetupProfile = {
  id?: string;
  userId?: string;
  department?: string;
  title?: string;
  contactEmail?: string;
  officeHours?: string;
  bioUrl?: string;
  photoBase64?: string;
};

export type SetupState = {
  completed: boolean;
  profile: StudentSetupProfile | ProfessorSetupProfile | null;
  steps: {
    basic: boolean;
    resume?: boolean;
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
  major?: string;
  graduationYear?: string;
  skills?: string[];
  interests?: string[];
  resume?: { name: string; uploadDate: string } | null;
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
  photoBase64?: string;
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
}): Promise<{ result: ResumeAutofillResult | string[] }> {
  return request('/api/ai/parse-resume', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getStudentInterestCounts(): Promise<{ counts: Record<string, number>; totalStudents: number }> {
  return request('/api/insights/student-interest-counts');
}

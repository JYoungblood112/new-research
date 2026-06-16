export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'student' | 'professor' | 'recruiter' | 'dean' | 'admin';
export type ProjectStatus = 'pending_approval' | 'published' | 'closed' | 'archived';
export type ApplicationStatus = 'Pending' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Accepted';
export type ProjectCompensation = 'stipend' | 'volunteer' | 'course credit' | 'tbd';
export type SkillImportance = 'required' | 'preferred' | 'nice_to_have';

export type ProfileRow = {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentRow = {
  id: string;
  major: string | null;
  degree: string | null;
  academic_year: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  research_interests: string[];
  resume_text: string | null;
  transcript_text: string | null;
  coursework: Json;
  resume: Json;
  transcript: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ProfessorRow = {
  id: string;
  department: string | null;
  title: string | null;
  contact_email: string | null;
  office_hours: string | null;
  bio_url: string | null;
  research_areas: string[];
  research_interests: string[];
  professor_website: string | null;
  publications_link: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  professor_id: string | null;
  category: string | null;
  research_areas: string[];
  skills_needed: string[];
  title: string;
  overview: string | null;
  student_role_description: string | null;
  student_gain: string | null;
  required_qualifications: string | null;
  preferred_qualifications: string | null;
  time_commitment_expected: string | null;
  start_date: string | null;
  duration: string | null;
  application_deadline: string | null;
  compensation: ProjectCompensation;
  questions: Json;
  quick_note_enabled: boolean;
  status: ProjectStatus;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  project_id: string;
  student_id: string;
  student_snapshot: Json;
  answers: Json;
  quick_note: string | null;
  resume: Json;
  status: ApplicationStatus;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export type SkillRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  created_at: string;
};

export type StudentSkillRow = {
  student_id: string;
  skill_id: string;
  source: string;
  created_at: string;
};

export type ProjectSkillRow = {
  project_id: string;
  skill_id: string;
  importance: SkillImportance;
  created_at: string;
};

export type RecommendationRow = {
  id: string;
  student_id: string;
  project_id: string;
  confidence: number;
  recommendation: string | null;
  reason: string | null;
  score_breakdown: Json;
  qualifications: Json;
  fit_reasoning: Json;
  gaps: Json;
  requirement_assessments: Json;
  evidence_sources: Json;
  source: string;
  created_at: string;
  updated_at: string;
};

type Tables = {
  profiles: {
    Row: ProfileRow;
    Insert: Omit<ProfileRow, 'created_at' | 'updated_at'> & Partial<Pick<ProfileRow, 'avatar_url' | 'created_at' | 'updated_at'>>;
    Update: Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>;
  };
  students: {
    Row: StudentRow;
    Insert: Pick<StudentRow, 'id'> & Partial<Omit<StudentRow, 'id' | 'created_at' | 'updated_at'>>;
    Update: Partial<Omit<StudentRow, 'id' | 'created_at' | 'updated_at'>>;
  };
  professors: {
    Row: ProfessorRow;
    Insert: Pick<ProfessorRow, 'id'> & Partial<Omit<ProfessorRow, 'id' | 'created_at' | 'updated_at'>>;
    Update: Partial<Omit<ProfessorRow, 'id' | 'created_at' | 'updated_at'>>;
  };
  projects: {
    Row: ProjectRow;
    Insert: Pick<ProjectRow, 'professor_id' | 'title'> & Partial<Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'>>;
    Update: Partial<Omit<ProjectRow, 'id' | 'professor_id' | 'created_at' | 'updated_at'>>;
  };
  applications: {
    Row: ApplicationRow;
    Insert: Pick<ApplicationRow, 'project_id' | 'student_id'> & Partial<Omit<ApplicationRow, 'id' | 'created_at' | 'updated_at' | 'submitted_at'>>;
    Update: Partial<Omit<ApplicationRow, 'id' | 'project_id' | 'student_id' | 'created_at' | 'updated_at'>>;
  };
  skills: {
    Row: SkillRow;
    Insert: Pick<SkillRow, 'name' | 'slug'> & Partial<Omit<SkillRow, 'id' | 'created_at'>>;
    Update: Partial<Omit<SkillRow, 'id' | 'created_at'>>;
  };
  student_skills: {
    Row: StudentSkillRow;
    Insert: Pick<StudentSkillRow, 'student_id' | 'skill_id'> & Partial<Omit<StudentSkillRow, 'student_id' | 'skill_id' | 'created_at'>>;
    Update: Partial<Pick<StudentSkillRow, 'source'>>;
  };
  project_skills: {
    Row: ProjectSkillRow;
    Insert: Pick<ProjectSkillRow, 'project_id' | 'skill_id'> & Partial<Pick<ProjectSkillRow, 'importance' | 'created_at'>>;
    Update: Partial<Pick<ProjectSkillRow, 'importance'>>;
  };
  recommendations: {
    Row: RecommendationRow;
    Insert: Pick<RecommendationRow, 'student_id' | 'project_id' | 'confidence'> & Partial<Omit<RecommendationRow, 'id' | 'created_at' | 'updated_at'>>;
    Update: Partial<Omit<RecommendationRow, 'id' | 'student_id' | 'project_id' | 'created_at' | 'updated_at'>>;
  };
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      project_status: ProjectStatus;
      application_status: ApplicationStatus;
      project_compensation: ProjectCompensation;
      skill_importance: SkillImportance;
    };
    CompositeTypes: Record<string, never>;
  };
};

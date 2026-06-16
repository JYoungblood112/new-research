import { requireSupabaseClient } from './supabase';
import type { Database, ProjectSkillRow, StudentSkillRow } from './database.types';

type Tables = Database['public']['Tables'];
type InsertRow<TableName extends keyof Tables> = Tables[TableName]['Insert'];
type UpdateRow<TableName extends keyof Tables> = Tables[TableName]['Update'];

function throwSupabaseError(error: { message?: string } | null, fallback: string): never {
  const message = error?.message || fallback;

  if (/schema cache/i.test(message) && /projects/i.test(message)) {
    throw new Error(
      'The Supabase projects table is missing Create Opportunity columns. Apply supabase/migrations/20260616002000_fix_projects_columns_and_reload_schema.sql, then try again.'
    );
  }

  throw new Error(message);
}

export async function getCurrentProfile() {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('profiles').select('*').single();
  if (error) throw error;
  return data;
}

export async function upsertProfile(profile: InsertRow<'profiles'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('profiles').upsert(profile).select('*').single();
  if (error) throw error;
  return data;
}

export async function getCurrentStudent() {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('students').select('*').single();
  if (error) throw error;
  return data;
}

export async function upsertStudent(student: InsertRow<'students'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('students').upsert(student).select('*').single();
  if (error) throw error;
  return data;
}

export async function getCurrentProfessor() {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('professors').select('*').single();
  if (error) throwSupabaseError(error, 'Unable to load professor profile.');
  return data;
}

export async function upsertProfessor(professor: InsertRow<'professors'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('professors').upsert(professor).select('*').single();
  if (error) throwSupabaseError(error, 'Unable to save professor profile.');
  return data;
}

export async function listPublicProjects() {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('*, professors(department,title,contact_email,bio_url,research_areas,research_interests,metadata)')
    .eq('status', 'published')
    .order('application_deadline', { ascending: true, nullsFirst: false });
  if (error) throwSupabaseError(error, 'Unable to load published projects.');
  return data ?? [];
}

export async function listProfessorProjects(professorId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false });
  if (error) throwSupabaseError(error, 'Unable to load professor projects.');
  return data ?? [];
}

export async function createProject(project: InsertRow<'projects'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('projects').insert(project).select('*').single();
  if (error) throwSupabaseError(error, 'Unable to create project.');
  return data;
}

export async function updateProject(projectId: string, updates: UpdateRow<'projects'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('projects').update(updates).eq('id', projectId).select('*').single();
  if (error) throwSupabaseError(error, 'Unable to update project.');
  return data;
}

export async function deleteProject(projectId: string) {
  const client = requireSupabaseClient();
  const { error } = await client.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function listMyApplications(studentId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('applications')
    .select('*, projects(title,status,application_deadline,professor_id)')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listProjectApplications(projectId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('applications')
    .select('*, students(major,degree,academic_year)')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createApplication(application: InsertRow<'applications'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('applications').insert(application).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateMyApplication(applicationId: string, updates: UpdateRow<'applications'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('applications').update(updates).eq('id', applicationId).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateProjectApplicationStatus(
  applicationId: string,
  status: Database['public']['Enums']['application_status']
) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listSkills() {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('skills').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listStudentSkills(studentId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('student_skills')
    .select('*, skills(*)')
    .eq('student_id', studentId);
  if (error) throw error;
  return data ?? [];
}

export async function setStudentSkills(studentId: string, skills: Array<Pick<StudentSkillRow, 'skill_id' | 'source'>>) {
  const client = requireSupabaseClient();
  const { error: deleteError } = await client.from('student_skills').delete().eq('student_id', studentId);
  if (deleteError) throw deleteError;

  if (skills.length === 0) return [];

  const rows: InsertRow<'student_skills'>[] = skills.map((skill) => ({
    student_id: studentId,
    skill_id: skill.skill_id,
    source: skill.source,
  }));
  const { data, error } = await client.from('student_skills').insert(rows).select('*');
  if (error) throw error;
  return data ?? [];
}

export async function listProjectSkills(projectId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('project_skills')
    .select('*, skills(*)')
    .eq('project_id', projectId);
  if (error) throw error;
  return data ?? [];
}

export async function setProjectSkills(projectId: string, skills: Array<Pick<ProjectSkillRow, 'skill_id' | 'importance'>>) {
  const client = requireSupabaseClient();
  const { error: deleteError } = await client.from('project_skills').delete().eq('project_id', projectId);
  if (deleteError) throw deleteError;

  if (skills.length === 0) return [];

  const rows: InsertRow<'project_skills'>[] = skills.map((skill) => ({
    project_id: projectId,
    skill_id: skill.skill_id,
    importance: skill.importance,
  }));
  const { data, error } = await client.from('project_skills').insert(rows).select('*');
  if (error) throw error;
  return data ?? [];
}

export async function listMyRecommendations(studentId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('recommendations')
    .select('*, projects(title,status,application_deadline)')
    .eq('student_id', studentId)
    .order('confidence', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listProjectRecommendations(projectId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('recommendations')
    .select('*')
    .eq('project_id', projectId)
    .order('confidence', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertRecommendation(recommendation: InsertRow<'recommendations'>) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('recommendations')
    .upsert(recommendation, { onConflict: 'student_id,project_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

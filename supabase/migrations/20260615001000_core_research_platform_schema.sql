create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('student', 'professor', 'recruiter', 'dean', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.project_status as enum ('pending_approval', 'published', 'closed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.application_status as enum ('Pending', 'Shortlisted', 'Interview', 'Rejected', 'Accepted');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.project_compensation as enum ('stipend', 'volunteer', 'course credit', 'tbd');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.skill_importance as enum ('required', 'preferred', 'nice_to_have');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null,
  full_name text not null,
  avatar_url text,
  setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  setup_completed boolean not null default false,
  major text,
  university text,
  degree text,
  academic_year text,
  gpa numeric(3, 2),
  graduation_year integer,
  phone text,
  location text,
  linkedin_url text,
  github_url text,
  summary text,
  resume_text text,
  transcript_text text,
  coursework jsonb not null default '[]'::jsonb,
  resume jsonb not null default '{}'::jsonb,
  transcript jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professors (
  id uuid primary key references public.profiles(id) on delete cascade,
  setup_completed boolean not null default false,
  department text,
  title text,
  contact_email text,
  office_hours text,
  bio_url text,
  research_areas text[] not null default '{}',
  research_interests text[] not null default '{}',
  professor_website text,
  publications_link text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists professor_id uuid references public.professors(id) on delete cascade;
alter table public.projects add column if not exists category text;
alter table public.projects add column if not exists research_areas text[] not null default '{}';
alter table public.projects add column if not exists skills_needed text[] not null default '{}';
alter table public.projects add column if not exists overview text;
alter table public.projects add column if not exists student_role_description text;
alter table public.projects add column if not exists student_gain text;
alter table public.projects add column if not exists required_qualifications text;
alter table public.projects add column if not exists preferred_qualifications text;
alter table public.projects add column if not exists time_commitment_expected text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists duration text;
alter table public.projects add column if not exists application_deadline date;
alter table public.projects add column if not exists compensation public.project_compensation not null default 'tbd';
alter table public.projects add column if not exists questions jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists quick_note_enabled boolean not null default false;
alter table public.projects add column if not exists approved_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'description'
  ) then
    update public.projects
    set overview = coalesce(overview, description);
  end if;
end $$;

alter table public.projects alter column status drop default;
update public.projects
set status = case
  when status = 'published' then 'published'
  when status = 'closed' then 'closed'
  when status = 'archived' then 'archived'
  else 'pending_approval'
end;
alter table public.projects
  alter column status type public.project_status
  using status::public.project_status;
alter table public.projects alter column status set default 'pending_approval';
alter table public.projects drop column if exists description;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  quick_note text,
  resume jsonb not null default '{}'::jsonb,
  status public.application_status not null default 'Pending',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, student_id)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_skills (
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  source text not null default 'profile',
  created_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table if not exists public.project_skills (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  importance public.skill_importance not null default 'required',
  created_at timestamptz not null default now(),
  primary key (project_id, skill_id, importance)
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  confidence integer not null check (confidence between 0 and 100),
  recommendation text,
  reason text,
  score_breakdown jsonb not null default '{}'::jsonb,
  qualifications jsonb not null default '[]'::jsonb,
  fit_reasoning jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  requirement_assessments jsonb not null default '[]'::jsonb,
  evidence_sources jsonb not null default '{}'::jsonb,
  source text not null default 'ollama',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, project_id)
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists students_major_idx on public.students (major);
create index if not exists professors_department_idx on public.professors (department);
create index if not exists professors_research_areas_idx on public.professors using gin (research_areas);
create index if not exists professors_research_interests_idx on public.professors using gin (research_interests);
create index if not exists projects_professor_id_idx on public.projects (professor_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_application_deadline_idx on public.projects (application_deadline);
create index if not exists projects_research_areas_idx on public.projects using gin (research_areas);
create index if not exists projects_skills_needed_idx on public.projects using gin (skills_needed);
create index if not exists applications_student_id_idx on public.applications (student_id);
create index if not exists applications_project_id_idx on public.applications (project_id);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists skills_slug_idx on public.skills (slug);
create index if not exists student_skills_skill_id_idx on public.student_skills (skill_id);
create index if not exists project_skills_skill_id_idx on public.project_skills (skill_id);
create index if not exists recommendations_student_id_idx on public.recommendations (student_id);
create index if not exists recommendations_project_id_idx on public.recommendations (project_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students for each row execute function public.set_updated_at();

drop trigger if exists professors_set_updated_at on public.professors;
create trigger professors_set_updated_at before update on public.professors for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at before update on public.applications for each row execute function public.set_updated_at();

drop trigger if exists recommendations_set_updated_at on public.recommendations;
create trigger recommendations_set_updated_at before update on public.recommendations for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.professors enable row level security;
alter table public.projects enable row level security;
alter table public.applications enable row level security;
alter table public.skills enable row level security;
alter table public.student_skills enable row level security;
alter table public.project_skills enable row level security;
alter table public.recommendations enable row level security;

drop policy if exists "Public read access for projects" on public.projects;
drop policy if exists "Profiles can be read by owner" on public.profiles;
drop policy if exists "Profiles can be inserted by owner" on public.profiles;
drop policy if exists "Profiles can be updated by owner" on public.profiles;
drop policy if exists "Students can read own row" on public.students;
drop policy if exists "Students can insert own row" on public.students;
drop policy if exists "Students can update own row" on public.students;
drop policy if exists "Professors can read own row" on public.professors;
drop policy if exists "Published project professors can be read" on public.professors;
drop policy if exists "Professors can insert own row" on public.professors;
drop policy if exists "Professors can update own row" on public.professors;
drop policy if exists "Published projects can be read" on public.projects;
drop policy if exists "Professors can read own projects" on public.projects;
drop policy if exists "Professors can create own projects" on public.projects;
drop policy if exists "Professors can update own projects" on public.projects;
drop policy if exists "Professors can delete own projects" on public.projects;
drop policy if exists "Students can read own applications" on public.applications;
drop policy if exists "Professors can read applications for own projects" on public.applications;
drop policy if exists "Students can apply to published projects" on public.applications;
drop policy if exists "Students can update own applications" on public.applications;
drop policy if exists "Students can delete own applications" on public.applications;
drop policy if exists "Skills can be read publicly" on public.skills;
drop policy if exists "Students can read own skills" on public.student_skills;
drop policy if exists "Students can insert own skills" on public.student_skills;
drop policy if exists "Students can update own skills" on public.student_skills;
drop policy if exists "Students can delete own skills" on public.student_skills;
drop policy if exists "Public can read skills for published projects" on public.project_skills;
drop policy if exists "Professors can read skills for own projects" on public.project_skills;
drop policy if exists "Professors can insert skills for own projects" on public.project_skills;
drop policy if exists "Professors can update skills for own projects" on public.project_skills;
drop policy if exists "Professors can delete skills for own projects" on public.project_skills;
drop policy if exists "Students can read own recommendations" on public.recommendations;
drop policy if exists "Professors can read recommendations for own projects" on public.recommendations;
drop policy if exists "Students can insert own recommendations" on public.recommendations;
drop policy if exists "Students can update own recommendations" on public.recommendations;
drop policy if exists "Students can delete own recommendations" on public.recommendations;

create policy "Profiles can be read by owner" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Profiles can be inserted by owner" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Profiles can be updated by owner" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Students can read own row" on public.students for select to authenticated using (auth.uid() = id);
create policy "Students can insert own row" on public.students for insert to authenticated with check (auth.uid() = id);
create policy "Students can update own row" on public.students for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Professors can read own row" on public.professors for select to authenticated using (auth.uid() = id);
create policy "Published project professors can be read" on public.professors for select to anon, authenticated using (
  exists (select 1 from public.projects where projects.professor_id = professors.id and projects.status = 'published')
);
create policy "Professors can insert own row" on public.professors for insert to authenticated with check (auth.uid() = id);
create policy "Professors can update own row" on public.professors for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Published projects can be read" on public.projects for select to anon, authenticated using (status = 'published');
create policy "Professors can read own projects" on public.projects for select to authenticated using (auth.uid() = professor_id);
create policy "Professors can create own projects" on public.projects for insert to authenticated with check (auth.uid() = professor_id);
create policy "Professors can update own projects" on public.projects for update to authenticated using (auth.uid() = professor_id) with check (auth.uid() = professor_id);
create policy "Professors can delete own projects" on public.projects for delete to authenticated using (auth.uid() = professor_id);

create policy "Students can read own applications" on public.applications for select to authenticated using (auth.uid() = student_id);
create policy "Professors can read applications for own projects" on public.applications for select to authenticated using (
  exists (select 1 from public.projects where projects.id = applications.project_id and projects.professor_id = auth.uid())
);
create policy "Students can apply to published projects" on public.applications for insert to authenticated with check (
  auth.uid() = student_id
  and exists (select 1 from public.projects where projects.id = applications.project_id and projects.status = 'published')
);
create policy "Students can update own applications" on public.applications for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy "Students can delete own applications" on public.applications for delete to authenticated using (auth.uid() = student_id);

create policy "Skills can be read publicly" on public.skills for select to anon, authenticated using (true);

create policy "Students can read own skills" on public.student_skills for select to authenticated using (auth.uid() = student_id);
create policy "Students can insert own skills" on public.student_skills for insert to authenticated with check (auth.uid() = student_id);
create policy "Students can update own skills" on public.student_skills for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy "Students can delete own skills" on public.student_skills for delete to authenticated using (auth.uid() = student_id);

create policy "Public can read skills for published projects" on public.project_skills for select to anon, authenticated using (
  exists (select 1 from public.projects where projects.id = project_skills.project_id and projects.status = 'published')
);
create policy "Professors can read skills for own projects" on public.project_skills for select to authenticated using (
  exists (select 1 from public.projects where projects.id = project_skills.project_id and projects.professor_id = auth.uid())
);
create policy "Professors can insert skills for own projects" on public.project_skills for insert to authenticated with check (
  exists (select 1 from public.projects where projects.id = project_skills.project_id and projects.professor_id = auth.uid())
);
create policy "Professors can update skills for own projects" on public.project_skills for update to authenticated using (
  exists (select 1 from public.projects where projects.id = project_skills.project_id and projects.professor_id = auth.uid())
) with check (
  exists (select 1 from public.projects where projects.id = project_skills.project_id and projects.professor_id = auth.uid())
);
create policy "Professors can delete skills for own projects" on public.project_skills for delete to authenticated using (
  exists (select 1 from public.projects where projects.id = project_skills.project_id and projects.professor_id = auth.uid())
);

create policy "Students can read own recommendations" on public.recommendations for select to authenticated using (auth.uid() = student_id);
create policy "Professors can read recommendations for own projects" on public.recommendations for select to authenticated using (
  exists (select 1 from public.projects where projects.id = recommendations.project_id and projects.professor_id = auth.uid())
);
create policy "Students can insert own recommendations" on public.recommendations for insert to authenticated with check (auth.uid() = student_id);
create policy "Students can update own recommendations" on public.recommendations for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy "Students can delete own recommendations" on public.recommendations for delete to authenticated using (auth.uid() = student_id);

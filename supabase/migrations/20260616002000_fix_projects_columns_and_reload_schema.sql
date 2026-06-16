create extension if not exists pgcrypto;

do $$
begin
  create type public.project_status as enum ('pending_approval', 'published', 'closed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.project_compensation as enum ('stipend', 'volunteer', 'course credit', 'tbd');
exception
  when duplicate_object then null;
end $$;

alter table public.projects
  add column if not exists professor_id uuid references public.professors(id) on delete cascade,
  add column if not exists category text,
  add column if not exists research_areas text[] not null default '{}',
  add column if not exists skills_needed text[] not null default '{}',
  add column if not exists overview text,
  add column if not exists student_role_description text,
  add column if not exists student_gain text,
  add column if not exists required_qualifications text,
  add column if not exists preferred_qualifications text,
  add column if not exists time_commitment_expected text,
  add column if not exists start_date date,
  add column if not exists duration text,
  add column if not exists application_deadline date,
  add column if not exists compensation public.project_compensation not null default 'tbd',
  add column if not exists questions jsonb not null default '[]'::jsonb,
  add column if not exists quick_note_enabled boolean not null default true,
  add column if not exists approved_at timestamptz;

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

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'status'
      and data_type <> 'USER-DEFINED'
  ) then
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
  end if;
end $$;

create index if not exists projects_professor_id_idx on public.projects (professor_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_application_deadline_idx on public.projects (application_deadline);
create index if not exists projects_research_areas_idx on public.projects using gin (research_areas);
create index if not exists projects_skills_needed_idx on public.projects using gin (skills_needed);

alter table public.projects enable row level security;

drop policy if exists "Public read access for projects" on public.projects;
drop policy if exists "Published projects can be read" on public.projects;
drop policy if exists "Professors can read own projects" on public.projects;
drop policy if exists "Professors can create own projects" on public.projects;
drop policy if exists "Professors can update own projects" on public.projects;
drop policy if exists "Professors can delete own projects" on public.projects;

create policy "Published projects can be read"
  on public.projects for select
  to anon, authenticated
  using (status = 'published');

create policy "Professors can read own projects"
  on public.projects for select
  to authenticated
  using (auth.uid() = professor_id);

create policy "Professors can create own projects"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = professor_id);

create policy "Professors can update own projects"
  on public.projects for update
  to authenticated
  using (auth.uid() = professor_id)
  with check (auth.uid() = professor_id);

create policy "Professors can delete own projects"
  on public.projects for delete
  to authenticated
  using (auth.uid() = professor_id);

notify pgrst, 'reload schema';

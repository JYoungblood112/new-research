create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  professor_id uuid not null references public.professors(id) on delete cascade,
  reporting_period text not null,
  hours_worked numeric not null default 0,
  tasks_completed text not null,
  results_achieved text,
  challenges text,
  next_steps text,
  skills_used text[] not null default '{}',
  evidence_links jsonb not null default '[]'::jsonb,
  status text not null default 'pending_approval',
  professor_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint progress_reports_status_check check (status in ('pending_approval', 'approved', 'rejected')),
  constraint progress_reports_hours_nonnegative_check check (hours_worked >= 0),
  constraint progress_reports_evidence_links_array_check check (jsonb_typeof(evidence_links) = 'array')
);

create index if not exists progress_reports_project_id_idx on public.progress_reports (project_id);
create index if not exists progress_reports_student_id_idx on public.progress_reports (student_id);
create index if not exists progress_reports_professor_id_idx on public.progress_reports (professor_id);
create index if not exists progress_reports_status_idx on public.progress_reports (status);
create index if not exists progress_reports_created_at_idx on public.progress_reports (created_at desc);

drop trigger if exists progress_reports_set_updated_at on public.progress_reports;
create trigger progress_reports_set_updated_at
  before update on public.progress_reports
  for each row execute function public.set_updated_at();

create or replace function public.enforce_progress_report_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.app_role;
begin
  select role
    into current_role
  from public.profiles
  where id = auth.uid();

  if current_role = 'student' then
    if old.student_id <> auth.uid() then
      raise exception 'Students can only update their own progress reports.';
    end if;

    if old.status <> 'pending_approval' then
      raise exception 'Students can only edit progress reports while pending approval.';
    end if;

    if new.status <> old.status
      or new.professor_comment is distinct from old.professor_comment
      or new.reviewed_at is distinct from old.reviewed_at
      or new.professor_id <> old.professor_id
      or new.project_id <> old.project_id
      or new.student_id <> old.student_id then
      raise exception 'Students cannot update review or ownership fields.';
    end if;

    return new;
  end if;

  if current_role = 'professor' then
    if old.professor_id <> auth.uid() then
      raise exception 'Professors can only review reports for their own projects.';
    end if;

    if new.project_id <> old.project_id
      or new.student_id <> old.student_id
      or new.professor_id <> old.professor_id
      or new.reporting_period <> old.reporting_period
      or new.hours_worked <> old.hours_worked
      or new.tasks_completed <> old.tasks_completed
      or new.results_achieved is distinct from old.results_achieved
      or new.challenges is distinct from old.challenges
      or new.next_steps is distinct from old.next_steps
      or new.skills_used <> old.skills_used
      or new.evidence_links <> old.evidence_links then
      raise exception 'Professors can only update review fields.';
    end if;

    return new;
  end if;

  if current_role in ('dean', 'admin') then
    return new;
  end if;

  raise exception 'Progress report update is not allowed for this role.';
end;
$$;

drop trigger if exists progress_reports_enforce_update_rules on public.progress_reports;
create trigger progress_reports_enforce_update_rules
  before update on public.progress_reports
  for each row execute function public.enforce_progress_report_update_rules();

alter table public.progress_reports enable row level security;

drop policy if exists "Students can create own progress reports" on public.progress_reports;
drop policy if exists "Students can read own progress reports" on public.progress_reports;
drop policy if exists "Students can update pending own progress reports" on public.progress_reports;
drop policy if exists "Professors can read project progress reports" on public.progress_reports;
drop policy if exists "Professors can review project progress reports" on public.progress_reports;
drop policy if exists "Dean and admin can read progress reports" on public.progress_reports;

create policy "Students can create own progress reports"
  on public.progress_reports for insert
  to authenticated
  with check (
    auth.uid() = student_id
    and exists (
      select 1
      from public.projects
      where projects.id = progress_reports.project_id
        and projects.professor_id = progress_reports.professor_id
    )
  );

create policy "Students can read own progress reports"
  on public.progress_reports for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Students can update pending own progress reports"
  on public.progress_reports for update
  to authenticated
  using (auth.uid() = student_id and status = 'pending_approval')
  with check (auth.uid() = student_id and status = 'pending_approval');

create policy "Professors can read project progress reports"
  on public.progress_reports for select
  to authenticated
  using (
    auth.uid() = professor_id
    and exists (
      select 1
      from public.projects
      where projects.id = progress_reports.project_id
        and projects.professor_id = auth.uid()
    )
  );

create policy "Professors can review project progress reports"
  on public.progress_reports for update
  to authenticated
  using (
    auth.uid() = professor_id
    and exists (
      select 1
      from public.projects
      where projects.id = progress_reports.project_id
        and projects.professor_id = auth.uid()
    )
  )
  with check (
    auth.uid() = professor_id
    and status in ('pending_approval', 'approved', 'rejected')
  );

create policy "Dean and admin can read progress reports"
  on public.progress_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('dean', 'admin')
    )
  );

notify pgrst, 'reload schema';

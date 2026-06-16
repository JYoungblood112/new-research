alter table public.applications
  add column if not exists student_snapshot jsonb not null default '{}'::jsonb;

drop policy if exists "Professors can update application status for own projects" on public.applications;

create policy "Professors can update application status for own projects"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1
      from public.projects
      where projects.id = applications.project_id
        and projects.professor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects
      where projects.id = applications.project_id
        and projects.professor_id = auth.uid()
    )
  );

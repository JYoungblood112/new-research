insert into storage.buckets (id, name, public)
values ('research-evidence', 'research-evidence', false)
on conflict (id) do nothing;

create table if not exists public.progress_report_evidence (
  id uuid primary key default gen_random_uuid(),
  progress_report_id uuid not null references public.progress_reports(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  external_url text,
  file_url text,
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint progress_report_evidence_type_check check (
    type in (
      'github_repo',
      'commit',
      'pull_request',
      'website',
      'paper',
      'dataset',
      'notebook',
      'presentation',
      'poster',
      'demo_video',
      'research_report',
      'other'
    )
  ),
  constraint progress_report_evidence_source_check check (
    nullif(trim(coalesce(external_url, '')), '') is not null
    or nullif(trim(coalesce(file_url, '')), '') is not null
    or nullif(trim(coalesce(file_path, '')), '') is not null
  )
);

create index if not exists progress_report_evidence_report_id_idx
  on public.progress_report_evidence (progress_report_id);

create index if not exists progress_report_evidence_type_idx
  on public.progress_report_evidence (type);

alter table public.progress_report_evidence enable row level security;

drop policy if exists "Students can create own progress report evidence" on public.progress_report_evidence;
drop policy if exists "Students can read own progress report evidence" on public.progress_report_evidence;
drop policy if exists "Students can update pending own progress report evidence" on public.progress_report_evidence;
drop policy if exists "Students can delete pending own progress report evidence" on public.progress_report_evidence;
drop policy if exists "Professors can read project progress report evidence" on public.progress_report_evidence;
drop policy if exists "Dean and admin can read progress report evidence" on public.progress_report_evidence;

create policy "Students can create own progress report evidence"
  on public.progress_report_evidence for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.progress_reports
      where progress_reports.id = progress_report_evidence.progress_report_id
        and progress_reports.student_id = auth.uid()
        and progress_reports.status = 'pending_approval'
    )
  );

create policy "Students can read own progress report evidence"
  on public.progress_report_evidence for select
  to authenticated
  using (
    exists (
      select 1
      from public.progress_reports
      where progress_reports.id = progress_report_evidence.progress_report_id
        and progress_reports.student_id = auth.uid()
    )
  );

create policy "Students can update pending own progress report evidence"
  on public.progress_report_evidence for update
  to authenticated
  using (
    exists (
      select 1
      from public.progress_reports
      where progress_reports.id = progress_report_evidence.progress_report_id
        and progress_reports.student_id = auth.uid()
        and progress_reports.status = 'pending_approval'
    )
  )
  with check (
    exists (
      select 1
      from public.progress_reports
      where progress_reports.id = progress_report_evidence.progress_report_id
        and progress_reports.student_id = auth.uid()
        and progress_reports.status = 'pending_approval'
    )
  );

create policy "Students can delete pending own progress report evidence"
  on public.progress_report_evidence for delete
  to authenticated
  using (
    exists (
      select 1
      from public.progress_reports
      where progress_reports.id = progress_report_evidence.progress_report_id
        and progress_reports.student_id = auth.uid()
        and progress_reports.status = 'pending_approval'
    )
  );

create policy "Professors can read project progress report evidence"
  on public.progress_report_evidence for select
  to authenticated
  using (
    exists (
      select 1
      from public.progress_reports
      join public.projects on projects.id = progress_reports.project_id
      where progress_reports.id = progress_report_evidence.progress_report_id
        and progress_reports.professor_id = auth.uid()
        and projects.professor_id = auth.uid()
    )
  );

create policy "Dean and admin can read progress report evidence"
  on public.progress_report_evidence for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('dean', 'admin')
    )
  );

drop policy if exists "Students can upload own research evidence files" on storage.objects;
drop policy if exists "Students can read own research evidence files" on storage.objects;
drop policy if exists "Students can delete pending own research evidence files" on storage.objects;
drop policy if exists "Professors can read project research evidence files" on storage.objects;

create policy "Students can upload own research evidence files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'research-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.progress_reports
      where progress_reports.id::text = (storage.foldername(name))[2]
        and progress_reports.student_id = auth.uid()
        and progress_reports.status = 'pending_approval'
    )
  );

create policy "Students can read own research evidence files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'research-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Students can delete pending own research evidence files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'research-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.progress_reports
      where progress_reports.id::text = (storage.foldername(name))[2]
        and progress_reports.student_id = auth.uid()
        and progress_reports.status = 'pending_approval'
    )
  );

create policy "Professors can read project research evidence files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'research-evidence'
    and exists (
      select 1
      from public.progress_reports
      join public.projects on projects.id = progress_reports.project_id
      where progress_reports.id::text = (storage.foldername(name))[2]
        and progress_reports.professor_id = auth.uid()
        and projects.professor_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

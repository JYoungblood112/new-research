create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  subject text not null,
  body text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_recipient_id_idx on public.messages (recipient_id);
create index if not exists messages_project_id_idx on public.messages (project_id);
create index if not exists messages_application_id_idx on public.messages (application_id);
create index if not exists messages_delivery_status_idx on public.messages (delivery_status);

alter table public.messages enable row level security;

drop policy if exists "Professors can insert own messages" on public.messages;
drop policy if exists "Professors can read own messages" on public.messages;
drop policy if exists "Professors can update own messages" on public.messages;
drop policy if exists "Students can read received messages" on public.messages;

create policy "Professors can insert own messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.projects
      where projects.id = messages.project_id
        and projects.professor_id = auth.uid()
    )
  );

create policy "Professors can read own messages"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id);

create policy "Professors can update own messages"
  on public.messages for update
  to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

create policy "Students can read received messages"
  on public.messages for select
  to authenticated
  using (auth.uid() = recipient_id);

create or replace function public.resolve_professor_message_recipient(
  p_student_id uuid,
  p_application_id uuid default null,
  p_project_id uuid default null
)
returns table (
  application_id uuid,
  project_id uuid,
  project_title text,
  student_id uuid,
  student_name text,
  student_email text
)
language sql
security definer
set search_path = public
as $$
  select
    applications.id as application_id,
    applications.project_id,
    projects.title as project_title,
    applications.student_id,
    coalesce(nullif(profiles.full_name, ''), applications.student_snapshot->>'name', 'Student Applicant') as student_name,
    profiles.email as student_email
  from public.applications
  join public.projects on projects.id = applications.project_id
  join public.profiles on profiles.id = applications.student_id
  where applications.student_id = p_student_id
    and projects.professor_id = auth.uid()
    and (p_application_id is null or applications.id = p_application_id)
    and (p_project_id is null or applications.project_id = p_project_id)
  limit 1
$$;

revoke all on function public.resolve_professor_message_recipient(uuid, uuid, uuid) from public;
grant execute on function public.resolve_professor_message_recipient(uuid, uuid, uuid) to authenticated;

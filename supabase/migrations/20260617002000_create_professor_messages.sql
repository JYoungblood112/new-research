create table if not exists public.professor_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  subject text not null,
  body text not null,
  delivery_status text not null default 'sent' check (delivery_status in ('sent', 'failed')),
  provider text not null,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists professor_messages_sender_id_idx on public.professor_messages (sender_id);
create index if not exists professor_messages_recipient_id_idx on public.professor_messages (recipient_id);
create index if not exists professor_messages_project_id_idx on public.professor_messages (project_id);
create index if not exists professor_messages_application_id_idx on public.professor_messages (application_id);

alter table public.professor_messages enable row level security;

drop policy if exists "Professors can insert own sent messages" on public.professor_messages;
drop policy if exists "Professors can read own sent messages" on public.professor_messages;
drop policy if exists "Students can read received messages" on public.professor_messages;

create policy "Professors can insert own sent messages"
  on public.professor_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.projects
      where projects.id = professor_messages.project_id
        and projects.professor_id = auth.uid()
    )
  );

create policy "Professors can read own sent messages"
  on public.professor_messages for select
  to authenticated
  using (auth.uid() = sender_id);

create policy "Students can read received messages"
  on public.professor_messages for select
  to authenticated
  using (auth.uid() = recipient_id);

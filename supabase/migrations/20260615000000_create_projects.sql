create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "Public read access for projects" on public.projects;

create policy "Public read access for projects"
  on public.projects
  for select
  to anon, authenticated
  using (true);

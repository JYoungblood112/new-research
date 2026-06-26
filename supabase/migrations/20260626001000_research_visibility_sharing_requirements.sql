do $$
begin
  create type public.requirement_type as enum ('must_have', 'preferred');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.requirement_importance as enum ('Low', 'Medium', 'High', 'Critical');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  requirement_type public.requirement_type not null default 'preferred',
  weight numeric(8, 2) not null check (weight > 0),
  importance public.requirement_importance not null default 'Medium',
  minimum_threshold text,
  evidence_sources jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_shares (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.app_role not null,
  recipient_role public.app_role not null,
  message text,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  application_created_at timestamptz
);

create table if not exists public.opportunity_view_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.projects(id) on delete cascade,
  professor_id uuid references public.professors(id) on delete set null,
  viewer_user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id text,
  viewer_role public.app_role,
  event_type text not null check (event_type in ('card_impression','detail_view','search_appearance','search_click','profile_view','share','save','recruiter_view','application_from_view')),
  referrer text,
  source text,
  department text,
  research_area text,
  dedupe_key text not null,
  occurred_at timestamptz not null default now()
);

create table if not exists public.opportunity_presence (
  opportunity_id uuid not null references public.projects(id) on delete cascade,
  viewer_key text not null,
  viewer_role public.app_role,
  last_active_at timestamptz not null default now(),
  primary key (opportunity_id, viewer_key)
);

create index if not exists opportunity_requirements_project_idx on public.opportunity_requirements (opportunity_id, display_order);
create index if not exists opportunity_shares_sender_idx on public.opportunity_shares (sender_id, created_at desc);
create index if not exists opportunity_shares_recipient_idx on public.opportunity_shares (recipient_id, created_at desc);
create index if not exists opportunity_view_events_project_time_idx on public.opportunity_view_events (opportunity_id, occurred_at desc);
create unique index if not exists opportunity_view_events_dedupe_idx on public.opportunity_view_events (dedupe_key);
create index if not exists opportunity_presence_last_active_idx on public.opportunity_presence (last_active_at desc);
create index if not exists professors_search_name_idx on public.profiles using gin (to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(email, '')));
create index if not exists projects_search_text_idx on public.projects using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(overview, '') || ' ' || coalesce(category, '')));

drop trigger if exists opportunity_requirements_set_updated_at on public.opportunity_requirements;
create trigger opportunity_requirements_set_updated_at before update on public.opportunity_requirements for each row execute function public.set_updated_at();

alter table public.opportunity_requirements enable row level security;
alter table public.opportunity_shares enable row level security;
alter table public.opportunity_view_events enable row level security;
alter table public.opportunity_presence enable row level security;

drop policy if exists "Public reads public requirement fields for published projects" on public.opportunity_requirements;
drop policy if exists "Professors manage requirements for own projects" on public.opportunity_requirements;
drop policy if exists "Professors read requirements for own projects" on public.opportunity_requirements;
drop policy if exists "Users create shares as themselves" on public.opportunity_shares;
drop policy if exists "Users read own sent or received shares" on public.opportunity_shares;
drop policy if exists "Users update own received share engagement" on public.opportunity_shares;
drop policy if exists "Authenticated users insert view events for visible projects" on public.opportunity_view_events;
drop policy if exists "Professors read view events for own projects" on public.opportunity_view_events;
drop policy if exists "Users upsert own presence for visible projects" on public.opportunity_presence;
drop policy if exists "Users read aggregate-safe presence rows" on public.opportunity_presence;

create policy "Public reads public requirement fields for published projects" on public.opportunity_requirements
for select to anon, authenticated using (
  exists (select 1 from public.projects where projects.id = opportunity_requirements.opportunity_id and projects.status = 'published')
);

create policy "Professors read requirements for own projects" on public.opportunity_requirements
for select to authenticated using (
  exists (select 1 from public.projects where projects.id = opportunity_requirements.opportunity_id and projects.professor_id = auth.uid())
);

create policy "Professors manage requirements for own projects" on public.opportunity_requirements
for all to authenticated using (
  exists (select 1 from public.projects where projects.id = opportunity_requirements.opportunity_id and projects.professor_id = auth.uid())
) with check (
  exists (select 1 from public.projects where projects.id = opportunity_requirements.opportunity_id and projects.professor_id = auth.uid())
);

create policy "Users create shares as themselves" on public.opportunity_shares
for insert to authenticated with check (
  auth.uid() = sender_id
  and exists (select 1 from public.projects where projects.id = opportunity_shares.opportunity_id and projects.status = 'published')
);

create policy "Users read own sent or received shares" on public.opportunity_shares
for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users update own received share engagement" on public.opportunity_shares
for update to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

create policy "Authenticated users insert view events for visible projects" on public.opportunity_view_events
for insert to authenticated with check (
  viewer_user_id = auth.uid()
  and exists (select 1 from public.projects where projects.id = opportunity_view_events.opportunity_id and projects.status = 'published')
);

create policy "Professors read view events for own projects" on public.opportunity_view_events
for select to authenticated using (
  exists (select 1 from public.projects where projects.id = opportunity_view_events.opportunity_id and projects.professor_id = auth.uid())
);

create policy "Users upsert own presence for visible projects" on public.opportunity_presence
for all to authenticated using (
  exists (select 1 from public.projects where projects.id = opportunity_presence.opportunity_id and projects.status = 'published')
) with check (
  exists (select 1 from public.projects where projects.id = opportunity_presence.opportunity_id and projects.status = 'published')
);

create policy "Users read aggregate-safe presence rows" on public.opportunity_presence
for select to authenticated using (
  exists (select 1 from public.projects where projects.id = opportunity_presence.opportunity_id and projects.status = 'published')
);

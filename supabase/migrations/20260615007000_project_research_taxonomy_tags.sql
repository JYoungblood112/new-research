alter table public.projects
  add column if not exists research_areas text[] not null default '{}',
  add column if not exists skills_needed text[] not null default '{}';

create index if not exists projects_research_areas_idx
  on public.projects using gin (research_areas);

create index if not exists projects_skills_needed_idx
  on public.projects using gin (skills_needed);

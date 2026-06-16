alter table public.students
  add column if not exists research_interests text[] not null default '{}';

create index if not exists students_research_interests_idx
  on public.students using gin (research_interests);

update public.students
set research_interests = (
  select coalesce(array_agg(value), '{}')
  from jsonb_array_elements_text(metadata -> 'interests') as value
)
where metadata ? 'interests'
  and research_interests = '{}';

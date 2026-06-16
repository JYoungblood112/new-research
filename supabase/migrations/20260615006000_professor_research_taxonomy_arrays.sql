do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professors'
      and column_name = 'research_interests'
      and data_type <> 'ARRAY'
  ) then
    alter table public.professors
      alter column research_interests drop default,
      alter column research_interests type text[]
      using (
        case
          when research_interests is null or btrim(research_interests) = '' then '{}'::text[]
          else regexp_split_to_array(research_interests, '\s*(?:,|;|\||\n|\r)+\s*')
        end
      ),
      alter column research_interests set default '{}',
      alter column research_interests set not null;
  end if;
end $$;

alter table public.professors
  alter column research_areas set default '{}',
  alter column research_areas set not null;

alter table public.professors
  alter column research_interests set default '{}',
  alter column research_interests set not null;

create index if not exists professors_research_areas_idx
  on public.professors using gin (research_areas);

create index if not exists professors_research_interests_idx
  on public.professors using gin (research_interests);

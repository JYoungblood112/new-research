alter table public.profiles
  add column if not exists setup_completed boolean not null default false;

alter table public.students
  add column if not exists setup_completed boolean not null default false;

alter table public.professors
  add column if not exists setup_completed boolean not null default false;

update public.students
set setup_completed = true
where setup_completed = false
  and major is not null
  and nullif(trim(major), '') is not null
  and academic_year is not null
  and nullif(trim(academic_year), '') is not null
  and coalesce(jsonb_typeof(resume), '') = 'object'
  and nullif(trim(resume ->> 'name'), '') is not null
  and coalesce(array_length(research_interests, 1), 0) > 0;

update public.professors
set setup_completed = true
where setup_completed = false
  and department is not null
  and nullif(trim(department), '') is not null
  and title is not null
  and nullif(trim(title), '') is not null
  and contact_email is not null
  and nullif(trim(contact_email), '') is not null
  and coalesce(array_length(research_areas, 1), 0) > 0
  and coalesce(array_length(research_interests, 1), 0) > 0;

update public.profiles
set setup_completed = true
where setup_completed = false
  and (
    exists (
      select 1
      from public.students
      where students.id = profiles.id
        and profiles.role = 'student'
        and students.setup_completed = true
    )
    or exists (
      select 1
      from public.professors
      where professors.id = profiles.id
        and profiles.role = 'professor'
        and professors.setup_completed = true
    )
    or profiles.role in ('recruiter', 'dean', 'admin')
  );

create unique index if not exists profiles_id_unique_idx on public.profiles (id);
create unique index if not exists students_id_unique_idx on public.students (id);
create unique index if not exists professors_id_unique_idx on public.professors (id);

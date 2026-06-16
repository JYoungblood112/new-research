alter table public.students
  add column if not exists academic_year text;

update public.students
set academic_year = coalesce(academic_year, graduation_year::text)
where academic_year is null
  and graduation_year is not null;

alter table public.students
  drop column if exists university,
  drop column if exists gpa,
  drop column if exists graduation_year,
  drop column if exists phone,
  drop column if exists location,
  drop column if exists summary;

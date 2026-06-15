create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  requested_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    new.email
  );

  if requested_role not in ('student', 'professor', 'recruiter', 'dean') then
    requested_role := 'student';
  end if;

  insert into public.profiles (id, email, role, full_name)
  values (new.id, new.email, requested_role::public.app_role, requested_name)
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        full_name = excluded.full_name,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_signup on auth.users;

create trigger create_profile_after_auth_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_auth_user();

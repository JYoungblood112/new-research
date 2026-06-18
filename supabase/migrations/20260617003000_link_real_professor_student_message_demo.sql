create extension if not exists pgcrypto;

do $$
declare
  professor_email constant text := 'jonathanalexanderyoungblood@gmail.com';
  student_email constant text := 'jyoungb2@andrew.cmu.edu';
  professor_user_id uuid;
  student_user_id uuid;
  demo_project_id constant uuid := '20000000-0000-4000-8000-000000000001';
  demo_application_id constant uuid := '20000000-0000-4000-8000-000000000101';
begin
  select id into professor_user_id
  from auth.users
  where lower(email) = lower(professor_email)
  limit 1;

  if professor_user_id is null then
    professor_user_id := '20000000-0000-4000-8000-000000000901'::uuid;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      professor_user_id,
      'authenticated',
      'authenticated',
      professor_email,
      crypt('ResearchDemo2026!', gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('role', 'professor', 'full_name', 'Jonathan Youngblood'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing;
  end if;

  select id into student_user_id
  from auth.users
  where lower(email) = lower(student_email)
  limit 1;

  if student_user_id is null then
    student_user_id := '20000000-0000-4000-8000-000000000902'::uuid;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      student_user_id,
      'authenticated',
      'authenticated',
      student_email,
      crypt('ResearchDemo2026!', gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('role', 'student', 'full_name', 'Jonathan Youngblood'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing;
  end if;

  insert into public.profiles (id, email, role, full_name, setup_completed, created_at, updated_at)
  values
    (professor_user_id, professor_email, 'professor'::public.app_role, 'Jonathan Youngblood', true, now(), now()),
    (student_user_id, student_email, 'student'::public.app_role, 'Jonathan Youngblood', true, now(), now())
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    full_name = excluded.full_name,
    setup_completed = true,
    updated_at = now();

  insert into public.professors (
    id,
    setup_completed,
    department,
    title,
    contact_email,
    office_hours,
    bio_url,
    research_areas,
    research_interests,
    professor_website,
    publications_link,
    metadata
  )
  values (
    professor_user_id,
    true,
    'Computer Science Department',
    'Professor',
    professor_email,
    'By appointment',
    '',
    array['Computer Science', 'Machine Learning', 'AI Systems'],
    array['LLM fine-tuning', 'scientific text mining', 'research assistant systems'],
    '',
    '',
    jsonb_build_object('source', 'real_email_message_demo')
  )
  on conflict (id) do update set
    setup_completed = true,
    department = excluded.department,
    title = excluded.title,
    contact_email = excluded.contact_email,
    office_hours = excluded.office_hours,
    research_areas = excluded.research_areas,
    research_interests = excluded.research_interests,
    metadata = public.professors.metadata || excluded.metadata,
    updated_at = now();

  insert into public.students (
    id,
    setup_completed,
    major,
    degree,
    academic_year,
    linkedin_url,
    github_url,
    research_interests,
    resume_text,
    transcript_text,
    coursework,
    resume,
    transcript,
    metadata
  )
  values (
    student_user_id,
    true,
    'AI + Business',
    'BS',
    'Sophomore',
    '',
    'https://github.com/JYoungblood112',
    array['Machine Learning', 'Business Analytics', 'AI Systems'],
    'Jonathan Youngblood. Business and Computer Science student with analytics, AI systems, and research platform experience.',
    '',
    '[{"courseNumber":"15-112","courseName":"Fundamentals of Programming","semester":"Fall 2025"},{"courseNumber":"70-207","courseName":"Business Analytics","semester":"Spring 2026"}]'::jsonb,
    '{"name":"jonathan_youngblood_resume.pdf","uploadDate":"2026-06-17T00:00:00Z"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'skills',
      array['Python','SQL','React','Data Analysis','Machine Learning'],
      'source',
      'real_email_message_demo'
    )
  )
  on conflict (id) do update set
    setup_completed = true,
    major = excluded.major,
    degree = excluded.degree,
    academic_year = excluded.academic_year,
    github_url = excluded.github_url,
    research_interests = excluded.research_interests,
    resume_text = excluded.resume_text,
    coursework = excluded.coursework,
    resume = excluded.resume,
    metadata = public.students.metadata || excluded.metadata,
    updated_at = now();

  insert into public.projects (
    id,
    professor_id,
    category,
    research_areas,
    skills_needed,
    title,
    overview,
    student_role_description,
    student_gain,
    required_qualifications,
    preferred_qualifications,
    time_commitment_expected,
    start_date,
    duration,
    application_deadline,
    compensation,
    questions,
    quick_note_enabled,
    status,
    approved_at,
    created_at,
    updated_at
  )
  values (
    demo_project_id,
    professor_user_id,
    'Computer Science',
    array['Machine Learning', 'Scientific Text Mining'],
    array['Python', 'LLMs', 'Research Writing', 'Evaluation'],
    'Efficient LLM Fine-Tuning for Scientific Text',
    'Develop and evaluate efficient fine-tuning workflows for scientific text analysis, literature triage, and research assistant prototypes.',
    'Build evaluation notebooks, prepare dataset summaries, and compare lightweight fine-tuning strategies for scientific corpora.',
    'Hands-on experience with LLM evaluation, applied ML experimentation, and research communication.',
    'Python experience and interest in applied machine learning.',
    'Experience with PyTorch, transformers, data analysis, or research writing.',
    '8-10 hours per week',
    '2026-09-01',
    '1 semester',
    '2026-09-15',
    'course credit',
    '[{"question":"Describe your experience with Python or ML experiments.","wordLimit":150},{"question":"Why are you interested in scientific text analysis?","wordLimit":150}]'::jsonb,
    true,
    'published'::public.project_status,
    now(),
    now(),
    now()
  )
  on conflict (id) do update set
    professor_id = excluded.professor_id,
    category = excluded.category,
    research_areas = excluded.research_areas,
    skills_needed = excluded.skills_needed,
    title = excluded.title,
    overview = excluded.overview,
    student_role_description = excluded.student_role_description,
    student_gain = excluded.student_gain,
    required_qualifications = excluded.required_qualifications,
    preferred_qualifications = excluded.preferred_qualifications,
    time_commitment_expected = excluded.time_commitment_expected,
    start_date = excluded.start_date,
    duration = excluded.duration,
    application_deadline = excluded.application_deadline,
    compensation = excluded.compensation,
    questions = excluded.questions,
    quick_note_enabled = excluded.quick_note_enabled,
    status = excluded.status,
    approved_at = coalesce(public.projects.approved_at, excluded.approved_at),
    updated_at = now();

  insert into public.applications (
    id,
    project_id,
    student_id,
    answers,
    quick_note,
    resume,
    status,
    submitted_at,
    student_snapshot,
    created_at,
    updated_at
  )
  values (
    demo_application_id,
    demo_project_id,
    student_user_id,
    '{"Describe your experience with Python or ML experiments.":"Built analytics dashboards and experimented with lightweight ML workflows in Python.","Why are you interested in scientific text analysis?":"I want to help researchers find and reason over technical literature more efficiently."}'::jsonb,
    'Interested in helping with LLM evaluation and research workflow tooling.',
    '{"name":"jonathan_youngblood_resume.pdf","uploadDate":"2026-06-17T00:00:00Z"}'::jsonb,
    'Shortlisted'::public.application_status,
    now(),
    jsonb_build_object(
      'name', 'Jonathan Youngblood',
      'email', student_email,
      'major', 'AI + Business',
      'coursework', jsonb_build_array(
        jsonb_build_object('courseNumber','15-112','courseName','Fundamentals of Programming','semester','Fall 2025'),
        jsonb_build_object('courseNumber','70-207','courseName','Business Analytics','semester','Spring 2026')
      )
    ),
    now(),
    now()
  )
  on conflict (project_id, student_id) do update set
    answers = excluded.answers,
    quick_note = excluded.quick_note,
    resume = excluded.resume,
    status = excluded.status,
    student_snapshot = excluded.student_snapshot,
    updated_at = now();
end $$;

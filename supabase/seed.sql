create extension if not exists pgcrypto;

-- Presentation demo data for the CMU research platform.
-- Re-running this file is safe: all rows use stable UUIDs and upsert/delete-by-id patterns.

with demo_users(id, email, role, full_name) as (
  values
    ('00000000-0000-4000-8000-000000000101'::uuid, 'anita-rao@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Anita Rao'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'benjamin-kline@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Benjamin Kline'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'elena-watson@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Elena Watson'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'marcus-lee@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Marcus Lee'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'priya-shah@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Priya Shah'),
    ('00000000-0000-4000-8000-000000000106'::uuid, 'lina-huang@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Lina Huang'),
    ('00000000-0000-4000-8000-000000000107'::uuid, 'owen-bradford@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Owen Bradford'),
    ('00000000-0000-4000-8000-000000000108'::uuid, 'natalie-cho@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Natalie Cho'),
    ('00000000-0000-4000-8000-000000000109'::uuid, 'dean.demo@andrew.cmu.edu', 'dean'::public.app_role, 'CMU Dean Demo'),
    ('00000000-0000-4000-8000-000000000110'::uuid, 'recruiter.demo@andrew.cmu.edu', 'recruiter'::public.app_role, 'CMU Recruiter Demo'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'maya-patel@andrew.cmu.edu', 'student'::public.app_role, 'Maya Patel'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'jonathan-youngblood@andrew.cmu.edu', 'student'::public.app_role, 'Jonathan Youngblood'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'elena-garcia@andrew.cmu.edu', 'student'::public.app_role, 'Elena Garcia'),
    ('00000000-0000-4000-8000-000000000204'::uuid, 'noah-kim@andrew.cmu.edu', 'student'::public.app_role, 'Noah Kim'),
    ('00000000-0000-4000-8000-000000000205'::uuid, 'aisha-robinson@andrew.cmu.edu', 'student'::public.app_role, 'Aisha Robinson'),
    ('00000000-0000-4000-8000-000000000206'::uuid, 'samir-mehta@andrew.cmu.edu', 'student'::public.app_role, 'Samir Mehta'),
    ('00000000-0000-4000-8000-000000000207'::uuid, 'grace-liu@andrew.cmu.edu', 'student'::public.app_role, 'Grace Liu'),
    ('00000000-0000-4000-8000-000000000208'::uuid, 'diego-martinez@andrew.cmu.edu', 'student'::public.app_role, 'Diego Martinez'),
    ('00000000-0000-4000-8000-000000000209'::uuid, 'sophia-nguyen@andrew.cmu.edu', 'student'::public.app_role, 'Sophia Nguyen'),
    ('00000000-0000-4000-8000-000000000210'::uuid, 'ethan-brooks@andrew.cmu.edu', 'student'::public.app_role, 'Ethan Brooks'),
    ('00000000-0000-4000-8000-000000000211'::uuid, 'leah-cohen@andrew.cmu.edu', 'student'::public.app_role, 'Leah Cohen'),
    ('00000000-0000-4000-8000-000000000212'::uuid, 'arjun-iyer@andrew.cmu.edu', 'student'::public.app_role, 'Arjun Iyer'),
    ('00000000-0000-4000-8000-000000000213'::uuid, 'nina-okafor@andrew.cmu.edu', 'student'::public.app_role, 'Nina Okafor'),
    ('00000000-0000-4000-8000-000000000214'::uuid, 'owen-wilson@andrew.cmu.edu', 'student'::public.app_role, 'Owen Wilson'),
    ('00000000-0000-4000-8000-000000000215'::uuid, 'camila-torres@andrew.cmu.edu', 'student'::public.app_role, 'Camila Torres'),
    ('00000000-0000-4000-8000-000000000216'::uuid, 'victor-chen@andrew.cmu.edu', 'student'::public.app_role, 'Victor Chen'),
    ('00000000-0000-4000-8000-000000000217'::uuid, 'hana-kobayashi@andrew.cmu.edu', 'student'::public.app_role, 'Hana Kobayashi'),
    ('00000000-0000-4000-8000-000000000218'::uuid, 'lucas-brown@andrew.cmu.edu', 'student'::public.app_role, 'Lucas Brown'),
    ('00000000-0000-4000-8000-000000000219'::uuid, 'rachel-stein@andrew.cmu.edu', 'student'::public.app_role, 'Rachel Stein'),
    ('00000000-0000-4000-8000-000000000220'::uuid, 'kevin-park@andrew.cmu.edu', 'student'::public.app_role, 'Kevin Park'),
    ('00000000-0000-4000-8000-000000000221'::uuid, 'mina-haddad@andrew.cmu.edu', 'student'::public.app_role, 'Mina Haddad'),
    ('00000000-0000-4000-8000-000000000222'::uuid, 'tyler-evans@andrew.cmu.edu', 'student'::public.app_role, 'Tyler Evans'),
    ('00000000-0000-4000-8000-000000000223'::uuid, 'isabel-rivera@andrew.cmu.edu', 'student'::public.app_role, 'Isabel Rivera'),
    ('00000000-0000-4000-8000-000000000224'::uuid, 'david-ross@andrew.cmu.edu', 'student'::public.app_role, 'David Ross'),
    ('00000000-0000-4000-8000-000000000225'::uuid, 'megan-foster@andrew.cmu.edu', 'student'::public.app_role, 'Megan Foster')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('ResearchDemo2026!', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object('role', role::text, 'full_name', full_name),
  now(),
  now(),
  '',
  '',
  '',
  ''
from demo_users
on conflict (id) do nothing;

with demo_users(id, email, role, full_name) as (
  values
    ('00000000-0000-4000-8000-000000000101'::uuid, 'anita-rao@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Anita Rao'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'benjamin-kline@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Benjamin Kline'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'elena-watson@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Elena Watson'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'marcus-lee@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Marcus Lee'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'priya-shah@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Priya Shah'),
    ('00000000-0000-4000-8000-000000000106'::uuid, 'lina-huang@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Lina Huang'),
    ('00000000-0000-4000-8000-000000000107'::uuid, 'owen-bradford@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Owen Bradford'),
    ('00000000-0000-4000-8000-000000000108'::uuid, 'natalie-cho@andrew.cmu.edu', 'professor'::public.app_role, 'Dr. Natalie Cho'),
    ('00000000-0000-4000-8000-000000000109'::uuid, 'dean.demo@andrew.cmu.edu', 'dean'::public.app_role, 'CMU Dean Demo'),
    ('00000000-0000-4000-8000-000000000110'::uuid, 'recruiter.demo@andrew.cmu.edu', 'recruiter'::public.app_role, 'CMU Recruiter Demo'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'maya-patel@andrew.cmu.edu', 'student'::public.app_role, 'Maya Patel'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'jonathan-youngblood@andrew.cmu.edu', 'student'::public.app_role, 'Jonathan Youngblood'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'elena-garcia@andrew.cmu.edu', 'student'::public.app_role, 'Elena Garcia'),
    ('00000000-0000-4000-8000-000000000204'::uuid, 'noah-kim@andrew.cmu.edu', 'student'::public.app_role, 'Noah Kim'),
    ('00000000-0000-4000-8000-000000000205'::uuid, 'aisha-robinson@andrew.cmu.edu', 'student'::public.app_role, 'Aisha Robinson'),
    ('00000000-0000-4000-8000-000000000206'::uuid, 'samir-mehta@andrew.cmu.edu', 'student'::public.app_role, 'Samir Mehta'),
    ('00000000-0000-4000-8000-000000000207'::uuid, 'grace-liu@andrew.cmu.edu', 'student'::public.app_role, 'Grace Liu'),
    ('00000000-0000-4000-8000-000000000208'::uuid, 'diego-martinez@andrew.cmu.edu', 'student'::public.app_role, 'Diego Martinez'),
    ('00000000-0000-4000-8000-000000000209'::uuid, 'sophia-nguyen@andrew.cmu.edu', 'student'::public.app_role, 'Sophia Nguyen'),
    ('00000000-0000-4000-8000-000000000210'::uuid, 'ethan-brooks@andrew.cmu.edu', 'student'::public.app_role, 'Ethan Brooks'),
    ('00000000-0000-4000-8000-000000000211'::uuid, 'leah-cohen@andrew.cmu.edu', 'student'::public.app_role, 'Leah Cohen'),
    ('00000000-0000-4000-8000-000000000212'::uuid, 'arjun-iyer@andrew.cmu.edu', 'student'::public.app_role, 'Arjun Iyer'),
    ('00000000-0000-4000-8000-000000000213'::uuid, 'nina-okafor@andrew.cmu.edu', 'student'::public.app_role, 'Nina Okafor'),
    ('00000000-0000-4000-8000-000000000214'::uuid, 'owen-wilson@andrew.cmu.edu', 'student'::public.app_role, 'Owen Wilson'),
    ('00000000-0000-4000-8000-000000000215'::uuid, 'camila-torres@andrew.cmu.edu', 'student'::public.app_role, 'Camila Torres'),
    ('00000000-0000-4000-8000-000000000216'::uuid, 'victor-chen@andrew.cmu.edu', 'student'::public.app_role, 'Victor Chen'),
    ('00000000-0000-4000-8000-000000000217'::uuid, 'hana-kobayashi@andrew.cmu.edu', 'student'::public.app_role, 'Hana Kobayashi'),
    ('00000000-0000-4000-8000-000000000218'::uuid, 'lucas-brown@andrew.cmu.edu', 'student'::public.app_role, 'Lucas Brown'),
    ('00000000-0000-4000-8000-000000000219'::uuid, 'rachel-stein@andrew.cmu.edu', 'student'::public.app_role, 'Rachel Stein'),
    ('00000000-0000-4000-8000-000000000220'::uuid, 'kevin-park@andrew.cmu.edu', 'student'::public.app_role, 'Kevin Park'),
    ('00000000-0000-4000-8000-000000000221'::uuid, 'mina-haddad@andrew.cmu.edu', 'student'::public.app_role, 'Mina Haddad'),
    ('00000000-0000-4000-8000-000000000222'::uuid, 'tyler-evans@andrew.cmu.edu', 'student'::public.app_role, 'Tyler Evans'),
    ('00000000-0000-4000-8000-000000000223'::uuid, 'isabel-rivera@andrew.cmu.edu', 'student'::public.app_role, 'Isabel Rivera'),
    ('00000000-0000-4000-8000-000000000224'::uuid, 'david-ross@andrew.cmu.edu', 'student'::public.app_role, 'David Ross'),
    ('00000000-0000-4000-8000-000000000225'::uuid, 'megan-foster@andrew.cmu.edu', 'student'::public.app_role, 'Megan Foster')
)
insert into public.profiles (id, email, role, full_name, setup_completed, created_at, updated_at)
select id, email, role, full_name, true, now(), now()
from demo_users
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  full_name = excluded.full_name,
  setup_completed = true,
  updated_at = now();

insert into public.professors (
  id, setup_completed, department, title, contact_email, office_hours, bio_url,
  research_areas, research_interests, professor_website, publications_link, metadata
)
values
  ('00000000-0000-4000-8000-000000000101', true, 'Machine Learning Department', 'Associate Professor', 'anita-rao@andrew.cmu.edu', 'Tue 2-4 PM, Gates 8013', 'https://www.ml.cmu.edu/people/faculty/rao.html', array['Machine Learning', 'Healthcare AI'], array['interpretable machine learning', 'clinical decision support', 'model evaluation'], 'https://cmu-demo.example.edu/rao-lab', 'https://scholar.google.com/citations?user=rao-demo', '{"lab":"Trustworthy Health ML Lab","grantFunding":"$710K","publications":7,"presentations":9}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', true, 'Robotics Institute', 'Assistant Professor', 'benjamin-kline@andrew.cmu.edu', 'Wed 10-12 PM, Newell-Simon 3212', 'https://www.ri.cmu.edu/ri-faculty/benjamin-kline', array['Robotics', 'Autonomous Systems'], array['navigation', 'multi-robot planning', 'dynamic environments'], 'https://cmu-demo.example.edu/kline-robotics', 'https://scholar.google.com/citations?user=kline-demo', '{"lab":"Field Robotics Navigation Group","grantFunding":"$840K","publications":8,"presentations":11}'::jsonb),
  ('00000000-0000-4000-8000-000000000103', true, 'Computer Science Department', 'Professor', 'elena-watson@andrew.cmu.edu', 'Thu 1-3 PM, Gates 7115', 'https://www.cs.cmu.edu/directory/elena-watson', array['Natural Language Processing', 'Human-AI Collaboration'], array['LLM research assistants', 'literature review systems', 'AI evaluation'], 'https://cmu-demo.example.edu/watson-nlp', 'https://scholar.google.com/citations?user=watson-demo', '{"lab":"AI Research Systems Lab","grantFunding":"$620K","publications":6,"presentations":8}'::jsonb),
  ('00000000-0000-4000-8000-000000000104', true, 'Biomedical Engineering', 'Associate Professor', 'marcus-lee@andrew.cmu.edu', 'Mon 3-5 PM, Scott Hall 4211', 'https://www.bme.cmu.edu/directory/marcus-lee', array['Biomedical Engineering', 'Computer Vision'], array['medical imaging', 'signal processing', 'clinical translation'], 'https://cmu-demo.example.edu/lee-health-ai', 'https://scholar.google.com/citations?user=lee-demo', '{"lab":"Health Data Science Lab","grantFunding":"$760K","publications":7,"presentations":8}'::jsonb),
  ('00000000-0000-4000-8000-000000000105', true, 'Tepper School of Business', 'Assistant Professor', 'priya-shah@andrew.cmu.edu', 'Fri 9-11 AM, Tepper 5220', 'https://www.cmu.edu/tepper/faculty-and-research/faculty-by-area/profiles/shah-priya.html', array['Business Analytics', 'Economics'], array['market risk', 'student success analytics', 'operations research'], 'https://cmu-demo.example.edu/shah-analytics', 'https://scholar.google.com/citations?user=shah-demo', '{"lab":"AI + Business Research Group","grantFunding":"$590K","publications":5,"presentations":9}'::jsonb),
  ('00000000-0000-4000-8000-000000000106', true, 'Electrical and Computer Engineering', 'Associate Professor', 'lina-huang@andrew.cmu.edu', 'Tue 11-1 PM, Hamerschlag B120', 'https://www.ece.cmu.edu/directory/bios/huang-lina.html', array['Electrical & Computer Engineering', 'Signal Processing'], array['brain-computer interfaces', 'edge ML', 'wearable sensing'], 'https://cmu-demo.example.edu/huang-ece', 'https://scholar.google.com/citations?user=huang-demo', '{"lab":"Embedded Intelligence Lab","grantFunding":"$420K","publications":4,"presentations":6}'::jsonb),
  ('00000000-0000-4000-8000-000000000107', true, 'Heinz College of Information Systems and Public Policy', 'Professor', 'owen-bradford@andrew.cmu.edu', 'Wed 2-4 PM, Hamburg Hall 2117', 'https://www.heinz.cmu.edu/faculty-research/profiles/bradford-owen', array['Public Policy', 'Climate Analytics'], array['climate policy', 'causal inference', 'public-sector data'], 'https://cmu-demo.example.edu/bradford-policy', 'https://scholar.google.com/citations?user=bradford-demo', '{"lab":"Computational Policy Lab","grantFunding":"$510K","publications":6,"presentations":7}'::jsonb),
  ('00000000-0000-4000-8000-000000000108', true, 'Psychology Department', 'Assistant Professor', 'natalie-cho@andrew.cmu.edu', 'Thu 10-12 PM, Baker Hall 340A', 'https://www.cmu.edu/dietrich/psychology/people/faculty/cho-natalie.html', array['Psychology', 'Behavioral Economics'], array['decision making', 'cognitive science', 'human-AI teams'], 'https://cmu-demo.example.edu/cho-behavior', 'https://scholar.google.com/citations?user=cho-demo', '{"lab":"Behavior and Decision Lab","grantFunding":"$310K","publications":4,"presentations":7}'::jsonb)
on conflict (id) do update set
  setup_completed = excluded.setup_completed,
  department = excluded.department,
  title = excluded.title,
  contact_email = excluded.contact_email,
  office_hours = excluded.office_hours,
  bio_url = excluded.bio_url,
  research_areas = excluded.research_areas,
  research_interests = excluded.research_interests,
  professor_website = excluded.professor_website,
  publications_link = excluded.publications_link,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.students (
  id, setup_completed, major, degree, academic_year, linkedin_url, github_url,
  research_interests, resume_text, transcript_text, coursework, resume, transcript, metadata
)
values
  ('00000000-0000-4000-8000-000000000201', true, 'Computer Science', 'BS', 'Junior', 'https://linkedin.com/in/maya-patel-cmu', 'https://github.com/maya-patel-cmu', array['Robotics', 'Computer Vision', 'Multi-Agent Systems'], 'ROS navigation intern; PyTorch vision experiments; warehouse robot coordination paper draft.', '15-122 A, 16-311 A-, 10-301 A, 16-385 A-', '[{"courseNumber":"16-311","courseName":"Introduction to Robotics","semester":"Spring 2026"},{"courseNumber":"10-301","courseName":"Machine Learning","semester":"Fall 2025"}]'::jsonb, '{"name":"maya_patel_robotics_resume.pdf","uploadDate":"2026-02-01T15:00:00Z"}'::jsonb, '{"name":"maya_patel_transcript.pdf","uploadDate":"2026-02-01T15:05:00Z"}'::jsonb, '{"gpa":3.87,"skills":["Python","ROS","C++","OpenCV","PyTorch"],"sourceTags":["resume","github","transcript"],"confidenceScore":95,"matchReasons":["ROS implementation depth","strong ML coursework","active robotics evidence"],"evidenceItems":[{"type":"github_repo","title":"warehouse-robot-coordination","url":"https://github.com/cmu-demo/warehouse-robot-coordination"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000202', true, 'Business Administration', 'BS', 'Sophomore', 'https://linkedin.com/in/jonathan-youngblood-cmu', 'https://github.com/JYoungblood112', array['Machine Learning', 'Business Analytics', 'AI for Business'], 'Built model benchmarking dashboards, SQL pipelines, and applied ML notebooks for operational analytics.', '70-207 A, 36-200 A-, 15-112 A, 10-301 B+', '[{"courseNumber":"70-207","courseName":"Business Analytics","semester":"Spring 2026"},{"courseNumber":"15-112","courseName":"Fundamentals of Programming","semester":"Fall 2025"}]'::jsonb, '{"name":"jonathan_youngblood_ai_business_resume.pdf","uploadDate":"2026-02-02T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.74,"skills":["Python","SQL","Tableau","Power BI","PyTorch"],"sourceTags":["resume","github","linkedin"],"confidenceScore":92,"matchReasons":["analytics portfolio","experiment tracking","clear product sense"],"evidenceItems":[{"type":"notebook","title":"model-evaluation-dashboard.ipynb","url":"https://github.com/JYoungblood112/ml-research-portfolio"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000203', true, 'Statistics & Machine Learning', 'MS', 'Master''s', 'https://linkedin.com/in/elena-garcia-stats', 'https://github.com/elena-garcia-stats', array['Health AI', 'Causal Inference', 'Data Visualization'], 'Matched cohort analysis in R and Python; clinical outcomes poster; reproducible notebook workflows.', '36-705 A, 36-707 A-, 10-601 A-', '[{"courseNumber":"36-705","courseName":"Intermediate Statistics","semester":"Fall 2025"},{"courseNumber":"10-601","courseName":"Machine Learning","semester":"Spring 2026"}]'::jsonb, '{"name":"elena_garcia_health_ai_resume.pdf","uploadDate":"2026-02-03T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.91,"skills":["R","Python","SQL","CausalML","ggplot2"],"sourceTags":["resume","github","poster"],"confidenceScore":89,"matchReasons":["statistical rigor","clinical data experience","clear research writing"],"evidenceItems":[{"type":"poster","title":"clinical-outcomes-poster.pdf","url":"https://cmu-demo.example.edu/evidence/clinical-outcomes-poster.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000204', true, 'Electrical & Computer Engineering', 'BS', 'Junior', 'https://linkedin.com/in/noah-kim-ece', 'https://github.com/noah-kim-ece', array['Embedded AI', 'Signal Processing', 'Edge Computing'], 'Benchmarked low-power inference on microcontrollers; MATLAB signal processing projects.', '18-213 A-, 18-290 A, 18-349 B+', '[{"courseNumber":"18-213","courseName":"Introduction to Computer Systems","semester":"Fall 2025"},{"courseNumber":"18-290","courseName":"Signals and Systems","semester":"Spring 2026"}]'::jsonb, '{"name":"noah_kim_ece_resume.pdf","uploadDate":"2026-02-04T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.62,"skills":["C","Python","MATLAB","TensorFlow Lite","Linux"],"sourceTags":["resume","github","demo_video"],"confidenceScore":84,"matchReasons":["hardware/software integration","signal processing foundation"],"evidenceItems":[{"type":"demo_video","title":"edge-inference-demo","url":"https://cmu-demo.example.edu/evidence/edge-inference-demo.mp4"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000205', true, 'Public Policy', 'MS', 'Master''s', 'https://linkedin.com/in/aisha-robinson-policy', 'https://github.com/aisha-policy-data', array['Climate Policy', 'Causal Inference', 'Equity Analytics'], 'Analyzed municipal climate policy datasets and wrote policy memos with reproducible R notebooks.', '90-711 A, 90-786 A-, 36-700 B+', '[{"courseNumber":"90-711","courseName":"Empirical Methods for Public Policy","semester":"Fall 2025"}]'::jsonb, '{"name":"aisha_robinson_policy_resume.pdf","uploadDate":"2026-02-05T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.83,"skills":["R","Python","GIS","Policy Writing","Causal Inference"],"sourceTags":["resume","notebook","writing_sample"],"confidenceScore":88,"matchReasons":["policy domain depth","causal methods","strong writing"],"evidenceItems":[{"type":"research_report","title":"climate-equity-memo.pdf","url":"https://cmu-demo.example.edu/evidence/climate-equity-memo.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000206', true, 'Cognitive Science', 'BS', 'Senior', 'https://linkedin.com/in/samir-mehta-cogsci', 'https://github.com/samir-cogsci', array['Human-AI Collaboration', 'Psychology', 'Education Technology'], 'Ran controlled studies for tutoring interfaces; coded survey responses and interaction logs.', '85-211 A, 05-391 A-, 36-220 A-', '[{"courseNumber":"05-391","courseName":"Designing Human-Centered Software","semester":"Fall 2025"}]'::jsonb, '{"name":"samir_mehta_hai_resume.pdf","uploadDate":"2026-02-06T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.69,"skills":["User Research","Python","Qualtrics","Thematic Coding","Statistics"],"sourceTags":["resume","study_protocol","linkedin"],"confidenceScore":86,"matchReasons":["study operations","human-AI interest","qualitative coding"],"evidenceItems":[{"type":"presentation","title":"ai-tutor-study-slides","url":"https://docs.google.com/presentation/d/cmu-demo-ai-tutor"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000207', true, 'Biology', 'BS', 'Junior', 'https://linkedin.com/in/grace-liu-bio', 'https://github.com/grace-liu-bioimage', array['Biomedical Engineering', 'Medical Imaging', 'Computational Biology'], 'Segmented microscopy images and maintained wet-lab metadata for cell morphology experiments.', '03-231 A-, 02-250 A, 15-112 B+', '[{"courseNumber":"02-250","courseName":"Introduction to Computational Biology","semester":"Spring 2026"}]'::jsonb, '{"name":"grace_liu_bioimaging_resume.pdf","uploadDate":"2026-02-07T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.58,"skills":["Python","ImageJ","CellProfiler","Pandas","Lab Protocols"],"sourceTags":["resume","lab_notebook"],"confidenceScore":81,"matchReasons":["domain knowledge","image analysis exposure"],"evidenceItems":[{"type":"notebook","title":"cell-morphology-analysis.ipynb","url":"https://github.com/grace-liu-bioimage/cell-morphology"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000208', true, 'Mechanical Engineering', 'BS', 'Sophomore', 'https://linkedin.com/in/diego-martinez-meche', 'https://github.com/diego-robotics', array['Robotics', 'Controls', 'Human-Robot Interaction'], 'Built controls labs in MATLAB and Arduino; assisted with robot manipulator calibration.', '24-101 A, 24-352 B+, 15-112 A-', '[{"courseNumber":"24-352","courseName":"Dynamic Systems and Controls","semester":"Spring 2026"}]'::jsonb, '{"name":"diego_martinez_controls_resume.pdf","uploadDate":"2026-02-08T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.44,"skills":["MATLAB","Python","Arduino","CAD","Controls"],"sourceTags":["resume","github"],"confidenceScore":76,"matchReasons":["controls foundation","hands-on prototyping"],"evidenceItems":[{"type":"github_repo","title":"manipulator-calibration-tools","url":"https://github.com/diego-robotics/manipulator-calibration"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000209', true, 'Economics', 'BS', 'Senior', 'https://linkedin.com/in/sophia-nguyen-econ', 'https://github.com/sophia-econ-risk', array['Behavioral Economics', 'Financial Markets', 'Decision Making'], 'Modeled risk factors and ran behavioral-choice analysis for an undergraduate economics seminar.', '73-265 A, 36-225 A-, 73-359 A-', '[{"courseNumber":"73-359","courseName":"Benefit-Cost Analysis","semester":"Fall 2025"}]'::jsonb, '{"name":"sophia_nguyen_economics_resume.pdf","uploadDate":"2026-02-09T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.78,"skills":["R","Stata","Python","Regression","Research Writing"],"sourceTags":["resume","paper"],"confidenceScore":87,"matchReasons":["economics background","risk modeling","strong writing"],"evidenceItems":[{"type":"paper","title":"risk-preferences-working-paper.pdf","url":"https://cmu-demo.example.edu/evidence/risk-preferences-working-paper.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000210', true, 'Computer Science', 'MS', 'Master''s', 'https://linkedin.com/in/ethan-brooks-nlp', 'https://github.com/ethan-brooks-nlp', array['Natural Language Processing', 'Information Retrieval', 'LLM Evaluation'], 'Implemented retrieval-augmented literature review tools and evaluation dashboards.', '11-711 A, 10-623 A-, 15-619 A-', '[{"courseNumber":"11-711","courseName":"Advanced NLP","semester":"Spring 2026"}]'::jsonb, '{"name":"ethan_brooks_nlp_resume.pdf","uploadDate":"2026-02-10T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.94,"skills":["Python","PyTorch","Transformers","Evaluation","Elasticsearch"],"sourceTags":["resume","github","paper"],"confidenceScore":96,"matchReasons":["LLM system depth","evaluation experience","publication readiness"],"evidenceItems":[{"type":"pull_request","title":"literature-rag-evaluator-pr","url":"https://github.com/cmu-demo/literature-rag/pull/12"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000211', true, 'Statistics & Machine Learning', 'BS', 'Junior', 'https://linkedin.com/in/leah-cohen-stats', 'https://github.com/leah-cohen-stats', array['Student Success Analytics', 'Predictive Modeling', 'Fairness'], 'Created retention-risk models with fairness checks and documented feature leakage risks.', '36-401 A, 10-301 A-, 36-350 A', '[{"courseNumber":"36-401","courseName":"Modern Regression","semester":"Fall 2025"}]'::jsonb, '{"name":"leah_cohen_stats_resume.pdf","uploadDate":"2026-02-11T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.88,"skills":["R","Python","Scikit-learn","Fairness Metrics","SQL"],"sourceTags":["resume","notebook"],"confidenceScore":91,"matchReasons":["predictive modeling","fairness awareness","clean notebooks"],"evidenceItems":[{"type":"notebook","title":"student-success-fairness.ipynb","url":"https://github.com/leah-cohen-stats/student-success"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000212', true, 'Electrical & Computer Engineering', 'MS', 'Master''s', 'https://linkedin.com/in/arjun-iyer-bci', 'https://github.com/arjun-bci', array['Brain-Computer Interfaces', 'Signal Processing', 'Biomedical Devices'], 'Processed EEG signals, built filters, and evaluated classification pipelines for motor imagery.', '18-791 A, 18-792 A-, 42-620 B+', '[{"courseNumber":"18-791","courseName":"Digital Signal Processing","semester":"Spring 2026"}]'::jsonb, '{"name":"arjun_iyer_bci_resume.pdf","uploadDate":"2026-02-12T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.9,"skills":["Python","MATLAB","EEG","Signal Processing","Scikit-learn"],"sourceTags":["resume","github","dataset"],"confidenceScore":94,"matchReasons":["BCI domain match","DSP strength","reproducible experiments"],"evidenceItems":[{"type":"dataset","title":"eeg-feature-dataset-card","url":"https://cmu-demo.example.edu/evidence/eeg-feature-dataset"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000213', true, 'Public Policy', 'BS', 'Senior', 'https://linkedin.com/in/nina-okafor-policy', 'https://github.com/nina-policy', array['Climate Analytics', 'Public Sector Data', 'Equity'], 'Mapped energy-burden trends and cleaned county-level climate adaptation datasets.', '90-385 A-, 36-202 A, 19-101 A-', '[{"courseNumber":"90-385","courseName":"Policy Analysis Senior Project","semester":"Spring 2026"}]'::jsonb, '{"name":"nina_okafor_policy_resume.pdf","uploadDate":"2026-02-13T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.71,"skills":["Python","GIS","Policy Memos","Data Cleaning"],"sourceTags":["resume","report"],"confidenceScore":82,"matchReasons":["climate policy context","public datasets"],"evidenceItems":[{"type":"research_report","title":"energy-burden-analysis.pdf","url":"https://cmu-demo.example.edu/evidence/energy-burden-analysis.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000214', true, 'Business Administration', 'BS', 'Junior', 'https://linkedin.com/in/owen-wilson-analytics', 'https://github.com/owen-analytics', array['Business Analytics', 'Financial Risk', 'Operations'], 'Built VaR dashboards and cleaned market time-series data for finance club research.', '70-391 A-, 36-225 B+, 15-112 A-', '[{"courseNumber":"70-391","courseName":"Finance","semester":"Fall 2025"}]'::jsonb, '{"name":"owen_wilson_finance_resume.pdf","uploadDate":"2026-02-14T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.55,"skills":["Python","SQL","Tableau","Time Series","Excel"],"sourceTags":["resume","github"],"confidenceScore":79,"matchReasons":["market data experience","dashboarding"],"evidenceItems":[{"type":"github_repo","title":"market-risk-dashboard","url":"https://github.com/owen-analytics/market-risk-dashboard"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000215', true, 'Psychology', 'BS', 'Junior', 'https://linkedin.com/in/camila-torres-psych', 'https://github.com/camila-psych', array['Behavioral Economics', 'Decision Making', 'Survey Research'], 'Coded survey responses and ran mixed-effects models for decision-making studies.', '85-310 A, 36-309 A-, 73-250 B+', '[{"courseNumber":"85-310","courseName":"Research Methods in Cognitive Psychology","semester":"Fall 2025"}]'::jsonb, '{"name":"camila_torres_psych_resume.pdf","uploadDate":"2026-02-15T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.67,"skills":["R","Qualtrics","Survey Design","Thematic Coding"],"sourceTags":["resume","study_data"],"confidenceScore":85,"matchReasons":["behavioral methods","survey operations"],"evidenceItems":[{"type":"dataset","title":"choice-study-codebook.csv","url":"https://cmu-demo.example.edu/evidence/choice-study-codebook.csv"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000216', true, 'Computer Science', 'BS', 'Senior', 'https://linkedin.com/in/victor-chen-cv', 'https://github.com/victor-chen-cv', array['Computer Vision', 'Medical Imaging', 'Deep Learning'], 'Trained segmentation models and wrote reproducible PyTorch experiment configs.', '16-385 A, 10-414 A-, 15-451 B+', '[{"courseNumber":"16-385","courseName":"Computer Vision","semester":"Spring 2026"}]'::jsonb, '{"name":"victor_chen_cv_resume.pdf","uploadDate":"2026-02-16T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.82,"skills":["Python","PyTorch","OpenCV","CUDA","Experiment Tracking"],"sourceTags":["resume","github","notebook"],"confidenceScore":93,"matchReasons":["vision model depth","medical imaging fit"],"evidenceItems":[{"type":"pull_request","title":"unet-baseline-pr","url":"https://github.com/cmu-demo/medical-imaging/pull/8"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000217', true, 'Machine Learning', 'PhD', 'PhD', 'https://linkedin.com/in/hana-kobayashi-ml', 'https://github.com/hana-ml', array['Interpretable ML', 'Healthcare AI', 'Fairness'], 'PhD student studying uncertainty and explanation fidelity in clinical prediction models.', '10-715 A, 10-718 A, 36-707 A', '[{"courseNumber":"10-715","courseName":"Advanced Introduction to Machine Learning","semester":"Fall 2025"}]'::jsonb, '{"name":"hana_kobayashi_ml_cv.pdf","uploadDate":"2026-02-17T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":4.0,"skills":["Python","PyTorch","Calibration","SHAP","Causal Inference"],"sourceTags":["cv","paper","github"],"confidenceScore":98,"matchReasons":["graduate research maturity","interpretability expertise"],"evidenceItems":[{"type":"paper","title":"explanation-fidelity-preprint.pdf","url":"https://arxiv.org/abs/2601.00017"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000218', true, 'Statistics & Machine Learning', 'BS', 'Sophomore', 'https://linkedin.com/in/lucas-brown-stats', 'https://github.com/lucas-stats', array['Predictive Analytics', 'Education Data', 'Visualization'], 'Early researcher with strong statistics coursework and polished dashboard projects.', '36-200 A, 36-202 A-, 15-112 B+', '[{"courseNumber":"36-202","courseName":"Statistical Methods","semester":"Spring 2026"}]'::jsonb, '{"name":"lucas_brown_stats_resume.pdf","uploadDate":"2026-02-18T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.51,"skills":["R","Python","Tableau","Data Cleaning"],"sourceTags":["resume","portfolio"],"confidenceScore":74,"matchReasons":["good fundamentals","needs more research depth"],"evidenceItems":[{"type":"presentation","title":"education-dashboard-demo","url":"https://cmu-demo.example.edu/evidence/education-dashboard-demo"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000219', true, 'Cognitive Science', 'BS', 'Senior', 'https://linkedin.com/in/rachel-stein-hci', 'https://github.com/rachel-hci', array['Human-AI Collaboration', 'Education Technology', 'UX Research'], 'Designed user studies for AI writing tools and synthesized interview data for research teams.', '05-391 A, 85-211 A-, 36-220 A-', '[{"courseNumber":"05-391","courseName":"Designing Human-Centered Software","semester":"Spring 2026"}]'::jsonb, '{"name":"rachel_stein_hci_resume.pdf","uploadDate":"2026-02-19T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.76,"skills":["User Research","Figma","Python","Interview Coding","Statistics"],"sourceTags":["resume","portfolio","study_protocol"],"confidenceScore":90,"matchReasons":["HCI study depth","education AI fit"],"evidenceItems":[{"type":"research_report","title":"ai-writing-study-report.pdf","url":"https://cmu-demo.example.edu/evidence/ai-writing-study-report.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000220', true, 'Mechanical Engineering', 'MS', 'Master''s', 'https://linkedin.com/in/kevin-park-robotics', 'https://github.com/kevin-robotics', array['Robotics', 'Planning', 'Controls'], 'Implemented trajectory optimization assignments and simulation experiments for mobile robots.', '16-735 A-, 24-774 A, 10-301 B+', '[{"courseNumber":"16-735","courseName":"Robot Motion Planning","semester":"Spring 2026"}]'::jsonb, '{"name":"kevin_park_robotics_resume.pdf","uploadDate":"2026-02-20T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.73,"skills":["Python","C++","ROS","Optimization","Simulation"],"sourceTags":["resume","github"],"confidenceScore":88,"matchReasons":["motion planning coursework","simulation skills"],"evidenceItems":[{"type":"github_repo","title":"trajectory-planning-lab","url":"https://github.com/kevin-robotics/trajectory-planning-lab"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000221', true, 'Economics', 'MS', 'Master''s', 'https://linkedin.com/in/mina-haddad-econ', 'https://github.com/mina-econ', array['Financial Risk', 'Causal Inference', 'Market Design'], 'Built time-series risk models and analyzed market microstructure datasets.', '73-476 A, 36-705 A-, 10-601 B+', '[{"courseNumber":"73-476","courseName":"Financial Markets","semester":"Fall 2025"}]'::jsonb, '{"name":"mina_haddad_risk_resume.pdf","uploadDate":"2026-02-21T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.86,"skills":["Python","R","Time Series","Econometrics","SQL"],"sourceTags":["resume","paper","github"],"confidenceScore":92,"matchReasons":["risk modeling depth","econometrics"],"evidenceItems":[{"type":"notebook","title":"var-stress-test.ipynb","url":"https://github.com/mina-econ/market-risk"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000222', true, 'Business Administration', 'BS', 'Sophomore', 'https://linkedin.com/in/tyler-evans-business', 'https://github.com/tyler-analytics', array['Student Success Analytics', 'Operations Research'], 'Analyzed advising workflow data in a class project; newer to ML implementation.', '70-207 B+, 36-200 A-, 15-110 A', '[{"courseNumber":"70-207","courseName":"Business Analytics","semester":"Spring 2026"}]'::jsonb, '{"name":"tyler_evans_analytics_resume.pdf","uploadDate":"2026-02-22T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.35,"skills":["Excel","SQL","Tableau","Python"],"sourceTags":["resume","class_project"],"confidenceScore":68,"matchReasons":["business context","needs ML ramp-up"],"evidenceItems":[{"type":"presentation","title":"advising-analytics-presentation","url":"https://cmu-demo.example.edu/evidence/advising-analytics-presentation.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000223', true, 'Biology', 'BS', 'Senior', 'https://linkedin.com/in/isabel-rivera-bio', 'https://github.com/isabel-bio', array['Biomedical Engineering', 'Healthcare AI', 'Clinical Data'], 'Worked with clinical labels and lab assays; wants stronger computational research experience.', '03-231 A, 02-261 A-, 36-200 B+', '[{"courseNumber":"02-261","courseName":"Quantitative Cell and Molecular Biology","semester":"Fall 2025"}]'::jsonb, '{"name":"isabel_rivera_bio_resume.pdf","uploadDate":"2026-02-23T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.61,"skills":["R","Python","Lab Protocols","Clinical Labels"],"sourceTags":["resume","lab_report"],"confidenceScore":77,"matchReasons":["biomedical context","moderate coding depth"],"evidenceItems":[{"type":"research_report","title":"clinical-label-quality-report.pdf","url":"https://cmu-demo.example.edu/evidence/clinical-label-quality-report.pdf"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000224', true, 'Computer Science', 'BS', 'First-Year', 'https://linkedin.com/in/david-ross-cs', 'https://github.com/david-ross-cs', array['Machine Learning', 'Education Technology'], 'Strong first-year programmer with hackathon project experience and interest in AI tutors.', '15-112 A, 21-127 A-', '[{"courseNumber":"15-112","courseName":"Fundamentals of Programming","semester":"Fall 2025"}]'::jsonb, '{"name":"david_ross_cs_resume.pdf","uploadDate":"2026-02-24T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.7,"skills":["Python","JavaScript","React","Data Visualization"],"sourceTags":["resume","github"],"confidenceScore":66,"matchReasons":["strong motivation","early research stage"],"evidenceItems":[{"type":"github_repo","title":"ai-study-buddy-hackathon","url":"https://github.com/david-ross-cs/ai-study-buddy"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000225', true, 'Public Policy', 'BS', 'Junior', 'https://linkedin.com/in/megan-foster-policy', 'https://github.com/megan-policy-data', array['Climate Policy', 'Behavioral Economics'], 'Policy analyst with survey design experience and basic R/Python data cleaning.', '90-385 B+, 36-202 B+, 73-250 A-', '[{"courseNumber":"90-385","courseName":"Policy Analysis Senior Project","semester":"Spring 2026"}]'::jsonb, '{"name":"megan_foster_policy_resume.pdf","uploadDate":"2026-02-25T15:00:00Z"}'::jsonb, '{}'::jsonb, '{"gpa":3.42,"skills":["R","Survey Design","Policy Writing","Data Cleaning"],"sourceTags":["resume","writing_sample"],"confidenceScore":72,"matchReasons":["policy writing","lighter technical depth"],"evidenceItems":[{"type":"paper","title":"behavioral-energy-policy-brief.pdf","url":"https://cmu-demo.example.edu/evidence/behavioral-energy-policy-brief.pdf"}]}'::jsonb)
on conflict (id) do update set
  setup_completed = excluded.setup_completed,
  major = excluded.major,
  degree = excluded.degree,
  academic_year = excluded.academic_year,
  linkedin_url = excluded.linkedin_url,
  github_url = excluded.github_url,
  research_interests = excluded.research_interests,
  resume_text = excluded.resume_text,
  transcript_text = excluded.transcript_text,
  coursework = excluded.coursework,
  resume = excluded.resume,
  transcript = excluded.transcript,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.projects (
  id, professor_id, category, research_areas, skills_needed, title, overview,
  student_role_description, student_gain, required_qualifications, preferred_qualifications,
  time_commitment_expected, start_date, duration, application_deadline, compensation,
  questions, quick_note_enabled, status, approved_at, created_at
)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'Machine Learning', array['Interpretable ML', 'Healthcare AI'], array['Python','PyTorch','Model Evaluation','Statistics'], 'Interpretable Machine Learning for Healthcare', 'Develop explanation and calibration workflows for clinical risk models using de-identified health data.', 'Run model audits, write analysis notebooks, and prepare weekly summaries for the Trustworthy Health ML Lab.', 'Experience with responsible AI evaluation, clinical ML workflows, and publication-quality research communication.', 'Python, statistics, and machine learning coursework.', 'PyTorch, calibration metrics, or healthcare data experience.', '10-12 hours per week', '2026-08-24', '2 semesters', '2026-07-15', 'stipend', '[{"question":"Describe a model evaluation project you have completed.","wordLimit":150},{"question":"How would you explain uncertainty to a clinical stakeholder?","wordLimit":150}]'::jsonb, true, 'published', now(), '2026-05-01T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000102', 'Robotics', array['Navigation','Autonomous Systems'], array['Python','C++','ROS','Planning'], 'Robotics Navigation in Dynamic Environments', 'Build navigation policies that remain robust when people and obstacles move unpredictably.', 'Implement simulation scenarios, evaluate planners, and help collect robot telemetry.', 'Hands-on robotics research experience with planning, simulation, and safety evaluation.', 'Algorithms, Python, and linear algebra.', 'ROS, C++, motion planning, or robotics lab experience.', '12-15 hours per week', '2026-08-24', '2 semesters', '2026-07-12', 'stipend', '[{"question":"What makes navigation difficult in dynamic scenes?","wordLimit":140},{"question":"Describe your robotics or simulation experience.","wordLimit":140}]'::jsonb, true, 'published', now(), '2026-05-02T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000103', 'Computer Science', array['NLP','Human-AI Collaboration'], array['Python','Transformers','Information Retrieval','Evaluation'], 'LLM-Based Research Assistant for Literature Review', 'Prototype and evaluate an LLM assistant that helps researchers find, cluster, and summarize related work.', 'Build retrieval pipelines, evaluate summaries, and design study materials for lab users.', 'Applied NLP systems experience and exposure to human-centered AI evaluation.', 'Python and data structures.', 'NLP coursework, search systems, or LLM evaluation experience.', '8-12 hours per week', '2026-08-24', '1 semester', '2026-07-18', 'course credit', '[{"question":"How would you evaluate a literature-review assistant?","wordLimit":150},{"question":"What risks appear when summarizing papers with LLMs?","wordLimit":150}]'::jsonb, true, 'published', now(), '2026-05-03T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000105', 'Business Analytics', array['Predictive Analytics','Education Data'], array['SQL','Python','Statistics','Dashboarding'], 'Predictive Analytics for Student Success', 'Create early-warning models and dashboards for student support interventions while auditing fairness.', 'Clean advising datasets, train baselines, and summarize model risks for program leaders.', 'Portfolio-ready analytics experience with ethical data-use framing.', 'Statistics and SQL fundamentals.', 'Fairness metrics, Tableau, or education analytics experience.', '8-10 hours per week', '2026-08-24', '1 semester', '2026-07-20', 'course credit', '[{"question":"What features might predict student success without becoming unfair?","wordLimit":150}]'::jsonb, true, 'published', now(), '2026-05-04T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000105', 'Economics', array['Financial Markets','Risk Modeling'], array['Python','R','Time Series','Econometrics'], 'Financial Market Risk Modeling', 'Stress-test portfolio risk models across volatility regimes using market and macroeconomic data.', 'Build reproducible notebooks, compare VaR variants, and document assumptions.', 'Experience connecting economics, statistical modeling, and decision-ready visualizations.', 'Probability, regression, and coding basics.', 'Time-series modeling, finance coursework, or risk dashboards.', '10-12 hours per week', '2026-08-24', '1 semester', '2026-07-22', 'stipend', '[{"question":"Describe a financial or time-series analysis you have done.","wordLimit":140}]'::jsonb, true, 'published', now(), '2026-05-05T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000104', 'Biomedical Engineering', array['Computer Vision','Medical Imaging'], array['Python','PyTorch','OpenCV','Image Analysis'], 'Computer Vision for Medical Imaging', 'Train and evaluate image models for segmentation and quality control in clinical imaging workflows.', 'Prepare datasets, run baseline experiments, and create error-analysis reports.', 'Medical imaging research experience with model training and translational constraints.', 'Python and linear algebra.', 'Computer vision, PyTorch, or biomedical domain experience.', '10-14 hours per week', '2026-08-24', '2 semesters', '2026-07-16', 'stipend', '[{"question":"What failure modes matter in medical imaging models?","wordLimit":150}]'::jsonb, true, 'published', now(), '2026-05-06T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000103', 'Psychology', array['Human-AI Collaboration','Education Technology'], array['User Research','Python','Statistics','Study Design'], 'Human-AI Collaboration in Education', 'Study when AI-generated hints improve learning and when they create overreliance.', 'Instrument prototypes, analyze interaction logs, and help run user studies.', 'End-to-end human-centered AI research practice.', 'Research methods and comfort with data analysis.', 'HCI, psychology, or education technology research experience.', '8-10 hours per week', '2026-08-24', '1 semester', '2026-07-24', 'course credit', '[{"question":"How would you identify overreliance on AI hints?","wordLimit":150}]'::jsonb, true, 'published', now(), '2026-05-07T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000107', 'Public Policy', array['Climate Policy','Causal Inference'], array['R','Python','GIS','Policy Writing'], 'Climate Policy Data Analysis', 'Analyze whether municipal climate programs reduce energy burden across neighborhoods.', 'Clean public datasets, estimate policy effects, and draft policy-facing visuals.', 'Policy analytics portfolio evidence and applied causal inference experience.', 'Data cleaning and policy writing.', 'GIS, causal inference, or climate policy background.', '8-12 hours per week', '2026-08-24', '1 semester', '2026-07-19', 'stipend', '[{"question":"How would you communicate uncertainty in a policy memo?","wordLimit":140}]'::jsonb, true, 'published', now(), '2026-05-08T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000309', '00000000-0000-4000-8000-000000000108', 'Economics', array['Behavioral Economics','Decision Making'], array['R','Survey Design','Statistics','Research Writing'], 'Behavioral Economics and Decision Making', 'Run survey and lab studies on how people make decisions under uncertainty and time pressure.', 'Code survey responses, run statistical models, and produce study documentation.', 'Behavioral research methods, data analysis, and faculty-reviewed contribution evidence.', 'Statistics and careful written communication.', 'Qualtrics, R, or behavioral economics coursework.', '6-9 hours per week', '2026-08-24', '1 semester', '2026-07-25', 'volunteer', '[{"question":"Describe a behavioral study design you find convincing.","wordLimit":140}]'::jsonb, true, 'published', now(), '2026-05-09T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000310', '00000000-0000-4000-8000-000000000106', 'Electrical & Computer Engineering', array['Brain-Computer Interfaces','Signal Processing'], array['MATLAB','Python','Signal Processing','EEG'], 'Brain-Computer Interface Signal Processing', 'Improve EEG feature extraction and classification pipelines for motor-imagery BCI experiments.', 'Implement filters, compare classifiers, and package reproducible reports.', 'Signal processing and biomedical device research experience.', 'Signals and systems plus Python or MATLAB.', 'EEG, wearable sensing, or ML classification experience.', '10-12 hours per week', '2026-08-24', '2 semesters', '2026-07-14', 'stipend', '[{"question":"What signal-processing steps would you use before classification?","wordLimit":150}]'::jsonb, true, 'published', now(), '2026-05-10T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000106', 'Electrical & Computer Engineering', array['Embedded AI','Wearable Sensing'], array['C','Python','TensorFlow Lite','Linux'], 'Edge ML for Wearable Health Sensors', 'Benchmark activity-recognition models for low-power wearable devices.', 'Profile latency and power, prepare deployment demos, and write engineering notes.', 'Embedded AI research artifacts with clear recruiter-facing evidence.', 'Systems programming and signal processing basics.', 'Microcontrollers, TensorFlow Lite, or wearable sensing.', '9-12 hours per week', '2026-08-24', '1 semester', '2026-07-26', 'stipend', '[{"question":"How would you evaluate an edge model besides accuracy?","wordLimit":140}]'::jsonb, true, 'published', now(), '2026-05-11T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000102', 'Robotics', array['Manipulation','Computer Vision'], array['Python','C++','3D Geometry','Simulation'], 'Perception-Driven Grasp Planning', 'Use 3D perception to improve grasp success in cluttered tabletop scenes.', 'Develop grasp-ranking features and evaluate success rates in simulation.', 'Robotics manipulation experience combining perception, geometry, and planning.', 'Programming and linear algebra.', 'Point clouds, simulation, or manipulation research.', '10-14 hours per week', '2026-08-24', '1 semester', '2026-07-17', 'stipend', '[{"question":"What makes grasp planning hard in clutter?","wordLimit":140}]'::jsonb, true, 'published', now(), '2026-05-12T14:00:00Z')
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
  approved_at = excluded.approved_at,
  updated_at = now();

with application_seed(id, project_id, student_id, status, submitted_at, confidence, matched_skills, missing_skills, note) as (
  values
    ('00000000-0000-4000-8000-000000000401'::uuid,'00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000217'::uuid,'Accepted'::public.application_status,'2026-06-01T14:00:00Z'::timestamptz,98,array['PyTorch','Calibration','Healthcare AI'],array[]::text[],'PhD-level interpretability background and clear plan for clinical uncertainty evaluation.'),
    ('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000203','Shortlisted','2026-06-01T15:00:00Z',89,array['Python','Statistics','Clinical Data'],array['PyTorch depth'],'Strong clinical statistics fit; ask about deep learning comfort.'),
    ('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000211','Interview','2026-06-02T14:00:00Z',91,array['Fairness Metrics','Python','Statistics'],array['Healthcare domain'],'Excellent fairness signal for model auditing.'),
    ('00000000-0000-4000-8000-000000000404','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000223','Pending','2026-06-03T14:00:00Z',77,array['Clinical Labels','R'],array['ML implementation'],'Biomedical context is useful, but coding depth is lighter.'),
    ('00000000-0000-4000-8000-000000000405','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000201','Accepted','2026-06-01T16:00:00Z',95,array['ROS','C++','Computer Vision'],array[]::text[],'Top robotics applicant with direct ROS evidence.'),
    ('00000000-0000-4000-8000-000000000406','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000220','Interview','2026-06-02T16:00:00Z',88,array['Planning','Simulation','C++'],array['field robotics'],'Strong planning coursework; discuss hardware experience.'),
    ('00000000-0000-4000-8000-000000000407','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000208','Pending','2026-06-03T16:00:00Z',76,array['Controls','Python'],array['ROS depth'],'Hands-on controls background, needs robotics stack ramp.'),
    ('00000000-0000-4000-8000-000000000408','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000204','Rejected','2026-06-04T16:00:00Z',61,array['Python'],array['Robotics experience','C++'],'Better aligned to embedded sensing than navigation this cycle.'),
    ('00000000-0000-4000-8000-000000000409','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000210','Accepted','2026-06-01T17:00:00Z',96,array['Transformers','IR','Evaluation'],array[]::text[],'Best fit for LLM evaluation and retrieval.'),
    ('00000000-0000-4000-8000-000000000410','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000202','Shortlisted','2026-06-02T17:00:00Z',82,array['Python','Dashboarding'],array['NLP coursework'],'Good product sense for researcher workflow evaluation.'),
    ('00000000-0000-4000-8000-000000000411','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000219','Interview','2026-06-03T17:00:00Z',90,array['User Research','Study Design'],array['Transformers'],'Excellent HCI evaluation profile.'),
    ('00000000-0000-4000-8000-000000000412','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000224','Pending','2026-06-04T17:00:00Z',66,array['Python','React'],array['Research depth','NLP'],'Promising early-stage candidate.'),
    ('00000000-0000-4000-8000-000000000413','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000211','Accepted','2026-06-01T18:00:00Z',91,array['Scikit-learn','Fairness Metrics','SQL'],array[]::text[],'Excellent fit for student-success modeling and fairness review.'),
    ('00000000-0000-4000-8000-000000000414','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000202','Interview','2026-06-02T18:00:00Z',92,array['SQL','Tableau','Python'],array['formal fairness methods'],'Strong business analytics portfolio.'),
    ('00000000-0000-4000-8000-000000000415','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000218','Pending','2026-06-03T18:00:00Z',74,array['R','Visualization'],array['research experience'],'Good foundation, may need close onboarding.'),
    ('00000000-0000-4000-8000-000000000416','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000222','Rejected','2026-06-04T18:00:00Z',68,array['SQL','Tableau'],array['ML depth'],'Useful domain interest but not enough modeling depth yet.'),
    ('00000000-0000-4000-8000-000000000417','00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000221','Accepted','2026-06-01T19:00:00Z',92,array['Time Series','Econometrics','Python'],array[]::text[],'Strongest market-risk applicant.'),
    ('00000000-0000-4000-8000-000000000418','00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000209','Shortlisted','2026-06-02T19:00:00Z',87,array['Economics','R','Regression'],array['market microstructure'],'Strong behavioral economics overlap.'),
    ('00000000-0000-4000-8000-000000000419','00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000214','Pending','2026-06-03T19:00:00Z',79,array['Time Series','Tableau'],array['econometrics depth'],'Dashboard experience is valuable; methods may need ramp.'),
    ('00000000-0000-4000-8000-000000000420','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000216','Accepted','2026-06-01T20:00:00Z',93,array['PyTorch','OpenCV','Medical Imaging'],array[]::text[],'Excellent computer-vision evidence.'),
    ('00000000-0000-4000-8000-000000000421','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000207','Interview','2026-06-02T20:00:00Z',81,array['ImageJ','CellProfiler','Python'],array['deep learning'],'Strong domain support for imaging datasets.'),
    ('00000000-0000-4000-8000-000000000422','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000223','Shortlisted','2026-06-03T20:00:00Z',77,array['Clinical Labels','R'],array['PyTorch'],'Biomedical fit, moderate technical depth.'),
    ('00000000-0000-4000-8000-000000000423','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000219','Accepted','2026-06-01T21:00:00Z',90,array['User Research','Study Design','Statistics'],array[]::text[],'Best HCI/education research fit.'),
    ('00000000-0000-4000-8000-000000000424','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000206','Interview','2026-06-02T21:00:00Z',86,array['Qualtrics','Thematic Coding','Python'],array['AI tutor logs'],'Strong study-ops experience.'),
    ('00000000-0000-4000-8000-000000000425','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000224','Pending','2026-06-03T21:00:00Z',66,array['Python','React'],array['research methods'],'Could help prototype with mentoring.'),
    ('00000000-0000-4000-8000-000000000426','00000000-0000-4000-8000-000000000308','00000000-0000-4000-8000-000000000205','Accepted','2026-06-01T22:00:00Z',88,array['GIS','Causal Inference','Policy Writing'],array[]::text[],'Strong policy/data blend.'),
    ('00000000-0000-4000-8000-000000000427','00000000-0000-4000-8000-000000000308','00000000-0000-4000-8000-000000000213','Shortlisted','2026-06-02T22:00:00Z',82,array['Climate Analytics','Data Cleaning'],array['causal inference'],'Good climate policy context.'),
    ('00000000-0000-4000-8000-000000000428','00000000-0000-4000-8000-000000000308','00000000-0000-4000-8000-000000000225','Pending','2026-06-03T22:00:00Z',72,array['Policy Writing','R'],array['GIS'],'Good writing signal; technical depth still developing.'),
    ('00000000-0000-4000-8000-000000000429','00000000-0000-4000-8000-000000000309','00000000-0000-4000-8000-000000000215','Accepted','2026-06-01T23:00:00Z',85,array['Survey Design','R','Thematic Coding'],array[]::text[],'Strong behavioral methods match.'),
    ('00000000-0000-4000-8000-000000000430','00000000-0000-4000-8000-000000000309','00000000-0000-4000-8000-000000000209','Interview','2026-06-02T23:00:00Z',87,array['Economics','Regression','Research Writing'],array['survey ops'],'Strong decision-making theory fit.'),
    ('00000000-0000-4000-8000-000000000431','00000000-0000-4000-8000-000000000309','00000000-0000-4000-8000-000000000225','Pending','2026-06-03T23:00:00Z',72,array['Survey Design','Policy Writing'],array['statistics depth'],'Good policy framing, lighter quantitative evidence.'),
    ('00000000-0000-4000-8000-000000000432','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000212','Accepted','2026-06-02T00:00:00Z',94,array['EEG','MATLAB','Signal Processing'],array[]::text[],'Excellent BCI signal-processing fit.'),
    ('00000000-0000-4000-8000-000000000433','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000204','Shortlisted','2026-06-03T00:00:00Z',84,array['MATLAB','Signal Processing','Python'],array['EEG'],'Strong ECE fit for signal pipeline work.'),
    ('00000000-0000-4000-8000-000000000434','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000223','Pending','2026-06-04T00:00:00Z',70,array['Clinical Data','R'],array['DSP'],'Domain motivation, but signal processing gap.'),
    ('00000000-0000-4000-8000-000000000435','00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000204','Accepted','2026-06-02T01:00:00Z',84,array['C','TensorFlow Lite','Linux'],array[]::text[],'Good embedded AI match.'),
    ('00000000-0000-4000-8000-000000000436','00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000212','Interview','2026-06-03T01:00:00Z',83,array['Signal Processing','Python'],array['edge deployment'],'Strong signal skill; ask about embedded constraints.'),
    ('00000000-0000-4000-8000-000000000437','00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000208','Pending','2026-06-04T01:00:00Z',71,array['Arduino','Controls'],array['ML deployment'],'Hands-on prototyping, needs ML ramp.'),
    ('00000000-0000-4000-8000-000000000438','00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000201','Shortlisted','2026-06-02T02:00:00Z',91,array['OpenCV','ROS','PyTorch'],array['3D geometry'],'Strong robotics perception overlap.'),
    ('00000000-0000-4000-8000-000000000439','00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000220','Accepted','2026-06-03T02:00:00Z',88,array['Planning','C++','Simulation'],array[]::text[],'Strong planning and simulation profile.'),
    ('00000000-0000-4000-8000-000000000440','00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000208','Pending','2026-06-04T02:00:00Z',76,array['Controls','CAD','Python'],array['perception'],'Useful hardware instincts, perception gap remains.')
)
insert into public.applications (
  id, project_id, student_id, answers, quick_note, resume, status, submitted_at, student_snapshot
)
select
  a.id,
  a.project_id,
  a.student_id,
  jsonb_build_object(
    'statementOfInterest', a.note,
    'relevantExperience', s.resume_text,
    'matchedSkills', a.matched_skills,
    'missingSkills', a.missing_skills,
    'confidenceScore', a.confidence,
    'sourceTags', coalesce(s.metadata -> 'sourceTags', '[]'::jsonb),
    'professorNotes', case when a.status <> 'Pending' then a.note else null end
  ),
  'I am excited to contribute to ' || p.title || '. ' || a.note,
  s.resume,
  a.status,
  a.submitted_at,
  jsonb_build_object(
    'name', pr.full_name,
    'email', pr.email,
    'major', s.major,
    'coursework', s.coursework,
    'confidenceScore', a.confidence,
    'matchedSkills', a.matched_skills,
    'missingSkills', a.missing_skills,
    'sourceTags', coalesce(s.metadata -> 'sourceTags', '[]'::jsonb)
  )
from application_seed a
join public.students s on s.id = a.student_id
join public.profiles pr on pr.id = a.student_id
join public.projects p on p.id = a.project_id
on conflict (project_id, student_id) do update set
  answers = excluded.answers,
  quick_note = excluded.quick_note,
  resume = excluded.resume,
  status = excluded.status,
  submitted_at = excluded.submitted_at,
  student_snapshot = excluded.student_snapshot,
  updated_at = now();

with app_scores as (
  select
    student_id,
    project_id,
    (answers ->> 'confidenceScore')::integer as confidence,
    answers -> 'matchedSkills' as matched_skills,
    answers -> 'missingSkills' as missing_skills
  from public.applications
  where id between '00000000-0000-4000-8000-000000000401'::uuid and '00000000-0000-4000-8000-000000000440'::uuid
)
insert into public.recommendations (
  student_id, project_id, confidence, recommendation, reason, score_breakdown,
  qualifications, fit_reasoning, gaps, requirement_assessments, evidence_sources, source
)
select
  student_id,
  project_id,
  confidence,
  case when confidence >= 88 then 'Strong match' when confidence >= 76 then 'Good match with focused onboarding' else 'Possible stretch match' end,
  'Seeded demo recommendation generated from profile skills, evidence coverage, coursework, and application narrative.',
  jsonb_build_object('skills', least(confidence + 2, 100), 'coursework', confidence - 4, 'evidence', confidence - 2, 'interestAlignment', confidence),
  matched_skills,
  jsonb_build_array('Matched application skills and profile evidence support the project requirements.'),
  missing_skills,
  jsonb_build_array(jsonb_build_object('requirement','Core technical fit','status',case when confidence >= 88 then 'met' when confidence >= 76 then 'partial' else 'missing' end)),
  jsonb_build_object('sourceTags', jsonb_build_array('resume','github','coursework','application')),
  'demo_seed'
from app_scores
on conflict (student_id, project_id) do update set
  confidence = excluded.confidence,
  recommendation = excluded.recommendation,
  reason = excluded.reason,
  score_breakdown = excluded.score_breakdown,
  qualifications = excluded.qualifications,
  fit_reasoning = excluded.fit_reasoning,
  gaps = excluded.gaps,
  requirement_assessments = excluded.requirement_assessments,
  evidence_sources = excluded.evidence_sources,
  source = excluded.source,
  updated_at = now();

insert into public.progress_reports (
  id, project_id, student_id, professor_id, reporting_period, hours_worked,
  tasks_completed, results_achieved, challenges, next_steps, skills_used,
  evidence_links, status, professor_comment, reviewed_at, created_at
)
values
  ('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000217','00000000-0000-4000-8000-000000000101','Week of Feb 2, 2026',12,'Completed literature review on calibration and explanation fidelity for clinical risk models.','Produced a 9-page synthesis memo and model-audit checklist.','Clinical papers reported incompatible outcome definitions.','Finalize dataset schema and baseline audit notebook.',array['Literature Review','Calibration','Research Writing'],'[]'::jsonb,'approved','Excellent synthesis. The checklist is ready for the lab repository.','2026-02-09T18:00:00Z','2026-02-07T18:00:00Z'),
  ('00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000217','00000000-0000-4000-8000-000000000101','Week of Feb 9, 2026',14,'Cleaned de-identified model outputs and trained baseline calibration curves.','Reduced calibration error by 11 percent after isotonic regression.','Some subgroups had small sample sizes.','Run subgroup robustness checks.',array['Python','PyTorch','Calibration'],'[]'::jsonb,'approved','Strong progress and clear documentation of subgroup limits.','2026-02-16T18:00:00Z','2026-02-14T18:00:00Z'),
  ('00000000-0000-4000-8000-000000000503','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000102','Week of Feb 2, 2026',11,'Implemented dynamic-obstacle scenarios in the ROS simulation harness.','Added 18 repeatable scenes and baseline planner metrics.','Planner logs were inconsistent across seeded runs.','Stabilize random seeds and add CI validation.',array['ROS','Python','Simulation'],'[]'::jsonb,'approved','Simulation scenarios are useful and well scoped.','2026-02-09T19:00:00Z','2026-02-07T19:00:00Z'),
  ('00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000102','Week of Feb 9, 2026',13,'Compared A* and DWA baselines under pedestrian crossing patterns.','Found DWA safer in dense scenes but slower in narrow corridors.','Collision-risk metric needed review.','Prepare plots for lab meeting.',array['C++','Planning','Data Visualization'],'[]'::jsonb,'pending_approval',null,null,'2026-02-14T19:00:00Z'),
  ('00000000-0000-4000-8000-000000000505','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000103','Week of Feb 2, 2026',10,'Built retrieval baseline for literature review assistant using paper abstracts and citation metadata.','Top-10 retrieval precision reached 0.74 on seed benchmark.','Citation graph ingest missed workshop papers.','Add full-text chunks and rerankers.',array['Information Retrieval','Python','Evaluation'],'[]'::jsonb,'approved','Good benchmark framing; proceed to reranking.','2026-02-09T20:00:00Z','2026-02-07T20:00:00Z'),
  ('00000000-0000-4000-8000-000000000506','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000103','Week of Feb 9, 2026',9,'Implemented summary quality rubric and annotated 30 generated summaries.','Identified hallucinated method details in 5 examples.','Annotation guidelines need tighter examples.','Recruit two more annotators and calculate agreement.',array['LLM Evaluation','Research Methods','Python'],'[]'::jsonb,'approved','The rubric is strong; add agreement statistics next.','2026-02-16T20:00:00Z','2026-02-14T20:00:00Z'),
  ('00000000-0000-4000-8000-000000000507','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000105','Week of Feb 2, 2026',8,'Cleaned advising records and documented missingness patterns.','Built reproducible feature dictionary and leakage-risk notes.','Several fields changed meaning across semesters.','Meet with advising office to validate fields.',array['SQL','Data Cleaning','Fairness Metrics'],'[]'::jsonb,'approved','Great attention to leakage risk.','2026-02-09T21:00:00Z','2026-02-07T21:00:00Z'),
  ('00000000-0000-4000-8000-000000000508','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000105','Week of Feb 9, 2026',10,'Trained logistic regression and gradient boosting baselines for support outreach prediction.','Baseline AUC reached 0.78 with interpretable top features.','Model performance varied by cohort.','Run subgroup calibration and draft dashboard wireframe.',array['Scikit-learn','Statistics','Dashboarding'],'[]'::jsonb,'pending_approval',null,null,'2026-02-14T21:00:00Z'),
  ('00000000-0000-4000-8000-000000000509','00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000105','Week of Feb 2, 2026',11,'Prepared market-return dataset and implemented historical VaR baseline.','Produced reproducible notebook with volatility clustering diagnostics.','Data vendor symbols changed for several ETFs.','Add macro factors and compare expected shortfall.',array['Python','Time Series','Econometrics'],'[]'::jsonb,'approved','Solid baseline with clear assumptions.','2026-02-09T22:00:00Z','2026-02-07T22:00:00Z'),
  ('00000000-0000-4000-8000-000000000510','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000216','00000000-0000-4000-8000-000000000104','Week of Feb 2, 2026',12,'Implemented U-Net baseline and preprocessing transforms for imaging dataset.','Initial Dice score reached 0.71 on validation split.','Augmentation pipeline distorted some labels.','Fix mask transforms and run ablations.',array['PyTorch','OpenCV','Medical Imaging'],'[]'::jsonb,'approved','Good baseline; check augmentation carefully.','2026-02-09T23:00:00Z','2026-02-07T23:00:00Z'),
  ('00000000-0000-4000-8000-000000000511','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000216','00000000-0000-4000-8000-000000000104','Week of Feb 9, 2026',9,'Analyzed failure cases by scanner source and image quality flags.','Found performance drop on low-contrast images and drafted mitigation plan.','Metadata is incomplete for one scanner site.','Request metadata clarification and test contrast normalization.',array['Error Analysis','Research Writing','Python'],'[]'::jsonb,'pending_approval',null,null,'2026-02-14T23:00:00Z'),
  ('00000000-0000-4000-8000-000000000512','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000219','00000000-0000-4000-8000-000000000103','Week of Feb 2, 2026',7,'Drafted user-study protocol for AI hint timing and pilot-tested task flow.','Pilot found confusing hint timing labels and two logging bugs.','Recruitment screener was too broad.','Revise screener and instrumentation.',array['Study Design','User Research','Python'],'[]'::jsonb,'approved','Thoughtful pilot; please tighten recruitment criteria.','2026-02-09T16:00:00Z','2026-02-07T16:00:00Z'),
  ('00000000-0000-4000-8000-000000000513','00000000-0000-4000-8000-000000000308','00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-000000000107','Week of Feb 2, 2026',10,'Merged municipal climate policy records with census energy-burden variables.','Created county-level panel with reproducible cleaning scripts.','Policy start dates conflict across sources.','Prepare validation memo for data-source decisions.',array['R','GIS','Policy Analysis'],'[]'::jsonb,'approved','Strong data provenance work.','2026-02-09T17:00:00Z','2026-02-07T17:00:00Z'),
  ('00000000-0000-4000-8000-000000000514','00000000-0000-4000-8000-000000000308','00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-000000000107','Week of Feb 9, 2026',8,'Estimated difference-in-differences models for pilot cities.','Preliminary effects show larger reductions in high-burden neighborhoods.','Parallel trends need clearer visualization.','Create diagnostic plots and sensitivity checks.',array['Causal Inference','R','Visualization'],'[]'::jsonb,'pending_approval',null,null,'2026-02-14T17:00:00Z'),
  ('00000000-0000-4000-8000-000000000515','00000000-0000-4000-8000-000000000309','00000000-0000-4000-8000-000000000215','00000000-0000-4000-8000-000000000108','Week of Feb 2, 2026',6,'Coded open-ended survey responses for decision-making study.','Reached 0.82 inter-rater agreement after codebook revision.','Ambiguous confidence categories remained.','Run final adjudication session.',array['Survey Design','Thematic Coding','R'],'[]'::jsonb,'approved','Codebook is much clearer now.','2026-02-09T15:00:00Z','2026-02-07T15:00:00Z'),
  ('00000000-0000-4000-8000-000000000516','00000000-0000-4000-8000-000000000309','00000000-0000-4000-8000-000000000215','00000000-0000-4000-8000-000000000108','Week of Feb 9, 2026',5,'Prepared poster draft and summarized logistic regression results for choice task.','Poster includes methods, participant flow, and preliminary findings.','Need cleaner explanation of interaction term.','Revise poster narrative for symposium review.',array['Research Writing','R','Presentation'],'[]'::jsonb,'rejected','Please revise the interaction-term explanation before this is approved.','2026-02-16T15:00:00Z','2026-02-14T15:00:00Z'),
  ('00000000-0000-4000-8000-000000000517','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000106','Week of Feb 2, 2026',13,'Implemented EEG preprocessing filters and artifact-rejection notebook.','Improved signal quality checks and reduced noisy epochs by 18 percent.','Some participants have missing channel metadata.','Test classifier with cleaned features.',array['MATLAB','EEG','Signal Processing'],'[]'::jsonb,'approved','Excellent preprocessing evidence.','2026-02-09T13:00:00Z','2026-02-07T13:00:00Z'),
  ('00000000-0000-4000-8000-000000000518','00000000-0000-4000-8000-000000000310','00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000106','Week of Feb 9, 2026',12,'Trained motor-imagery classifiers and compared feature windows.','Best model reached 79 percent balanced accuracy.','Model variance is high across participants.','Run subject-level cross-validation and draft results table.',array['Python','Scikit-learn','Signal Processing'],'[]'::jsonb,'pending_approval',null,null,'2026-02-14T13:00:00Z'),
  ('00000000-0000-4000-8000-000000000519','00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000106','Week of Feb 2, 2026',9,'Profiled TensorFlow Lite activity-recognition model on target hardware.','Measured latency and memory footprint across three quantization settings.','Power meter sampling was noisy.','Repeat power experiments and record demo video.',array['C','TensorFlow Lite','Linux'],'[]'::jsonb,'approved','Good measurement discipline.','2026-02-09T12:00:00Z','2026-02-07T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000520','00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000220','00000000-0000-4000-8000-000000000102','Week of Feb 2, 2026',10,'Implemented grasp-ranking features for cluttered tabletop simulation.','Raised simulated grasp success from 61 percent to 68 percent.','Scene generator overrepresents simple object shapes.','Add harder clutter distributions and prepare demo clip.',array['C++','Simulation','3D Geometry'],'[]'::jsonb,'approved','Nice measurable improvement; add harder scenes next.','2026-02-09T11:00:00Z','2026-02-07T11:00:00Z')
on conflict (id) do update set
  project_id = excluded.project_id,
  student_id = excluded.student_id,
  professor_id = excluded.professor_id,
  reporting_period = excluded.reporting_period,
  hours_worked = excluded.hours_worked,
  tasks_completed = excluded.tasks_completed,
  results_achieved = excluded.results_achieved,
  challenges = excluded.challenges,
  next_steps = excluded.next_steps,
  skills_used = excluded.skills_used,
  evidence_links = excluded.evidence_links,
  status = excluded.status,
  professor_comment = excluded.professor_comment,
  reviewed_at = excluded.reviewed_at,
  updated_at = now();

delete from public.progress_report_evidence
where progress_report_id between '00000000-0000-4000-8000-000000000501'::uuid and '00000000-0000-4000-8000-000000000520'::uuid;

insert into public.progress_report_evidence (
  progress_report_id, type, title, description, external_url, file_url, file_path, file_name, file_type, file_size
)
select
  r.id,
  e.type,
  e.title,
  e.description,
  e.external_url,
  e.file_url,
  e.file_path,
  e.file_name,
  e.file_type,
  e.file_size
from public.progress_reports r
cross join lateral (
  values
    ('github_repo', r.reporting_period || ' project repository', 'Placeholder GitHub repository with scripts and experiment configs.', 'https://github.com/cmu-demo/' || lower(replace(r.project_id::text, '-', '')) || '-research', null, null, null, null, null::bigint),
    ('notebook', r.reporting_period || ' analysis notebook', 'Notebook or uploaded-file placeholder for the submitted research work.', null, 'https://cmu-demo.example.edu/files/' || r.id::text || '-analysis.ipynb', r.student_id::text || '/' || r.id::text || '/analysis.ipynb', 'analysis.ipynb', 'application/x-ipynb+json', 184320::bigint)
) as e(type, title, description, external_url, file_url, file_path, file_name, file_type, file_size)
where r.id between '00000000-0000-4000-8000-000000000501'::uuid and '00000000-0000-4000-8000-000000000520'::uuid;

notify pgrst, 'reload schema';

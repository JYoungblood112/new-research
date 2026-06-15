# Supabase Data Migration Plan

## Current Data Sources To Replace

- `src/app/contexts/DataContext.tsx`: hardcoded `MOCK_POSTINGS`, seeded applications, and `localStorage` persistence for `postings` and `applications`.
- `server/data/store.json`: file-backed users, student profiles, professor profiles, and postings used by the Express API.
- `server/store.js`, `server/index.js`, `server/profile.js`: API reads and writes to the JSON store instead of Supabase.
- `src/mockApi.ts` and `src/App.tsx`: older localStorage-backed project API surface.
- `src/app/mock/deanDashboard.ts`, `src/app/mock/recruiterDashboard.ts`, `src/app/mock/progressReports.ts`: dashboard mock data outside the first research-platform migration.
- `server/data/sessions.json` and `server/sessionStore.js`: file-backed sessions. This should move to Supabase Auth or secure server-side session storage in a separate auth pass.
- `src/app/components/student/WelcomeDialog.tsx`: localStorage onboarding completion flag.
- `src/app/pages/professor/ProfessorDashboard.tsx`: mock applicant rows and localStorage message-template preferences.

## Phase 1: Core Database And Query Layer

Implemented first:

- `profiles`
- `students`
- `professors`
- `projects`
- `applications`
- `skills`
- `student_skills`
- `project_skills`
- `recommendations`

This phase only adds schema, indexes, RLS policies, TypeScript row types, and Supabase query helpers. No UI is redirected yet.

## Phase 2: Read Projects From Supabase

- Replace `MOCK_POSTINGS` in `DataContext.tsx` with `listPublicProjects()`.
- Keep existing UI models by mapping Supabase `projects` rows to `ResearchPosting`.
- Use `project_skills` for required and preferred skill filtering.
- Preserve local fallback only for development when Supabase env vars are missing.

## Phase 3: Profiles And Setup

- Replace `server/data/store.json` profile writes in `/api/setup/student` and `/api/setup/professor`.
- Write `profiles` plus either `students` or `professors`.
- Store resume/transcript parsed data in `students.resume`, `students.transcript`, `students.resume_text`, and `students.transcript_text`.
- Keep file uploads out of the database; use Supabase Storage later for documents and images.

## Phase 4: Applications

- Replace `DataContext` application localStorage with `applications` table reads and writes.
- Students create and edit their own applications directly through RLS.
- Professor application status changes should use a secure server route or edge function because they are privileged workflow changes.

## Phase 5: Recommendations

- Store Ollama scoring output in `recommendations`.
- Read student-facing recommendations from `listMyRecommendations()`.
- Let professors read recommendation results for their own projects through RLS.
- Move background scoring writes to a secure server route if scores should be produced for users other than the current signed-in student.

## Phase 6: Remaining Mock Surfaces

- Move dean, recruiter, progress reports, onboarding flags, and professor message templates into their own tables after the core platform flow is stable.
- Replace `server/data/sessions.json` with Supabase Auth or another secure server-session store.

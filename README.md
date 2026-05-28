
  # CMU Research Matchmaking Website

  This project is a Handshake-style platform for CMU research matching with Student and Professor role flows.

  ## Current implementation status

  Phase 1 complete:
  - Role selection before authentication.
  - Stub CMU SSO backend that accepts CMU-format emails.
  - Authenticated session via secure HTTP-only cookie.
  - Setup gating per role:
    - Student setup required before submitting applications.
    - Professor setup required before creating postings.
  - Persistent reminder banners for incomplete setup.

  Phase 2+ (already partially present in UI, still being aligned to full spec):
  - Browse/search/apply flow.
  - Application tracking and professor review.
  - Multi-step posting workflow and feature-flagged approval.

  ## Tech stack in this repo

  - Frontend: React + Vite + Tailwind utilities and component library.
  - Backend: Node.js + Express (stub SSO and setup APIs).
  - Local storage for dev: JSON file store at server/data/store.json.

  ## Environment variables

  Copy .env.example to .env and adjust values.

  Required or commonly used vars:
  - VITE_API_BASE_URL
  - VITE_REQUIRE_PROJECT_APPROVAL
  - PORT
  - CLIENT_ORIGIN
  - CMU_SSO_ENTITY_ID
  - CMU_SSO_ENTRY_POINT
  - CMU_SSO_CERT
  - FEATURE_REQUIRE_PROJECT_APPROVAL
  - DATABASE_URL
  - S3_BUCKET
  - S3_REGION
  - S3_ACCESS_KEY_ID
  - S3_SECRET_ACCESS_KEY

  ## Install and run

  1. Install dependencies:
    npm install

  2. Seed local dev data:
    npm run seed

  3. Start backend:
    npm run dev:server

  4. Start frontend:
    npm run dev

  Or run both together:
    npm run dev:fullstack

  ## Dev stub SSO behavior

  - On the login page, users pick Student or Professor first.
  - The stub SSO endpoint validates an andrew.cmu.edu email.
  - A session cookie is set and used for authenticated API calls.

  ## API endpoints currently implemented

  - POST /api/auth/stub-sso
  - GET /api/auth/session
  - POST /api/auth/logout
  - PUT /api/setup/student
  - PUT /api/setup/professor
  - GET /api/health
  
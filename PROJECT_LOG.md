# RemoteFlow Project Log

## Project Overview
RemoteFlow is a remote job aggregation + tracking SaaS (B2C, freemium) for remote workers.

## Tech Stack
- Frontend/Backend: Next.js 14+ (App Router) on Vercel
- Database: Supabase Postgres
- Auth: Supabase Auth (email/password)
- Background Jobs: Vercel Cron (daily)
- Email: Stubbed for MVP

---

## 2026-01-02 - Initial MVP Implementation

### Files Created

#### Database Schema
- `supabase/migrations/001_initial_schema.sql` - Tables, indexes, triggers
- `supabase/migrations/002_rls_policies.sql` - Row Level Security

#### Supabase Clients
- `src/lib/supabase/client.ts` - Browser client
- `src/lib/supabase/server.ts` - Server + service role client
- `src/lib/supabase/middleware.ts` - Auth middleware

#### Types
- `src/types/index.ts` - TypeScript types for jobs, users, API

#### Job Ingestion
- `src/lib/ingestion/remotive.ts` - Remotive API fetcher
- `src/lib/ingestion/normalize.ts` - Data normalization
- `src/lib/ingestion/dedupe.ts` - Deduplication logic

#### API Routes
- `src/app/api/jobs/route.ts` - GET jobs with filters
- `src/app/api/jobs/[id]/route.ts` - GET single job
- `src/app/api/preferences/route.ts` - GET/PUT user preferences
- `src/app/api/saved-jobs/route.ts` - GET/POST saved jobs
- `src/app/api/saved-jobs/[job_id]/route.ts` - PATCH/DELETE saved jobs
- `src/app/api/cron/sync-jobs/route.ts` - Job sync cron endpoint

#### Auth Pages
- `src/app/(auth)/login/page.tsx` - Login form
- `src/app/(auth)/signup/page.tsx` - Signup form
- `src/app/(auth)/callback/route.ts` - OAuth callback

#### App Pages
- `src/app/(marketing)/page.tsx` - Landing page
- `src/app/(app)/jobs/page.tsx` - Job listings
- `src/app/(app)/saved/page.tsx` - Saved jobs
- `src/app/(app)/preferences/page.tsx` - User preferences

#### Components
- `src/components/ui/Button.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Card.tsx`
- `src/components/jobs/JobCard.tsx`
- `src/components/jobs/JobList.tsx`
- `src/components/jobs/JobFilters.tsx`
- `src/components/jobs/JobSearch.tsx`
- `src/components/layout/Header.tsx`

#### Config
- `vercel.json` - Cron configuration
- `.env.example` - Environment variables template
- `src/middleware.ts` - Route protection

### Next Steps
1. Set up Supabase project
2. Run migrations in Supabase SQL Editor
3. Configure environment variables
4. Deploy to Vercel
5. Trigger initial job sync

---

## MVP Checklist
- [x] Project structure created
- [x] Database schema defined
- [x] RLS policies defined
- [x] Auth flow implemented
- [x] Job ingestion system
- [x] API routes
- [x] Frontend pages
- [x] Supabase project setup (tzwvagdjmtxsxkyceqoj, us-west-2)
- [x] Database migrations run
- [x] First job sync (254 jobs from Remotive + Jobicy)
- [ ] Vercel domain configuration (see note below)

## Vercel Deployment Note
The Vercel deployment builds and deploys successfully, but the production domain
`remote-flow-xi.vercel.app` is returning 404. This is a Vercel project configuration
issue that needs to be fixed in the Vercel dashboard:

1. Go to Vercel Dashboard > Project Settings > Domains
2. Ensure the production domain is correctly aliased to the main branch
3. Or set up a new production domain

The app works correctly locally and the API returns 254+ jobs from the database.

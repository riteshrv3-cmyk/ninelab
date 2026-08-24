# ninelab — Complete App Documentation

> Last updated: May 2026  
> Version: Production (pnpm monorepo, 4 portals + API)

---

## Table of Contents

1. [What is ninelab?](#1-what-is-ninelab)
2. [Business Model](#2-business-model)
3. [System Architecture](#3-system-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Student App (ninelab)](#6-student-app-ninelab)
7. [Recruiter Portal](#7-recruiter-portal)
8. [TPO Portal (College)](#8-tpo-portal-college)
9. [Admin Panel](#9-admin-panel)
10. [API Server](#10-api-server)
11. [Database Schema](#11-database-schema)
12. [AI Integration](#12-ai-integration)
13. [Brand & Design System](#13-brand--design-system)
14. [Key Commands](#14-key-commands)
15. [Environment Variables](#15-environment-variables)
16. [Known Rules & Gotchas](#16-known-rules--gotchas)

---

## 1. What is ninelab?

ninelab is a **mobile-first AI career platform for Indian engineering students** — from their 1st year all the way to campus placement.

**For students:** It's a personal AI career companion. They build their profile, practice interviews, explore career paths, take AI-generated courses, earn verifiable certificates, and receive recruiter invites — all in one app.

**For recruiters:** It's a verified talent marketplace. They can browse candidates filtered by skill, CGPA, GitHub activity, and commitment score — and shortlist the best fits before a campus drive.

**For colleges (TPOs):** It's a placement management dashboard. They can see all their students' progress, announce placement drives, send invites to recruiters, and track placement activity.

**For platform admins:** It's a master control panel to monitor all students, recruiters, colleges, and jobs across the entire platform.

---

## 2. Business Model

| Customer | Role | Revenue |
|---|---|---|
| Recruiters | Pay to access verified talent pool + shortlist | Primary revenue |
| Colleges / TPOs | Institutional client — dashboard, drives, mentor hub | Potential SaaS subscription |
| Students | Free users — generate supply and data | Free (with Pro tier planned) |

**Core wedge:** Verified, explainable shortlist generation from real early-career signals (GitHub activity, AI interview scores, learning streaks) — not just resumes.

---

## 3. System Architecture

```
User (mobile browser)
        │
        ▼
   Shared Reverse Proxy (localhost:80)
        │
   ┌────┼────────────────────────┐
   │    │                        │
   ▼    ▼                        ▼
/       /recruiter-portal/   /tpo-portal/
Student API                  TPO Portal
App     Server               (College)
        /api
        │
        ▼
   PostgreSQL DB
        │
        ▼
   Anthropic AI (claude-haiku-4-5)
```

- All 4 frontend portals are separate React + Vite apps.
- One shared Express API server handles everything.
- Path-based routing: no ports needed from the browser — the proxy routes by URL path.
- Auth is localStorage-based (no session cookies / JWT). Student ID, recruiter info, TPO info stored locally.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Node.js | v24 |
| TypeScript | 5.9 |
| Frontend | React 19 + Vite 7 |
| Client Routing | wouter (lightweight, mobile-friendly) |
| UI Components | shadcn/ui + Tailwind CSS |
| Animations | Framer Motion |
| API Server | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| API Contract | OpenAPI spec → Orval codegen (React Query hooks + Zod schemas) |
| AI | Anthropic claude-haiku-4-5 via Replit AI Integration |
| Build (API) | esbuild |

---

## 5. Monorepo Structure

```
ninelab/
├── artifacts/
│   ├── ninelab/          ← Student app          (previewPath: /)
│   ├── api-server/          ← Express API           (previewPath: /api)
│   ├── recruiter-portal/    ← Recruiter marketplace (previewPath: /recruiter-portal/)
│   ├── tpo-portal/          ← College/TPO portal    (previewPath: /tpo-portal/)
│   ├── admin-panel/         ← Platform admin        (previewPath: /admin-panel/)
│   └── mockup-sandbox/      ← Canvas component preview (internal)
│
├── lib/
│   ├── api-spec/            ← OpenAPI YAML spec + Orval config
│   ├── api-zod/             ← Auto-generated Zod schemas (DO NOT EDIT)
│   ├── api-client-react/    ← Auto-generated React Query hooks (DO NOT EDIT)
│   ├── db/                  ← Drizzle ORM schema + DB client
│   └── integrations-anthropic-ai/ ← Anthropic AI client wrapper
│
├── scripts/                 ← Shared utility scripts
├── pnpm-workspace.yaml      ← Workspace catalog + package discovery
├── tsconfig.base.json       ← Shared strict TS defaults
├── tsconfig.json            ← Root solution file (libs only)
└── replit.md                ← Living project memory (always kept up to date)
```

---

## 6. Student App (ninelab)

**URL:** `/`  
**Auth:** Student ID stored in `localStorage` as `"studentId"`  
**Entry point:** If no studentId → Onboarding. If exists → Home.

### Pages & Routes

| Route | Page | What it does |
|---|---|---|
| `/` | Onboarding | WhatsApp-style 10-step chatbot. Collects: name, email, college, city, year, field, CGPA, dream company, GitHub/LinkedIn. Creates student in DB and saves ID to localStorage. |
| `/home` | Home Hub | Central dashboard. Shows AI score, streak, Points, profile strength. Category cards (Opportunities, Leaderboard, Resume, etc). Recruiter activity feed. |
| `/chat` | AI Chat | Full-screen conversational AI powered by Anthropic. Reads and updates student profile in real-time via SSE streaming. Understands bio, projects, certs, preferences, GitHub/LinkedIn. |
| `/practice` | Practice Hub | Entry point for mock interviews and the interview library. Lists available interview types. |
| `/practice/interview/:id` | Mock Interview | AI-driven 5-question interview. Per-question feedback. Overall score at the end. |
| `/practice/courses` | Course Library | Browse AI-generated courses by domain (20 × 5 tracks). Start without a job first. |
| `/opportunities` | Career Explorer | 3-level drill: Domain grid (12) → Sub-domain list (4 each) → Jobs/Internships/Freelancing cards. "Prepare" button launches AI course. |
| `/opportunities/course` | Course | Full Coursera-style AI course: 5 modules × 3 lessons, SM-2 flashcards, 5-question quiz. |
| `/certs/:slug` | Certificate | Public verify page for an earned certificate (QR code + skills covered). |
| `/profile` | Profile Editor | Strength ring, open-to-work toggle, GitHub/LinkedIn analyzer, bio, projects, certifications, salary & work preferences. |
| `/leaderboard` | Leaderboard | College tab + India tab. Ranked by overall score. |
| `/resume` | Resume Builder | AI-generated resume PDF from student profile data. |
| `/inbox` | Inbox | Recruiter invite inbox. Accept/Decline. Reveals recruiter email on accept. |
| `/dashboard` | — | Redirects to `/home` (backward compat) |

### Navigation Structure

**Bottom tab bar (3 items):** Home · AI Chat · Practice  
**Top bar:** Logo · Inbox icon (with unread badge) · Profile avatar (opens right sidebar)  
**Profile sidebar:** Shows strength score, stats, skills, counts. "Edit Full Profile" → `/profile`

### Opportunities Explorer (deep dive)

**12 Domains:**
Data & Analytics, UI/UX Design, Web Development, Mobile Dev, AI/ML, Cybersecurity, Cloud & DevOps, Blockchain, Game Dev, Embedded/IoT, QA & Testing, Product Management

Each domain has **4 sub-domains** = 48 total. All defined in:
`artifacts/ninelab/src/data/domains.ts`

### Course Page (deep dive)

Triggered by "Prepare" button. Sub-domain context passed via `sessionStorage["courseContext"]`.

**Loading screen:** Always shows 3-second live-generation animation (progress bar, rotating messages, checklist) regardless of cache state.

**3 Tabs:**

| Tab | What it shows |
|---|---|
| Course | Progress ring, 5 module accordion, 15 lessons with type/duration/details. "Watch on YouTube" links per lesson. "Mark Done" toggles. Progress saved in localStorage. |
| Flashcards | SM-2 spaced repetition. 12 AI cards. 3D flip animation. 4 rating buttons (Again/Hard/Good/Easy). Daily cap of 20 new cards. |
| Quiz | 5 MCQ questions (2 easy, 2 medium, 1 hard). Instant feedback + explanation. Retry option. |

**Caching:** `course_content_v2_<subDomainId>` in localStorage. Permanent until cleared.

**Background Preloader:** Runs silently 1.5s after Opportunities mounts. Pre-generates all 48 courses in batches of 4. Prevents re-generation delays. (`useCoursePreloader.ts`)

### Course Library (`/practice/courses`)

Students browse AI-generated courses by domain — **20 domains × 5 tracks** — without needing a job or opportunity first. Each course is **5 modules × 3 lessons** with curated free videos/reading and flashcards. Each module ends with a short quiz that unlocks the next module; after all modules, a **10-question final exam** is offered (**70% to pass**, unlimited retakes).

### Certificates (`/certs/:slug`)

Passing the final exam **and** a certificate mock interview (AI-scored, **60+ to pass**) earns a verifiable certificate. Each certificate has a public verify link at `/certs/:slug` with a QR code and the skills it covers, and is issued to **claimed (signed-in) accounts only**. A student may optionally add a certificate to their resume (off by default), and completing a course can add a confirmed skill to the profile once the student explicitly confirms it.

### Interview Library

Ready-made mock interviews for real companies, presented **role-first** and filterable, so a student can pick a target company/role and start in one tap. Lives in the Prep hub next to the AI mock interview launcher.

### Scoring System

| Score | What it means |
|---|---|
| overallScore | AI interview score |
| profileStrength | Completeness of profile (max 100) |
| commitmentScore | Engagement: `min(xp/25,40) + min(streak×3,30) + overallScore×0.3` |
| Points (XP) | Earned from completing quests, practice, etc. |
| Streak | Daily login/activity streak |
| Level | Based on XP thresholds |

---

## 7. Recruiter Portal

**URL:** `/recruiter-portal/`  
**Auth:** Recruiter info stored in `localStorage["recruiter"]` as JSON `{ id, name, company, email }`  
**Entry:** Unauthenticated → `/welcome` (Showcase). Authenticated → `/dashboard`

### Pages & Routes

| Route | Page | What it does |
|---|---|---|
| `/welcome` | Showcase | Public landing page for recruiters. Shows platform pitch, candidate stats, CTA to login. |
| `/login` | Login | Enter company name, your name, email. Creates/retrieves recruiter in DB. Saves to localStorage. |
| `/dashboard` | Dashboard | Overview: total candidates, shortlisted, active jobs, invites sent. Recent activity. |
| `/talent` | Talent Pool | Browse all students. Filters: search name/college, work mode, field, year, min CGPA, min profile strength. |
| `/student/:id` | Student Detail | Full candidate view: scores, GitHub stats, skills, projects, certifications, LinkedIn AI analysis, work preferences. |
| `/shortlist` | Shortlist | All shortlisted candidates. Remove or reveal email (after accept). CSV export. |
| `/post-job` | Post Job | Create a job listing with role, skills, location, salary, work mode. |
| `/job/:id` | Job Matches | AI-matched candidates for a specific job posting. |

---

## 8. TPO Portal (College)

**URL:** `/tpo-portal/`  
**Auth:** TPO info stored in `localStorage["tpo"]` as JSON. Unauthenticated → `/login`

### Pages & Routes

| Route | Page | What it does |
|---|---|---|
| `/login` | Login | TPO/college coordinator login |
| `/dashboard` | Dashboard | College-level stats: total students, placements, active drives, leaderboard position |
| `/students` | Students | All students from this college. View profile strength, scores, activity. |
| `/students/:id` | Student Profile | Individual student view for the TPO (same data as recruiter view) |
| `/leaderboard` | Leaderboard | College leaderboard vs other colleges |
| `/insights` | Insights | Analytics: placement trends, skill distribution, top performers |
| `/drives` | Drive Feed | Active and past placement drives (campus recruitment events) |
| `/announce` | Announce Drive | Post a new placement drive: company, date, eligibility, package |
| `/invite` | Invite Recruiter | Send email invites to recruiters to visit campus |
| `/activity` | Activity Feed | Real-time log of student actions, recruiter visits, invites |
| `/mentors` | Mentor Hub | Connect students with alumni mentors |

---

## 9. Admin Panel

**URL:** `/admin-panel/`  
**Auth:** None (internal tool — no login screen currently)

### Pages & Routes

| Route | Page | What it does |
|---|---|---|
| `/` | Overview | Platform-wide stats: total students, recruiters, colleges, jobs, invites |
| `/students` | Students | All students across all colleges. Search, filter, view profiles. |
| `/recruiters` | Recruiters | All registered recruiters. Company, contact, jobs posted, shortlists made. |
| `/colleges` | Colleges | All colleges on platform. Student count, placement rate, TPO details. |
| `/jobs` | Jobs | All job listings across all recruiters. Status, matches, applications. |
| `/invites` | Invites | All recruiter invites sent to students. Status (pending/accepted/declined). |
| `/drive-checks` | Drive Checks | Monitor placement drive attendance/check-in verification. |
| `/activity` | Activity Feed | Real-time platform activity log across all users. |

---

## 10. API Server

**Base URL:** `/api`  
**Framework:** Express 5  
**All routes registered in:** `artifacts/api-server/src/routes/index.ts`

### Health

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Server health check |

### Students

| Method | Route | Description |
|---|---|---|
| GET | `/api/students` | List all students |
| POST | `/api/students` | Create student (called during onboarding) |
| GET | `/api/students/:id/dashboard` | Dashboard data: XP, streak, quests, skills |
| GET | `/api/students/:id/wrapped` | Career Wrapped annual stats |

### Profile

| Method | Route | Description |
|---|---|---|
| GET | `/api/students/:id/full-profile` | Full enriched student profile (all fields) |
| PATCH | `/api/students/:id/profile` | Update bio, projects, certs, links, preferences |
| POST | `/api/students/:id/analyze-github` | Fetch GitHub API stats → compute profileStrength |
| POST | `/api/students/:id/analyze-linkedin` | AI analysis of LinkedIn URL (claude-haiku-4-5) |

### Quests

| Method | Route | Description |
|---|---|---|
| GET | `/api/quests` | All available quests |
| GET | `/api/students/:id/quests` | Student's quest progress |
| POST | `/api/students/:id/quests/:questId/complete` | Mark quest complete |

### Practice

| Method | Route | Description |
|---|---|---|
| POST | `/api/interview/sessions` | Create a new interview session |
| POST | `/api/interview/sessions/:id/question` | Get next AI question |
| PATCH | `/api/interview/sessions/:id/feedback` | Submit answer + get AI feedback |

### Jobs & Matches

| Method | Route | Description |
|---|---|---|
| GET | `/api/jobs` | All job listings |
| GET | `/api/students/:id/matches` | Student's matched jobs |
| POST | `/api/students/:id/matches/generate` | AI-generate job matches for student |

### Talent Pool (Recruiters)

| Method | Route | Description |
|---|---|---|
| GET | `/api/talent-pool` | All students with scores, GitHub stats (for recruiter browse) |

### Course (AI)

| Method | Route | Description |
|---|---|---|
| POST | `/api/course/generate` | Generate full course for a sub-domain |

The course endpoint makes **2 sequential AI calls** to stay within token limits:
- Call 1 → 5 modules × 3 lessons (type, duration, description, key points, YouTube search query) — `max_tokens: 4000`
- Call 2 → 12 flashcards + 5 quiz questions — `max_tokens: 3000`

### Opportunities

| Method | Route | Description |
|---|---|---|
| GET | `/api/opportunities` | Opportunity listings per sub-domain |

### Leaderboard

| Method | Route | Description |
|---|---|---|
| GET | `/api/leaderboard/india` | India-wide leaderboard |
| GET | `/api/leaderboard/college/:college` | College-specific leaderboard |

### AI Chat

| Method | Route | Description |
|---|---|---|
| GET | `/api/anthropic/conversations` | List conversations for a student |
| POST | `/api/anthropic/conversations` | Create new conversation |
| POST | `/api/anthropic/conversations/:id/messages` | Send message, stream AI reply (SSE) |

### Resume

| Method | Route | Description |
|---|---|---|
| POST | `/api/resume/generate` | Generate AI resume from student profile |

### Recruiter

| Method | Route | Description |
|---|---|---|
| POST | `/api/recruiters` | Register recruiter |
| GET | `/api/recruiters/:id` | Get recruiter profile |
| POST | `/api/recruiters/:id/shortlist` | Add candidate to shortlist |
| DELETE | `/api/recruiters/:id/shortlist/:studentId` | Remove from shortlist |
| GET | `/api/recruiters/:id/shortlist` | Get shortlisted candidates |
| POST | `/api/invites` | Send invite to student |
| GET | `/api/students/:id/invites` | Get student's recruiter invites |
| PATCH | `/api/invites/:id` | Accept/Decline invite |

### TPO

| Method | Route | Description |
|---|---|---|
| POST | `/api/tpo/auth` | TPO login |
| GET | `/api/tpo/:id/students` | All students for this college |
| POST | `/api/tpo/drives` | Announce placement drive |
| GET | `/api/tpo/drives` | List drives |

### Admin

| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/overview` | Platform-wide stats |
| GET | `/api/admin/students` | All students (admin view) |
| GET | `/api/admin/recruiters` | All recruiters |
| GET | `/api/admin/colleges` | All colleges |

### Activity Log

| Method | Route | Description |
|---|---|---|
| GET | `/api/activity` | Recent platform activity events |

---

## 11. Database Schema

**ORM:** Drizzle ORM  
**DB:** PostgreSQL  
**Schema file:** `lib/db/src/schema/`

### Table: `students`

| Column | Type | Description |
|---|---|---|
| id | serial (PK) | Auto-incrementing ID |
| name | text | Full name |
| email | text (unique) | Email address |
| college | text | College name |
| city | text | City |
| year | integer | Current year (1-4) |
| field | text | Branch (CSE, ECE, etc.) |
| photoUrl | text | Profile photo URL |
| githubUrl | text | GitHub profile URL |
| linkedinUrl | text | LinkedIn profile URL |
| portfolioUrl | text | Portfolio website URL |
| phone | text | Phone number |
| bio | text | Short bio |
| cgpa | text | CGPA (stored as text) |
| targetPackage | text | Target salary package |
| dreamCompany | text | Dream company |
| projects | jsonb | Array of project objects `[{title, description, tech, url}]` |
| certifications | jsonb | Array of cert objects `[{name, issuer, year, url}]` |
| openToWork | boolean | Currently looking for opportunities |
| workMode | text | "remote" / "hybrid" / "onsite" |
| preferredLocations | jsonb | Array of preferred cities |
| expectedSalary | text | Expected salary range |
| githubStats | jsonb | AI-fetched GitHub data (repos, stars, languages, contributions) |
| linkedinData | jsonb | AI-analyzed LinkedIn data |
| profileStrength | integer | Computed 0-100 completeness score |
| commitmentScore | integer | Engagement-based score |
| overallScore | integer | Combined AI interview score |
| xp | integer | Total Points earned |
| level | integer | Level based on XP |
| streakCount | integer | Current daily streak |
| lastActiveDate | text | Last activity date |
| skills | jsonb | Skill proficiency map `{ "React": 85 }` |
| isPro | boolean | Pro tier flag |
| collegeId | integer | FK to colleges table |
| createdAt | timestamp | Account creation time |

**profileStrength computation (max 100):**
- +10 GitHub URL present
- +15 LinkedIn URL present
- +5 Portfolio URL present
- +5 Phone present
- +10 Bio present
- +20 At least 1 project
- +5 At least 3 projects
- +10 At least 1 certification
- +5 Preferred locations set
- +5 Expected salary set
- +5 GitHub stats analyzed
- +5 LinkedIn data analyzed

**commitmentScore computation:**
```
min(xp / 25, 40) + min(streakCount × 3, 30) + overallScore × 0.3
```

### Other Tables

| Table | Purpose |
|---|---|
| `quests` | Available quests/tasks with XP rewards |
| `student_quests` | Which student completed which quest |
| `jobs` | Recruiter job listings |
| `matches` | AI-matched student ↔ job pairs |
| `interview_sessions` | Mock interview session state |
| `conversations` | AI chat conversation threads |
| `messages` | Individual messages in conversations |
| `recruiters` | Recruiter accounts |
| `shortlists` | Recruiter ↔ student shortlist pairs |
| `invites` | Recruiter invites to students |
| `tpo_users` | College TPO accounts |
| `drives` | Placement drive announcements |
| `colleges` | College directory |
| `activity_logs` | Platform activity event log |

---

## 12. AI Integration

**Model:** `claude-haiku-4-5` (Anthropic)  
**Access:** Via Replit AI Integration proxy (no manual API key needed)  
**Env vars (auto-set by Replit):**  
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`

### AI Features

| Feature | How it works |
|---|---|
| AI Chat (`/chat`) | SSE streaming conversation. System prompt contains full student profile context. Can update profile fields in real time through tool calls / structured responses. |
| Mock Interview | Generates 5 role-specific questions. Evaluates each answer with score + detailed feedback. |
| Course Generation | 2-call strategy: Call 1 = modules + lessons (max_tokens 4000), Call 2 = flashcards + quiz (max_tokens 3000). |
| GitHub Analyzer | Fetches real GitHub API data. Computes repo count, stars, top languages, contribution activity. |
| LinkedIn Analyzer | Sends URL to claude-haiku-4-5, extracts skills, experience, education summary. |
| Resume Builder | AI generates structured resume from profile data. |
| Job Matches | AI matches student profile to available jobs by skill + preference alignment. |

---

## 13. Brand & Design System

### Logo
Lightning bolt (Lucide `Zap` icon) on orange rounded square — `bg-[#f97316]`, white icon fill. Same favicon across all 4 portals.

### Typography
**Plus Jakarta Sans** — weights 400/500/600/700/800. Loaded via both `index.html` `<link>` AND `index.css` `@import`. No Inter anywhere.

### Color Tokens (Light Portals: Student, Recruiter, TPO)

| Token | Hex | Use |
|---|---|---|
| `--background` | `#f8fafc` | Page background |
| `--foreground` | `#0f172a` | Primary text |
| `--primary` | `#4f46e5` | Buttons, links, active states |
| `--secondary` | `#0ea5e9` | Sky blue highlights |
| `--accent` | `#f59e0b` | Amber — Points, achievements |
| `--brand` | `#f97316` | **Orange — logo, brand CTAs** |
| `--success` | `#10b981` | Green |
| `--destructive` | `#ef4444` | Red / errors |
| `--radius` | `0.75rem` | All border radii |

**Admin Panel** uses a dark variant of the same hues.

---

## 14. Key Commands

```bash
# Full TypeScript check across all packages
pnpm run typecheck

# Regenerate React Query hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to PostgreSQL
pnpm --filter @workspace/db run push

# Restart a specific portal (never run pnpm dev at root)
# Use restart_workflow in the Replit agent instead
```

---

## 15. Environment Variables

| Variable | Source | Use |
|---|---|---|
| `DATABASE_URL` | Replit (auto) | PostgreSQL connection string |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit AI Integration (auto) | Anthropic proxy base URL |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Replit AI Integration (auto) | Anthropic API key |
| `SESSION_SECRET` | Replit Secret | Express session signing |
| `GEMINI_API_KEY` | Replit Secret | Gemini (secondary AI, optional) |
| `GROQ_API_KEY` | Replit Secret | Groq (optional fast inference) |
| `PORT` | Replit (per artifact) | Dev server port (each artifact reads this) |

---

## 16. Known Rules & Gotchas

1. **Never run `pnpm dev` at workspace root.** Each portal has its own workflow. Use `restart_workflow` to restart a specific portal.

2. **`lib/api-zod/src/index.ts`** must only contain `export * from "./generated/api"` — Orval overwrites everything else on codegen.

3. **Student ID** is stored in `localStorage["studentId"]` — all API calls from the student app use this. No server-side session.

4. **Language rule:** Use "Points ⭐" not "XP". Use "Today's Goal" not "Today's Quest". Streak and Level are fine as-is.

5. **Vite dev server** must have `server.allowedHosts: true` — the preview is rendered in a proxied iframe, so requests come from a different origin.

6. **DB table names** in code: `conversations` and `messages` (plain names, not `conversationsTable` / `messagesTable`).

7. **Proxy routing** is most-specific-first — `/api` won't conflict with `/`.

8. **Orval codegen** must be re-run after any OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`

9. **Course cache key** is `course_content_v2_<subDomainId>`. Old `course_content_<id>` keys (no `v2`) are ignored.

10. **Background preloader** runs once per session (module-level singleton). Status tracked in `localStorage["course_preload_status"]`.

11. **Theme color** meta tag: `#F97316` for student/recruiter/TPO portals, `#0F172A` for admin panel.

---

*End of Documentation*

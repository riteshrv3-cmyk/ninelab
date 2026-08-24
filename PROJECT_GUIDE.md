# ninelab — Project Guide

An AI career companion for India's engineering students. Students pick a goal, get
a daily plan built from their real progress, practice interviews with an AI, check
whether a placement message is a scam, and track every job they apply to.

**Live:** https://ninelab-production-8b96.up.railway.app
**Repo:** https://github.com/riteshrv3-cmyk/ninelab-platform

> Accurate as of commit `e4f893c` (27 Jul 2026). Older docs in this repo
> (`DOCUMENTATION.md`, `NINELAB_DOCS.md`, `replit.md`, parts of `README.md`)
> predate the Phase 4 rebuild and describe removed features — prefer this file.

---

## 1. What it does

The product is built around one idea: **the app should tell the student what to do
today**, and every suggestion should come from something real they did.

| Feature | What it is |
|---|---|
| **Daily checklist** | 3–5 tasks generated server-side each morning from real signals (no completed mock yet → "take your first mock"; weakest skill → targeted practice). Exactly one task is "hot". Streak is computed from actual completions. |
| **AI mock interviews** | Voice interviewer (speaks questions, transcribes spoken answers) with camera self-view, then a scored report: communication, technical depth, confidence. |
| **Interview library** | Ready-made mock interviews for real companies, role-first and filterable, startable in one tap from the Prep hub. |
| **Pipeline (paste-a-job)** | Paste any job post or placement message → scam verdict, eligibility gates, fit score, and suggested prep. Track each application through 6 statuses. |
| **Drive-Check** | Paste a forwarded WhatsApp placement message → flags placement scams and extracts the real drive details. Shareable result card. |
| **Opportunities** | 20 tech domains × 5 specialisations, each with a live feed of jobs / internships / freelance work aggregated from real job boards. |
| **AI courses** | Any specialisation generates a 5-module course: lessons, curated videos, spaced-repetition flashcards, quizzes. |
| **Course library** | Browse AI-generated courses by domain (20 domains × 5 tracks) at `/practice/courses` — no job needed first. Each course is 5 modules × 3 lessons; each module quiz unlocks the next, then a 10-question final exam (70% to pass, unlimited retakes). |
| **Certificates** | Pass the final exam *and* a certificate mock interview (AI-scored, 60+ to pass) to earn a verifiable certificate with a public verify link (`/certs/:slug`), QR code, and skills covered. Claimed accounts only; optional add-to-resume (off by default) and explicit skill-to-profile confirmation. |
| **Resume builder** | 3 ATS-oriented templates, AI generation tailored to a pasted JD, PDF export. |
| **Kit (AI chat)** | A career mentor that knows the student's actual profile, streamed live. |

**Auth model — "first mock free, then sign in."** A student can do onboarding and
their first mock interview as a *guest* (a real DB row keyed by a `guestToken`).
When they sign up with Clerk, that same row is adopted — never duplicated.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces, Node 24, TypeScript 5.9 |
| Frontend | React 19, Vite 7, Tailwind CSS 4, Wouter (routing), TanStack Query 5, Framer Motion |
| API | Express 5 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Auth | Clerk (`@clerk/express`) |
| AI | Anthropic `claude-sonnet-4-6` |
| Hosting | Railway (single Node service) |

**Single-origin deploy:** the Express server also serves the built React app, so
there is no CORS and `/api/*` just works. One service, one URL.

---

## 3. Repo layout

```
Career-Companion/
├── artifacts/
│   ├── ninelab/        # Student app (React) — the main product
│   ├── api-server/        # Express API (also serves the built frontend)
│   ├── recruiter-portal/  # Recruiter UI      ─┐
│   ├── tpo-portal/        # College TPO UI     ├─ not in active development
│   ├── admin-panel/       # Internal admin    ─┘
│   ├── pitch-deck/
│   └── mockup-sandbox/
├── lib/
│   ├── db/                # Drizzle schema + client (23 tables)
│   ├── api-spec/          # OpenAPI spec (stale — see note below)
│   ├── api-zod/           # Generated Zod schemas
│   ├── api-client-react/  # Generated React Query hooks
│   └── integrations-anthropic-ai/
├── dev.sh                 # Local launcher
└── railway.json           # Deploy config
```

> **Note on codegen:** `lib/api-spec` + the generated clients are an older
> pattern and are now **stale by design**. New endpoints ship without touching
> them — the frontend calls them through `src/lib/api/authFetch.ts` instead.
> Don't be surprised that the OpenAPI spec doesn't list recent routes.

---

## 4. Running it locally

**Prerequisites:** Node 24+, pnpm 10, and a Postgres database (Neon free tier is fine).

```bash
git clone https://github.com/riteshrv3-cmyk/ninelab-platform.git
cd ninelab-platform
pnpm install
cp .env.example .env     # then fill it in (see below)
pnpm --filter @workspace/db run push    # create the tables
bash dev.sh
```

- Frontend → http://localhost:5000
- API → http://localhost:3001 (health check: `/api/healthz`)

### Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | yes | neon.tech → create project → connection string |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | yes | console.anthropic.com → API keys |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | yes | `https://api.anthropic.com` |
| `CLERK_PUBLISHABLE_KEY` | yes | dashboard.clerk.com → API keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | **same value** as above (Vite only exposes `VITE_*`) |
| `CLERK_SECRET_KEY` | yes | dashboard.clerk.com → API keys |
| `ADMIN_API_TOKEN` | yes | any random string locally |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | optional | developer.adzuna.com — turns on real **India-based** job listings. Without it the feed still works (remote boards + search links). |

### Useful commands

```bash
pnpm run typecheck                       # whole monorepo
pnpm --filter @workspace/db run push     # apply schema changes (push-only, no migrations)
pnpm run build:deploy                    # production build (frontend + API bundled)
```

> **Local gotcha:** `dev.sh` builds the API once and runs the bundle — there is
> **no watch mode**. After changing anything in `artifacts/api-server`, restart
> `dev.sh`, or you'll be testing stale code. The Vite frontend *does* hot-reload.

---

## 5. Architecture notes worth knowing

These are the non-obvious things that bite you.

**Routers mount flat.** Every router in `routes/index.ts` is mounted with
`router.use(xRouter)` at the app root, with no prefix. So an unscoped
`router.use(middleware)` inside any router file intercepts **every request that
reaches later-mounted routers**, not just its own. This once took the whole app
down. Always scope: `router.use("/admin", requireAdmin)`.

**Ownership is enforced, not assumed.** `middlewares/studentAuth.ts` exports
`requireStudent()` — it resolves the target student id from the URL/body and
verifies the caller owns it, via either a Clerk session (`clerkUserId` match) or
a guest token. A claimed row can never be driven anonymously.

**Rate limiting keys on the auth subject** (Clerk user id → hashed guest token →
IP), never a client-supplied id, so it can't be evaded by changing a body field.

**`contextPack(studentId)`** (`lib/contextPack.ts`) assembles the student's real
state — goal, scores, trend, weakest/strongest skills, streak, active course,
pipeline, last 7 days — and injects it into every AI prompt, wrapped in a
prompt-injection guard. It's why Kit and the interviewers feel personalised.

**The LLM is never trusted for rules.** Scam analysis and fit come back from one
AI call, but eligibility gates and verdicts are re-derived deterministically in
TypeScript afterwards.

**Daily tasks are deterministic.** Rules R1–R7 in `lib/dailyTasks.ts`, no LLM:
cap 5, floor 3, exactly one "hot" task. Kinds: `first_mock`, `practice`,
`course`, `jobs`, `invite`, `followup`, `drive_check`. Dates are IST.

**Design system.** `artifacts/ninelab/src/DESIGN_SYSTEM.md` is the spec —
indigo "Canopy" look: brand `#4a55c7`, canvas `#f4f5f7`, pill CTAs, soft-shadow
cards, canopy header + white sheet. Green is reserved for completed states, red
for errors/scams, orange for badges. All 17 screens follow it.

---

## 6. Key surfaces

**Student app routes** (`artifacts/ninelab/src/App.tsx`)

`/` welcome · `/onboarding` · `/home` daily checklist · `/practice` +
`/practice/interview/:id` + `/practice/courses` + `/practice/history` ·
`/opportunities` + `/opportunities/course` · `/certs/:slug` · `/pipeline` ·
`/drive-check` · `/resume` · `/profile` · `/chat` · `/inbox` · `/join/:code`

Bottom nav is 4 tabs: **Home · Prep · Jobs · Profile**, with Kit as a floating
bubble rather than a fifth tab.

**API** — 26 route modules under `artifacts/api-server/src/routes/`. Notable ones:
`auth.ts` (guest→Clerk claim), `dailyTasks.ts`, `pipeline.ts`, `interview.ts`,
`driveCheck.ts`, `opportunities.ts`, `resume.ts`, `course.ts`, `ai.ts`.

**Database** — 23 tables. Core: `students`, `daily_tasks`, `applications`,
`interview_sessions`, `student_resumes`, `drive_checks`,
`conversations`/`messages`, `ai_cache`. Plus recruiter/TPO/college tables for the
inactive portals.

**Opportunities feed** aggregates in parallel and interleaves:
- **Adzuna** (India, real on-site listings, INR salaries) — needs keys
- **Remotive** and **RemoteOK** (remote boards) — keyless
- Naukri / LinkedIn / Internshala / Upwork / Toptal / Fiverr search links as a floor

Everything passes a relevance gate (`isRelevant`) before display, because these
boards' own tags are unreliable — a "Business Development Manager" post ships
tagged `react, front end`.

---

## 7. Deploying

Railway builds from `railway.json` and auto-deploys on push to `main`:

```
build:  pnpm install --no-frozen-lockfile && pnpm run build:deploy
start:  node artifacts/api-server/dist/index.mjs
health: /api/healthz
```

Set the same environment variables in Railway → service → Variables. Because the
API serves the frontend, there is only one service to deploy.

---

## 8. Current state

**Working and deployed:** onboarding → goal → live opportunities, daily checklist
with honest streaks, guest→signed-in account claiming, mock interviews + scoring,
interview library, course library with module quizzes + final exams and
certificates, pipeline analyzer + tracking, drive-check, courses, resume builder,
Kit chat, and the full indigo design system across all 17 screens.

**Known gaps / next up:**
- Adzuna keys not yet set in production, so Indian on-site listings are still
  missing from the feed (remote roles and search links only).
- Niche specialisations (e.g. "Modern C++") have thin remote-board coverage and
  lean on the platform search links until Adzuna is on.
- Resume PDF export uses `html-to-image`; the `skipFonts` fix for cross-origin
  Google Fonts is shipped but hasn't been confirmed in a real browser.
- The recruiter, TPO, and admin portals exist in the repo but are intentionally
  out of scope — all current work is the student app.

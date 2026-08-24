# ninelab — AI Career Companion

## Overview

Full-stack AI career companion for Indian engineering students (1st year → placement). Built as a pnpm monorepo with React + Vite frontend, Express API server, PostgreSQL database, and Anthropic claude-haiku-4-5 AI integration.

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Node.js | v24 |
| TypeScript | 5.9 |
| Frontend | React + Vite (`artifacts/ninelab`) |
| API | Express 5 (`artifacts/api-server`) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| API Codegen | Orval (OpenAPI → React Query + Zod) |
| AI | Anthropic claude-haiku-4-5 (Replit AI Integration) |
| Routing | wouter (client-side, mobile-first) |
| Animations | Framer Motion |
| Styling | Tailwind CSS + shadcn/ui |
| API Build | esbuild |

---

## Monorepo Structure

```
artifacts/
  ninelab/          # React + Vite frontend (previewPath /)
  api-server/          # Express API server (previewPath /api)
  recruiter-portal/    # React + Vite recruiter marketplace (previewPath /recruiter-portal/)
  tpo-portal/          # React + Vite TPO portal (previewPath /tpo-portal/, port 21176)
  mockup-sandbox/      # Canvas/component preview server

lib/
  api-spec/            # OpenAPI spec + Orval codegen config
  api-zod/             # Generated Zod schemas
  api-client-react/    # Generated React Query hooks
  db/                  # Drizzle ORM schema + DB client
  integrations-anthropic-ai/   # Anthropic AI client

scripts/               # Shared utility scripts
```

---

## Brand & Design Tokens (unified across all 4 portals)

**Logo**: ⚡ lightning bolt (Lucide `Zap`) on rounded square — `bg-[#f97316]` (orange-500), white fill icon. Identical favicon.svg in all 4 `public/` folders.

**Typography**: `Plus Jakarta Sans` (weights 400/500/600/700/800) — loaded in both `index.html` `<link>` AND `index.css` `@import` for redundancy. NO Inter (removed across all portals).

**Tokens** (identical in `ninelab`, `recruiter-portal`, `tpo-portal` — light theme; `admin-panel` uses dark variant of same hues):

| Token | Light value | Hex | Use |
|---|---|---|---|
| `--background` | `210 40% 98%` | `#f8fafc` | Page bg |
| `--foreground` | `222 47% 11%` | `#0f172a` | Text primary |
| `--primary` | `239 76% 59%` | `#4f46e5` | UI primary, buttons, links |
| `--secondary` | `199 89% 48%` | `#0ea5e9` | Sky highlights |
| `--accent` | `38 92% 50%` | `#f59e0b` | Amber — XP, achievements |
| **`--brand`** | `21 90% 53%` | `#f97316` | **Orange — logo + brand CTAs** |
| `--success` | `160 84% 39%` | `#10b981` | Green |
| `--destructive` | `0 84% 60%` | `#ef4444` | Red |
| `--radius` | `0.75rem` | — | All portals (was 0.5/0.625/0.75 mixed) |

**HTML metadata**: All 4 `index.html` include `<meta name="theme-color">` (`#F97316` for light portals, `#0F172A` for admin) and SEO `<meta name="description">`.

---

## Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Onboarding | WhatsApp-style chatbot collecting student profile; redirects to `/home` if already signed in |
| `/dashboard` | — | Redirects to `/home` (backward compat) |
| `/home` | Home Hub | Score banner (AI score, streak, XP), category cards grid, recruiter activity feed, profile strength CTA |
| `/chat` | AI Chat | Full-screen conversational AI that reads and updates the student profile via chat (streaming SSE); supports bio, projects, certs, preferences, GitHub/LinkedIn |
| `/practice` | Prep | Mock interview launcher + interview library |
| `/practice/interview/:id` | Mock Interview | AI 5-question interview with per-question feedback and overall score |
| `/practice/courses` | Course Library | Browse AI-generated courses by domain (20 domains × 5 tracks); start without a job |
| `/certs/:slug` | Certificate | Public verify page for an earned certificate (QR + skills covered) |
| `/opportunities` | Opportunities | 12-domain career explorer (domain grid → sub-domain list → Jobs/Internship/Freelancing cards + Prepare button) |
| `/opportunities/course` | Course | Full Coursera-style AI course for the selected sub-domain |
| `/profile` | Profile | Rich profile editor — strength ring, open-to-work, GitHub/LinkedIn AI analyzer, bio, projects, certifications, work preferences |
| `/leaderboard` | Leaderboard | College + India tab ranking by overall score |
| `/resume` | Resume | AI-generated resume PDF builder |
| `/inbox` | Inbox | Recruiter invite inbox — Accept/Decline with recruiter email reveal |

---

## Navigation Architecture (3-tab)

**Bottom nav (3 items only):** Home · AI Chat · Practice

**Top bar (fixed):** ninelab logo · Inbox icon (with unread badge) · Profile avatar (opens sidebar)

**Profile Sidebar:** Slides in from the right. Shows profile strength, scores, stats, links, skills, project/cert counts. "Edit Full Profile" button navigates to `/profile`.

**Inbox:** Linked from top bar message icon, not in bottom nav.

**Removed from nav:** Roadmap (feature removed), Opportunities/Leaderboard/Resume (accessible via Home category cards)

---

## Opportunities Explorer

Three-level drill-down:

1. **Domain grid** — 12 cards: Data & Analytics, UI/UX Design, Web Development, Mobile Dev, AI/ML, Cybersecurity, Cloud & DevOps, Blockchain, Game Dev, Embedded/IoT, QA & Testing, Product Mgmt
2. **Sub-domain list** — 4 sub-domains per domain (48 total)
3. **Opportunity cards** — Jobs / Internship / Freelancing tabs with real company listings + **Prepare** and **Apply** actions

Sub-domain data lives in `artifacts/ninelab/src/data/domains.ts` (shared across Opportunities and the preloader).

---

## Course Page (`/opportunities/course`)

Entered via the **Prepare** button on any opportunity card. Context (sub-domain name, domain, skills, colors) is stored in `sessionStorage` under `"courseContext"`.

### Loading screen
Always shows a minimum **3-second live-generation animation** regardless of cache state:
- Pulsing domain emoji
- Animated progress bar (0 → 100%)
- Rotating status messages every 520ms
- 4-step checklist ticking off in real time

### Tabs

#### Course (Roadmap)
- **Progress ring banner** — circular SVG, overall completion % and lesson count
- **Module accordion** — 5 modules, expand/collapse; each shows: module number, emoji, title, duration, per-module progress bar
- **Lesson rows** — type icon (🎬 Video / 📖 Reading / ✏️ Exercise / 🛠️ Project), title, duration, strikethrough when done
- **Lesson detail** (inline expand) — description, 2 key takeaways, **Watch on YouTube** button (opens targeted search), **Mark Done** toggle
- Progress persisted in `localStorage` under `lesson_progress_<subDomainId>`

#### Flashcards
- SM-2 spaced repetition (12 AI-generated cards)
- 3D flip animation, 4 grade buttons (Again / Hard / Good / Easy)
- Daily new-card cap (20/day), leech detection (>4 lapses), study streak
- localStorage keys: `flashcards_progress_<id>`, `daily_new_<id>_<date>`, `flashcard_streak`, `flashcard_last_study`

#### Quiz
- 5 AI MCQ questions (2 easy / 2 medium / 1 hard)
- Instant correct/wrong highlight + explanation
- Results screen with per-question breakdown + retry

### Caching
Cache key: `course_content_v2_<subDomainId>` in localStorage. Cache is permanent until cleared. Old `course_content_<id>` keys (no lesson data) are ignored.

---

## Course Library (`/practice/courses`)

A browse-first catalog of AI-generated courses that a student can start without first having a job or opportunity in context. Courses are organized by domain — **20 domains × 5 tracks** — and each course is **5 modules × 3 lessons** with curated free videos/reading and spaced-repetition flashcards. It lives in the Prep hub alongside mock interviews.

### Module quizzes + final exam
Each module ends with a short quiz that must be passed to unlock the next module. After all modules are complete, a **10-question final exam** is offered — **70% to pass**, with unlimited retakes.

### Certificates
Passing the final exam **and** a certificate mock interview (AI-scored, **60+ to pass**) earns a verifiable certificate. Each certificate has a public verify page at `/certs/:slug` with a QR code and the skills it covers. Certificates are issued to **claimed (signed-in) accounts only**. Students may optionally add a certificate to their resume (off by default), and completing a course can add a confirmed skill to the profile once the student explicitly confirms it.

---

## Interview Library

Ready-made mock interviews for real companies, presented **role-first** and filterable, so a student can pick a target company/role and start in one tap. Surfaced in the Prep hub next to the AI mock interview launcher.

---

## Background Course Preloader

`artifacts/ninelab/src/hooks/useCoursePreloader.ts`

Triggered 1.5s after Opportunities page mounts. Silently generates all 48 sub-domain courses in **batches of 4** using `Promise.all`. Each batch saves to localStorage on success. A module-level singleton prevents duplicate runs. Status tracked under `course_preload_status` in localStorage.

---

## API Endpoints

All routes under `/api`:

### Students
| Method | Route | Description |
|---|---|---|
| GET | `/students` | List all students |
| POST | `/students` | Create student |
| GET | `/students/:id/dashboard` | Dashboard data (XP, streak, quests, skills) |
| GET | `/students/:id/wrapped` | Career Wrapped stats |

### Quests
| Method | Route | Description |
|---|---|---|
| GET | `/quests` | All available quests |
| GET | `/students/:id/quests` | Student quest progress |
| POST | `/students/:id/quests/:questId/complete` | Mark quest complete |

### Practice
| Method | Route | Description |
|---|---|---|
| POST | `/interview/sessions` | Create interview session |
| POST | `/interview/sessions/:id/question` | Get next AI question |
| PATCH | `/interview/sessions/:id/feedback` | Submit answer + get AI feedback |

### Profile (new)
| Method | Route | Description |
|---|---|---|
| GET | `/students/:id/full-profile` | Full enriched profile (all 14 new columns) |
| PATCH | `/students/:id/profile` | Update bio, projects, certs, links, preferences |
| POST | `/students/:id/analyze-github` | Fetch real GitHub API stats + compute profileStrength |
| POST | `/students/:id/analyze-linkedin` | AI (claude-haiku-4-5) LinkedIn profile analysis |
| GET | `/talent-pool` | All students for recruiter portal (includes githubStats, scores) |

### Jobs & Matches
| Method | Route | Description |
|---|---|---|
| GET | `/jobs` | All job listings |
| GET | `/students/:id/matches` | Student's matched jobs |
| POST | `/students/:id/matches/generate` | AI-generate job matches |

### Course (AI)
| Method | Route | Description |
|---|---|---|
| POST | `/course/generate` | Generate full course for a sub-domain |

The course endpoint makes **two sequential AI calls** to stay within token limits:
1. Call 1 → 5 modules × 3 lessons each (with type, duration, description, keyPoints, searchQuery) — `max_tokens: 4000`
2. Call 2 → 10 flashcards + 5 quiz questions — `max_tokens: 3000`
Both results are merged and returned as one JSON object.

### Leaderboard & AI
| Method | Route | Description |
|---|---|---|
| GET | `/leaderboard/india` | India-wide leaderboard |
| GET | `/leaderboard/college/:college` | College leaderboard |
| GET | `/ai/roadmap/:studentId` | AI-generated roadmap |
| GET/POST | `/anthropic/conversations` | Chat conversations |
| POST | `/anthropic/conversations/:id/messages` | Send message (SSE stream) |

---

## Database Schema

Tables: `students`, `quests`, `student_quests`, `jobs`, `matches`, `interview_sessions`, `conversations`, `messages`

### New columns on `students` (added for data-collection / recruiter marketplace)
`linkedinUrl`, `portfolioUrl`, `phone`, `bio`, `projects` (JSONB), `certifications` (JSONB), `openToWork`, `workMode`, `preferredLocations` (JSONB), `expectedSalary`, `githubStats` (JSONB), `linkedinData` (JSONB), `profileStrength`, `commitmentScore`

**profileStrength** — computed server-side (max 100): github+10, linkedin+15, portfolio+5, phone+5, bio+10, projects≥1+20, projects≥3+5, certs+10, locations+5, salary+5, githubStats+5, linkedinData+5
**commitmentScore** — `min(xp/25,40) + min(streakCount×3,30) + overallScore×0.3`

---

## Key Commands

```bash
# Full typecheck across all packages
pnpm run typecheck

# Regenerate React Query hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to dev database
pnpm --filter @workspace/db run push
```

---

## Key Files

| File | Purpose |
|---|---|
| `artifacts/ninelab/src/data/domains.ts` | Shared DOMAINS + ALL_SUBDOMAINS constants (48 sub-domains) |
| `artifacts/ninelab/src/hooks/useCoursePreloader.ts` | Background course pre-generation hook |
| `artifacts/ninelab/src/pages/Course.tsx` | Full Coursera-style course page (roadmap + SM-2 flashcards + quiz) |
| `artifacts/ninelab/src/pages/Opportunities.tsx` | 3-level domain explorer |
| `artifacts/ninelab/src/pages/Onboarding.tsx` | 10-step WhatsApp chatbot onboarding |
| `artifacts/api-server/src/routes/course.ts` | POST /api/course/generate (two-call AI strategy) |
| `artifacts/api-server/src/routes/interview.ts` | AI interview with feedback |
| `artifacts/api-server/src/routes/index.ts` | Route registration |
| `artifacts/api-server/src/routes/profile.ts` | Profile API + talent-pool route |
| `artifacts/ninelab/src/pages/Profile.tsx` | Rich 851-line profile page (strength ring, GitHub/LinkedIn AI, projects, certs) |
| `artifacts/recruiter-portal/src/App.tsx` | Recruiter portal routing (wouter) |
| `artifacts/recruiter-portal/src/pages/Login.tsx` | Recruiter login (company/name/email → localStorage) |
| `artifacts/recruiter-portal/src/pages/TalentPool.tsx` | Browse + filter all candidates (search, work mode, field, CGPA, strength) |
| `artifacts/recruiter-portal/src/pages/StudentDetail.tsx` | Full candidate view (scores, GitHub, skills, projects, certs, LinkedIn AI) |
| `artifacts/recruiter-portal/src/pages/Shortlist.tsx` | Shortlisted candidates + CSV export |

---

## Important Notes

- `lib/api-zod/src/index.ts` must stay as `export * from "./generated/api"` only — Orval regenerates it
- Anthropic env vars are auto-set by Replit: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- Student ID stored in `localStorage` as `"studentId"` for session persistence
- Language rule: use "Points ⭐" not "XP"; "Today's Goal" not "Today's Quest"; Streak and Level are fine
- The `conversations` and `messages` DB tables use plain names (not `conversationsTable`/`messagesTable`)
- Do **not** run `pnpm dev` or `pnpm run dev` at workspace root — use `restart_workflow` instead
- Vite dev server must have `server.allowedHosts: true` (proxied iframe)

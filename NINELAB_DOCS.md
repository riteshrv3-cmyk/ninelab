# ninelab — Documentation

## What is ninelab?

ninelab is an AI-powered career companion built for Indian engineering students, from 1st year through to placement. It combines gamified learning (XP, streaks, levels), personalised roadmaps, AI mock interviews, skill-based job matching, and a shareable "Career Wrapped" — all in a mobile-first web app.

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── ninelab/          # React + Vite frontend (serves at /)
│   └── api-server/          # Express API server (serves at /api)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-zod/             # Generated Zod validation schemas
│   ├── api-client-react/    # Generated React Query hooks
│   ├── db/                  # Drizzle ORM schema + database client
│   └── integrations-anthropic-ai/  # Anthropic AI client
├── scripts/                 # Shared utility scripts
└── replit.md                # Project memory / architecture notes
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, wouter (routing), Framer Motion |
| UI Components | shadcn/ui (Radix + Tailwind) |
| State / Data | TanStack React Query |
| Backend | Express 5, Node.js 24 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| AI | Anthropic claude-haiku-4-5 via Replit AI Integrations |
| API Contract | OpenAPI 3.0 → Orval codegen |
| Package Manager | pnpm workspaces (monorepo) |
| TypeScript | 5.9, strict mode |

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/` | Onboarding | WhatsApp-style chatbot collects name, college, city, year, field. Creates student profile. |
| `/dashboard` | Dashboard | Streak + XP cards, today's quest, skill progress bars, ninelab score, leaderboard rank |
| `/roadmap` | Roadmap | Vertical year-by-year accordion of quests. Tap to see details and start a quest. |
| `/prep` | Prep Hub | Cards to launch mock interviews and browse the interview library |
| `/prep/interview/:id` | Mock Interview | AI-powered 5-question interview. Shows score + feedback on completion. |
| `/practice/courses` | Course Library | Browse AI-generated courses by domain (20 domains × 5 tracks); start without a job. |
| `/certs/:slug` | Certificate | Public verify page for an earned certificate (QR code + skills covered). |
| `/jobs` | Job Matches | Job feed matched to your skills with readiness score. Locked cards for Pro tier. |
| `/profile` | Profile | Avatar, stats, verified skills, Career Wrapped modal |
| `/leaderboard` | Leaderboard | College tab + India tab. Ranked by ninelab score. |

---

## Course Library & Certificates

The Course Library (`/practice/courses`) lets students browse AI-generated courses by domain — **20 domains × 5 tracks** — without needing a job first. Each course is **5 modules × 3 lessons** with curated free videos/reading and flashcards.

**Module quizzes + final exam.** Each module ends with a short quiz that unlocks the next module. After all modules are done, a **10-question final exam** is offered — **70% to pass**, unlimited retakes.

**Certificates.** Passing the final exam **and** a certificate mock interview (AI-scored, **60+ to pass**) earns a verifiable certificate. Each has a public verify page at `/certs/:slug` with a QR code and the skills covered. Certificates are for **claimed (signed-in) accounts only**. A student may optionally add a certificate to their resume (off by default), and completing a course can add a confirmed skill to the profile once the student explicitly confirms it.

## Interview Library

Ready-made mock interviews for real companies, presented **role-first** and filterable. A student can pick a target company/role and start in one tap. Surfaced in the Prep hub alongside the AI mock interview launcher.

---

## API Endpoints

All endpoints are prefixed with `/api`.

### Students

| Method | Path | Description |
|---|---|---|
| `POST` | `/students` | Create a new student (onboarding) |
| `GET` | `/students/:id` | Get student profile |
| `PATCH` | `/students/:id` | Update student profile |
| `GET` | `/students/:id/dashboard` | Full dashboard data (student, quest, skills, rank) |
| `GET` | `/students/:id/wrapped` | Career Wrapped data for the current month |

**Create Student body:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "college": "PICT",
  "city": "Pune",
  "year": 2,
  "field": "Web Dev",
  "skills": ["React", "JavaScript"],
  "githubUrl": "https://github.com/rahul"
}
```

---

### Quests

| Method | Path | Description |
|---|---|---|
| `GET` | `/quests` | List all quests (optional `?field=Web Dev&year=2`) |
| `GET` | `/students/:id/quests` | Get student's quest progress (all quests for their field + year) |
| `POST` | `/students/:id/quests/:questId/complete` | Mark a quest complete, awards XP |

---

### Mock Interviews

| Method | Path | Description |
|---|---|---|
| `POST` | `/interview/sessions` | Start a new interview session |
| `GET` | `/interview/sessions/:id` | Get session state |
| `POST` | `/interview/sessions/:id/question` | Submit answer, get next AI question + feedback |

**Start session body:**
```json
{ "studentId": 1, "topic": "React" }
```

**Submit answer body:**
```json
{ "answer": "useEffect runs side effects after render..." }
```

The interview runs for 5 questions. After the 5th, the session is closed and a score + overall feedback is returned.

---

### Jobs

| Method | Path | Description |
|---|---|---|
| `GET` | `/jobs` | List all available jobs |
| `GET` | `/students/:id/matches` | Get existing job matches for a student |
| `POST` | `/students/:id/matches/generate` | Generate AI job matches based on skills |

---

### Leaderboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/leaderboard/india` | Top 50 students across India |
| `GET` | `/leaderboard/college/:college` | Top 50 students in a specific college |

---

### AI

| Method | Path | Description |
|---|---|---|
| `GET` | `/ai/roadmap/:studentId` | Generate/refresh AI-powered personalised roadmap |

---

### Anthropic Chat (Conversations)

Used internally by the chatbot and AI features.

| Method | Path | Description |
|---|---|---|
| `GET` | `/anthropic/conversations` | List all conversations |
| `POST` | `/anthropic/conversations` | Create a new conversation |
| `GET` | `/anthropic/conversations/:id` | Get conversation with messages |
| `DELETE` | `/anthropic/conversations/:id` | Delete a conversation |
| `GET` | `/anthropic/conversations/:id/messages` | List messages |
| `POST` | `/anthropic/conversations/:id/messages` | Send message — **streams SSE response** |

**SSE streaming format:**
```
data: {"content": "Sure, "}
data: {"content": "let me explain..."}
data: {"done": true}
```

---

## Database Schema

### `students`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| email | text | unique |
| college | text | |
| city | text | |
| year | integer | 1–4 |
| field | text | Web Dev / AI/ML / Data / App Dev / Cybersecurity |
| skills | jsonb | array of skill strings |
| github_url | text | optional |
| xp | integer | default 0 |
| streak_count | integer | default 0 |
| level | integer | default 1 |
| overall_score | float | 0–100, ninelab score |
| last_active_date | date | for streak tracking |

### `quests`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| title | text | |
| description | text | |
| field | text | matches student field |
| year | integer | 1–4 |
| xp_reward | integer | default 50 |
| minutes | integer | estimated time |
| why_it_matters | text | shown in quest detail |
| how_to_do_it | text | shown in quest detail |

### `student_quests`
Tracks which quests a student has completed.
| Column | Type |
|---|---|
| id | serial PK |
| student_id | FK → students |
| quest_id | FK → quests |
| status | text: "in_progress" / "completed" |
| completed_at | timestamp |

### `jobs`
| Column | Type |
|---|---|
| id | serial PK |
| company_name | text |
| role | text |
| required_skills | jsonb |
| ctc_min / ctc_max | float (LPA) |
| location | text |
| remote | boolean |

### `matches`
AI-generated job matches per student.
| Column | Type |
|---|---|
| id | serial PK |
| student_id | FK |
| job_id | FK |
| match_score | integer (0–100) |
| match_reason | text |
| is_locked | boolean |

### `interview_sessions`
| Column | Type |
|---|---|
| id | serial PK |
| student_id | FK |
| topic | text |
| status | text: "active" / "completed" |
| questions_asked | integer |
| total_score | float |
| feedback | text |
| created_at | timestamp |

### `conversations` & `messages`
Used by the Anthropic chat integration.

---

## Gamification System

| Element | How it works |
|---|---|
| **XP** | Earned by completing quests, interviews, and courses. Amount varies by difficulty. |
| **Level** | Calculated as `floor(xp / 200) + 1`. Displayed on dashboard and profile. |
| **Streak** | Incremented each day the student completes at least one quest. Resets on miss. |
| **ninelab Score** | Overall percentile score (0–100) used for job matching and leaderboard ranking. |

---

## Seeded Data

The database is pre-seeded with:

- **42 quests** — covering 6 fields (Web Dev, AI/ML, Data, App Dev, Cybersecurity) × 4 years, with real actionable "why it matters" and "how to do it" guidance tailored for Indian students
- **12 jobs** — ranging from TCS / Infosys (3–6 LPA) to Zerodha / Razorpay / CRED (8–22 LPA), including remote-friendly startups

---

## Key Development Commands

```bash
# Run typecheck across all packages
pnpm run typecheck

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (development only)
pnpm --filter @workspace/db run push

# Start API server (handled by workflow)
pnpm --filter @workspace/api-server run dev

# Start frontend (handled by workflow)
pnpm --filter @workspace/ninelab run dev
```

---

## Adding a New API Endpoint

1. Add the route to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks + schemas
3. Add the handler in `artifacts/api-server/src/routes/<feature>.ts`
4. Register it in `artifacts/api-server/src/routes/index.ts`
5. Use the generated React Query hook in the frontend

> **Important:** After codegen, verify `lib/api-zod/src/index.ts` only contains `export * from "./generated/api";` — orval overwrites this file and may add extra content.

---

## Adding New Quests

Insert directly into the database:

```sql
INSERT INTO quests (title, description, field, year, xp_reward, minutes, why_it_matters, how_to_do_it)
VALUES ('Quest Title', 'Short description', 'Web Dev', 2, 100, 30, 'Why this matters...', 'Step by step guide...');
```

Fields must match exactly: `Web Dev`, `AI/ML`, `Data`, `App Dev`, `Cybersecurity`

---

## Environment Variables

| Variable | Source | Used by |
|---|---|---|
| `DATABASE_URL` | Replit PostgreSQL | API server, DB lib |
| `SESSION_SECRET` | Replit secret | Express sessions |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit AI Integrations (auto) | Anthropic lib |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Replit AI Integrations (auto) | Anthropic lib |
| `PORT` | Replit workflow (auto) | Each artifact's dev server |

---

## Architecture Notes

- The frontend stores `studentId` in `localStorage` — this is the session. Clearing it returns to onboarding.
- The global reverse proxy routes `/api/*` to the API server and everything else to the Vite frontend. Do not add Vite proxy configs.
- All AI calls (interviews, courses, job matches, roadmap) go through `@workspace/integrations-anthropic-ai` which uses the Replit AI Integrations proxy — no user API key needed.
- The `conversations` and `messages` Drizzle tables are named without the `Table` suffix (unlike other tables). Import them as `conversations` and `messages` from `@workspace/db`.

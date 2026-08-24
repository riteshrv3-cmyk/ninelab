# ninelab — Founder's Handbook

Everything you need to explain, pitch, and defend this product — from a 10-second elevator line to deep technical answers.

Live app: https://ninelab-production-8b96.up.railway.app

---

# PART 1 — THE SIMPLE STORY (for investors, clients, anyone)

## The one-liner

**"ninelab is an AI career coach in your pocket for India's 1.5 million engineering students — it trains them for placements and connects them directly to recruiters."**

## The 30-second pitch

Every year, India produces around 1.5 million engineering graduates. Most of them fail campus placements — not because they lack talent, but because nobody teaches them *how* to get hired: how to interview, what skills companies actually want, how to write a resume that gets shortlisted, or even which "placement drive" messages on WhatsApp are scams.

Coaching institutes charge Rs 50,000+ and only exist in big cities. ninelab puts that entire coaching experience into an app: an AI interviewer that talks to you face-to-face, personalized career roadmaps, courses, verifiable certificates, resume building, and a direct line to recruiters — for a fraction of the cost, available to a student in any tier-3 town with a phone.

## The problem (3 bullet points)

1. **Placement preparation is broken.** Colleges teach syllabus, not employability. Students discover their gaps in the actual interview — when it's too late.
2. **Good coaching is expensive and urban.** Rs 50k-2L for offline institutes; tier-2/3 students are locked out.
3. **Recruiters can't find verified talent efficiently.** Resumes are inflated, mass applications are noise, and screening is manual and slow.

## The solution — what the product actually does

**For students (the free/consumer side):**

| Feature | What it does in plain words |
|---|---|
| AI Mock Interview (audio + video) | The app *speaks* interview questions in a natural human voice, the student answers *by speaking* into the mic with their camera on — like a real video interview. AI transcribes the answer, asks smart follow-ups, then gives a scored report: communication, technical depth, confidence, weak points, and better sample answers. |
| Career Roadmap | Enter your branch and year, get a personalized 4-year milestone plan built for Indian campus placements. |
| AI Courses | Pick any skill (e.g. React, Kubernetes) — the app generates a 5-module course with lessons, curated video links, flashcards (with spaced-repetition memory science), and quizzes. |
| Course Library + Certificates | Browse AI-generated courses by domain (20 domains × 5 tracks) without needing a job first. Each module quiz unlocks the next, then a 10-question final exam (70% to pass). Pass the exam plus a certificate mock interview (AI-scored, 60+) to earn a verifiable certificate with a public verify link, QR code, and skills covered. |
| Interview Library | Ready-made mock interviews for real companies — role-first, filterable, and startable in one tap. |
| Resume Builder | Templates plus AI suggestions matched to target companies and salary bands. |
| Drive-Check (scam detector) | Students paste placement messages forwarded on WhatsApp/Telegram; AI flags scams (fake fees, WhatsApp-only applications, unrealistic salaries) and extracts real drive details. This protects students from real fraud. |
| AI Career Chat | A 24x7 mentor that knows the student's profile and answers career questions. |
| Gamification | XP, levels, streaks, quests, college and national leaderboards — keeps students coming back daily. |

**For recruiters (the paid/business side):**

| Feature | What it does |
|---|---|
| Talent Pool | Browse students with verified, platform-tested skill scores — not self-claimed resume keywords. |
| AI Candidate Reports | One click: fit score for a specific role, strengths, concerns, suggested interview questions, salary estimate, even a "ghosting risk" signal. |
| Job Matching + Bulk Invites | Post a role, get ranked student matches, invite in bulk. |

**Also built (separate portals in the same codebase):** TPO portal (college placement officers manage drives), admin panel, recruiter portal.

## Business model (how it makes money)

- **Students: freemium.** Core features free (that's the moat — distribution). Premium tier possible later: unlimited AI interviews, advanced reports.
- **Recruiters: B2B subscription.** Pay for access to the verified talent pool, AI screening reports, and bulk hiring tools. This is the primary revenue engine — recruiters already pay Naukri/LinkedIn far more for far noisier data.
- **Colleges/TPOs: B2B SaaS.** Placement cells pay for dashboards, drive management, and employability analytics on their students.

## Why now, why us

- AI cost collapsed: what needed a human coach at Rs 1,000/hour now costs a few rupees of API calls per session.
- Voice AI became real: natural text-to-speech and accurate speech recognition make a *spoken* mock interview possible in a browser — no app install.
- The wedge: nobody combines *training* + *verified scoring* + *recruiter marketplace* for the Indian campus segment. Prep apps don't have recruiters; job boards don't train or verify.

## Traction talking points (keep honest)

- Product is live in production with the full student loop working end to end.
- The platform stats endpoint reports real numbers from the database — use those, never inflated figures. (If asked about the landing-page numbers, say they are target-market illustrations being replaced with live counts.)

---

# PART 2 — THE TECHNICAL STORY (when they go deep)

## Architecture in one paragraph (memorize this)

"It's a **TypeScript monorepo**: a **React 19** single-page app served with an **Express 5 (Node.js) API** from a single origin, deployed on **Railway** with CI-style builds. Data lives in **PostgreSQL on Neon** (serverless Postgres) accessed through **Drizzle ORM** — 20 tables covering students, recruiters, colleges, interviews, courses, resumes, jobs, and AI-response caching. The API is **schema-first**: an OpenAPI spec generates our Zod validators and typed React Query client, so frontend and backend can't drift apart. AI is behind a **provider-abstraction layer** — currently OpenAI (gpt-4o-mini for reasoning, tts-1 for the interviewer's voice, Whisper for transcribing spoken answers) — with response caching, rate limiting, and JSON-mode enforcement for reliability. Auth is **Clerk** (managed identity provider). Interview chat streams over **SSE** for real-time feel."

## Stack table (exact versions — you can quote these)

| Layer | Technology | Version | Why we chose it |
|---|---|---|---|
| Frontend | React + TypeScript | React 19 | Industry standard, huge hiring pool, concurrent rendering |
| Build tool | Vite | 7.x | Sub-second dev reloads, tree-shaken production bundles |
| Styling | Tailwind CSS | 4.x | Design consistency, tiny CSS output |
| Animations | Framer Motion | 12.x | Polished, app-like feel in the browser |
| Data fetching | TanStack React Query | 5.x | Caching, retries, optimistic updates out of the box |
| Routing | Wouter | 3.x | 1.5KB router — keeps bundle small |
| API server | Express | 5.x | Battle-tested, middleware ecosystem, team familiarity |
| Language/runtime | TypeScript on Node.js | Node >= 24 | One language across the whole stack |
| ORM | Drizzle ORM | 0.45.x | Type-safe SQL, zero runtime overhead vs heavy ORMs |
| Database | PostgreSQL (Neon serverless) | Postgres 16 | ACID, relational integrity, scales to zero cost when idle |
| Validation | Zod | 3.25.x | Runtime validation generated from our OpenAPI spec |
| API codegen | OpenAPI + Orval | — | Spec-first: one YAML generates server validators + typed client hooks |
| Auth | Clerk | @clerk/express 2.x | Managed auth: sessions, OAuth, MFA without building it ourselves |
| AI | OpenAI API | openai SDK 4.104 | gpt-4o-mini (reasoning), tts-1 (voice), whisper-1 (speech-to-text) |
| Logging | Pino | 9.x | Structured JSON logs, production-grade |
| Monorepo | pnpm workspaces | pnpm 10.33 | Shared packages, single lockfile, fast installs |
| Hosting | Railway | — | Git-less CLI deploys, health checks, instant rollbacks |

## Monorepo layout (shows engineering discipline)

```
artifacts/          <- deployable apps
  ninelab/       <- student-facing React app
  api-server/       <- Express 5 API (serves the built frontend too)
  recruiter-portal/ tpo-portal/ admin-panel/
lib/                <- shared internal packages
  db/               <- Drizzle schema: 20 tables, one source of truth
  api-spec/         <- OpenAPI YAML (the contract)
  api-zod/          <- generated Zod validators
  api-client-react/ <- generated typed React Query hooks
  integrations-anthropic-ai/ <- AI provider abstraction layer
```

**Talking point:** "The API is contract-first. We write the OpenAPI spec once; codegen produces the backend validators and the typed frontend client. A breaking change fails the build instead of failing in production."

## The 20 database tables (grouped)

- **Students:** students, student_resumes, student_quests, student_activity_log
- **Assessment:** interview_sessions, quests
- **Learning/AI:** conversations, messages, ai_cache
- **Jobs marketplace:** jobs, matches, recruiter_jobs, recruiter_invites, recruiters
- **Institutions:** colleges, tpo_accounts, tpo_drives, tpo_sessions
- **Other:** drive_checks (scam detector history), mentors

## How the AI layer actually works (your strongest technical answer)

1. **Provider abstraction.** All AI calls go through one internal package. The app code calls a stable interface; the package talks to the provider. We have already swapped providers once (an Anthropic-compatible gateway to OpenAI) **without touching a single feature file** — that's the proof the abstraction works. Switching models is a one-line environment variable (`AI_MODEL`).
2. **Reliability engineering, not just prompts:**
   - **JSON mode** (`response_format: json_object`) forces the model to return valid JSON for structured outputs (courses, tests) — eliminated a whole class of intermittent parse failures.
   - **AI response caching** (`ai_cache` table): identical requests (same course topic, same JD analysis) are served from Postgres instead of paying for a second model call. Cuts cost and latency massively.
   - **Rate limiting middleware:** token-bucket limits per user on heavy AI endpoints (30/hour heavy, 60/hour medium) so one user can't burn the API budget.
   - **Parallel calls:** course generation runs its two model calls concurrently — halved generation time.
3. **The voice interview pipeline:**
   - Question text -> OpenAI **tts-1** -> mp3 streamed to the browser -> student hears a natural voice.
   - Student speaks -> browser **MediaRecorder** captures audio -> uploaded -> OpenAI **Whisper** transcribes -> answer auto-submitted.
   - Camera self-view via **getUserMedia** (video stays on-device — privacy point, see below).
   - Graceful degradation: if TTS or the mic fails, it falls back to browser speech APIs; if those fail, text mode. The interview never dead-ends.
4. **Streaming:** career chat responses stream token-by-token over **Server-Sent Events** so the user sees the answer being written, like ChatGPT.

## Security and privacy (answer honestly, with a plan)

What's in place today:
- All traffic over HTTPS; secrets in environment variables (never in the repo — `.env` is gitignored).
- Managed auth via Clerk (we never store passwords).
- Input validation with Zod on API bodies; SQL injection prevented by Drizzle's parameterized queries.
- Rate limiting on expensive endpoints.
- Interview **video never leaves the device** — the camera is a self-view only; we upload audio only, for transcription.
- Admin endpoints gated by a server-side token.

Known hardening roadmap (say this proactively if asked — it builds trust):
- Enforcing Clerk session checks on every API route (auth middleware is integrated; per-route enforcement is the current sprint).
- Moving recruiter access to verified sign-in with role-based access control.
- Moving rate-limit state to Redis for multi-instance scale.
- Production-tier auth keys and automated test coverage before scale marketing.

**Never claim it's "fully secure."** Say: "We follow standard practices — managed auth, parameterized queries, validated inputs, secrets management — and we have a clear hardening checklist we're executing before scale."

## Infrastructure and cost (investors love this)

- **Single-origin deploy:** one Railway service runs the API and serves the built frontend — no CORS complexity, one thing to monitor, health-checked at `/api/healthz` with automatic restart policy.
- **Neon Postgres:** serverless — scales to near-zero cost at low traffic, no DBA needed.
- **Unit economics (approximate, current pricing):**
  - gpt-4o-mini: ~Rs 1-3 per heavy AI action (a full course, an interview evaluation) — often Rs 0 thanks to caching.
  - Voice: TTS ~Rs 1.3 per 1,000 characters spoken; Whisper ~Rs 0.5 per minute of student audio.
  - A complete 10-minute voice mock interview costs roughly **Rs 5-10 in AI fees** — versus Rs 500-1,000 for a human mock interview.
  - Fixed infra: single-digit dollars per month at current stage.
- **Scale story:** stateless API (scale horizontally by adding instances), Postgres connection pooling, AI cache absorbs repeated load, static assets can move to a CDN, rate-limit state moves to Redis. Nothing in the architecture blocks 100x current load.

## Deployment workflow

- `railway up` builds from source on Railway's build infrastructure (pnpm install -> build frontend -> build API -> bundle) and health-checks before switching traffic.
- Rollback = redeploy previous build, one command.
- Logs are structured JSON (Pino) queryable via Railway.

---

# PART 3 — Q&A PREP (likely questions, ready answers)

**Q: Is this just a ChatGPT wrapper?**
A: "No — the AI model is one component, like Stripe is for payments. Our value is the layer around it: a 21-table data model of the Indian placement ecosystem, verified skill scoring that recruiters trust, a voice interview pipeline (TTS + speech recognition + evaluation rubrics), spaced-repetition learning, scam detection tuned to Indian placement fraud patterns, caching and cost controls, and the two-sided marketplace. Swap the model out tomorrow and the product still stands; take our data model and recruiter network away and there's nothing left to wrap."

**Q: Did you build this with AI tools?**
A: "We use AI-assisted development like every modern engineering team — GitHub reports the majority of new code industry-wide is now AI-assisted. What matters is that we own the architecture: the schema design, the API contracts, the provider abstraction, the security model, and the product decisions are ours, documented, and I can walk you through any of them." (And you can — it's all in Part 2.)

**Q: What's your backend?**
A: "Node.js with Express 5, TypeScript end to end, PostgreSQL on Neon with Drizzle ORM, deployed on Railway. Contract-first API with OpenAPI-generated validation and typed clients."

**Q: Which AI models? What if OpenAI raises prices or goes down?**
A: "Currently OpenAI — gpt-4o-mini for reasoning, tts-1 for voice, Whisper for transcription. But every AI call goes through our own abstraction layer; we've already migrated providers once with zero feature-code changes. Model choice is an environment variable. We're provider-agnostic by design."

**Q: How do you keep AI costs from eating margins?**
A: "Three ways: we use a small fast model (gpt-4o-mini, not the expensive flagship) — quality is enforced by structured prompts and JSON mode, not raw model size; we cache AI responses in Postgres so repeated requests cost zero; and heavy endpoints are rate-limited per user. A full voice interview costs us under Rs 10."

**Q: What about hallucinations / wrong AI answers?**
A: "Structured outputs with JSON-mode validation, domain-scoped prompts (the model is instructed narrowly per feature, e.g. only generating MCQs with a fixed schema), and Zod validation on everything before it touches the database. For scam detection we combine AI with deterministic heuristics. It's constrained generation, not open-ended chat."

**Q: How is student data protected?**
A: "Managed authentication through Clerk — we never see or store passwords. Interview video never leaves the student's device; only audio goes up, solely for transcription. Secrets are environment-managed, queries are parameterized, inputs validated. We have a documented hardening checklist we're executing before scale."

**Q: Why will students trust your scores? / What's defensible?**
A: "The score is earned on-platform — course exams, recorded interview performance, streak history — not self-reported. Over time that becomes a proprietary dataset: verified employability signals on lakhs of students that no resume database has. That data plus the recruiter network is the moat."

**Q: Who are competitors?**
A: "Prep side: Unstop, PrepInsta, coaching institutes. Hiring side: Naukri Campus, LinkedIn, HirePro. Nobody does train-verify-place in one loop for the Indian campus segment. Prep apps have no recruiters; job boards do no verification."

**Q: What's the tech team / how fast can you ship?**
A: "The entire stack is one language (TypeScript), contract-first, with generated clients — a small team ships fast safely. The same codebase already contains the student app, recruiter portal, TPO portal and admin panel."

**Q: Current metrics?**
A: Pull live numbers before every meeting from the platform stats endpoint (real database counts): `GET /api/platform/stats` — never quote inflated numbers.

---

# PART 4 — QUICK REFERENCE CARD

- **Product:** AI career coach + verified talent marketplace for Indian engineering students
- **Live URL:** https://ninelab-production-8b96.up.railway.app
- **Stack in one breath:** React 19 + Vite + Tailwind | Express 5 + TypeScript | PostgreSQL (Neon) + Drizzle | OpenAI (gpt-4o-mini / tts-1 / Whisper) | Clerk auth | Railway hosting | pnpm monorepo
- **Killer demo:** the voice mock interview (camera on, AI speaks, you speak back, scored report at the end) and Drive-Check (paste a scam placement message live)
- **Revenue:** free students -> paid recruiters (B2B) -> college SaaS (B2B)
- **Moat:** verified skill data + two-sided network, not the AI model
- **Cost per AI interview:** under Rs 10
- **One honest line on maturity:** "Live product, full student loop working; current sprint is security hardening and test coverage before scale marketing."

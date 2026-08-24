# ninelab

**An AI career companion for India's engineering students — mock interviews, personalized roadmaps, skill verification, and a direct line to recruiters.**

Live: https://ninelab-production-8b96.up.railway.app

---

## What it does

**For students**
- **AI voice mock interviews** — the interviewer speaks questions aloud (OpenAI TTS), the student answers by speaking (Whisper transcription) with camera self-view, then gets a scored report covering communication, technical depth, and confidence.
- **Career roadmaps** — personalized 4-year milestone plans built for Indian campus placements.
- **AI courses** — any skill generates a 5-module course with lessons, curated videos, spaced-repetition flashcards, and quizzes.
- **Skill tests** — AI-generated MCQ assessments with instant scoring and explanations.
- **Resume builder** — templates with AI suggestions matched to target companies.
- **Drive-Check** — paste a forwarded placement message; AI flags placement scams and extracts real drive details.
- **Career chat** — a 24x7 AI mentor that knows the student's profile, streamed over SSE.
- **Gamification** — XP, levels, streaks, quests, and college/national leaderboards.

**For recruiters**
- Verified talent pool with platform-earned skill scores (not self-reported resume keywords)
- AI candidate reports: fit score, strengths, concerns, suggested interview questions
- Job posting, ranked matching, and bulk invites

Also included: TPO portal (college placement officers), recruiter portal, and admin panel.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, Framer Motion, TanStack Query 5, Wouter |
| API | Express 5 on Node.js 24, TypeScript |
| Database | PostgreSQL (Neon serverless) with Drizzle ORM — 21 tables |
| Contract | OpenAPI spec generating Zod validators + typed React Query hooks (Orval) |
| Auth | Clerk |
| AI | OpenAI — `gpt-4o-mini` (reasoning), `tts-1` (voice), `whisper-1` (speech-to-text) |
| Logging | Pino (structured JSON) |
| Tooling | pnpm workspaces monorepo |
| Hosting | Railway (single-origin: API serves the built frontend) |

---

## Repository layout

```
artifacts/                     deployable apps
  ninelab/                  student-facing React app
  api-server/                  Express 5 API (also serves the built frontend)
  recruiter-portal/
  tpo-portal/
  admin-panel/
lib/                           shared internal packages
  db/                          Drizzle schema — single source of truth (21 tables)
  api-spec/                    OpenAPI YAML (the API contract)
  api-zod/                     generated Zod validators
  api-client-react/            generated typed React Query hooks
  integrations-anthropic-ai/   AI provider abstraction layer
scripts/
  build-deploy.mjs             production build: frontend + API bundled together
```

**Contract-first API.** The OpenAPI spec generates both the backend validators and the typed frontend client, so a breaking change fails the build rather than failing in production.

**Provider-agnostic AI.** All model calls route through `lib/integrations-anthropic-ai`. The app code depends on a stable interface, so swapping providers or models is a configuration change (`AI_MODEL`) rather than a refactor.

---

## Getting started

### Prerequisites

- Node.js >= 24
- pnpm 10.33+ (`corepack enable`)
- A PostgreSQL database (Neon recommended)
- API keys: OpenAI, Clerk

### Setup

```bash
git clone <repo-url>
cd Career-Companion
pnpm install
```

Copy the environment template and fill in your own values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key (chat, TTS, Whisper) |
| `AI_MODEL` | Model id — defaults to `gpt-4o-mini` |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (API server) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same value — the frontend only reads `VITE_*` vars |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `ADMIN_API_TOKEN` | Token gating the admin endpoints |

Optional: `AI_TTS_MODEL`, `AI_TTS_VOICE`, `AI_STT_MODEL`, `OPENAI_BASE_URL`.

### Database

```bash
pnpm --filter @workspace/db run push
```

### Run locally

```bash
bash dev.sh
```

Frontend on `http://localhost:5000`, API on `http://localhost:3001` (Vite proxies `/api` to the API server).

### Production build

```bash
pnpm run build:deploy   # builds frontend + API, bundles frontend into the API's public dir
pnpm start              # serves both from a single origin
```

---

## Deployment

Deployed on Railway as a single service that serves both the API and the built frontend.

```bash
railway up --service ninelab --environment production --detach -m "<release summary>"
railway deployment list --service ninelab --environment production --json   # poll until SUCCESS
```

Build: `corepack enable && pnpm install --no-frozen-lockfile && pnpm run build:deploy`
Start: `node artifacts/api-server/dist/index.mjs`
Health check: `/api/healthz`

---

## Engineering notes

- **AI reliability** — structured outputs use OpenAI JSON mode; responses are cached in the `ai_cache` table so repeated requests cost nothing; heavy endpoints are rate-limited per user with a token-bucket middleware.
- **Streaming** — career chat and profile analysis stream token-by-token over Server-Sent Events.
- **Voice pipeline** — TTS audio is generated server-side and played in the browser; answers are captured with `MediaRecorder`, uploaded as base64, and transcribed by Whisper. Camera video never leaves the device (self-view only). Every stage degrades gracefully to browser speech APIs, then to text.
- **Secrets** — `.env` is gitignored; production configuration lives in Railway environment variables.

## Roadmap

- [ ] Enforce Clerk session checks on every API route
- [ ] Verified recruiter sign-in with role-based access control
- [ ] Move rate-limit state to Redis for multi-instance scale
- [ ] Automated test coverage (integration tests on the auth boundary first)
- [ ] Replace placeholder landing-page statistics with live counts from `/api/platform/stats`

## Documentation

- [`PRODUCT_HANDBOOK.md`](PRODUCT_HANDBOOK.md) — product overview, pitch material, technical deep-dive, and Q&A prep
- [`DOCUMENTATION.md`](DOCUMENTATION.md), [`NINELAB_DOCS.md`](NINELAB_DOCS.md) — feature documentation

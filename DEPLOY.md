# Deploying ninelab

The app runs as a **single Node service**: the Express API also serves the built
React frontend, so everything lives on one origin (no CORS, `/api/*` just works).

Cloud pieces already in place: **Neon** (Postgres), **AgentRouter** (AI), **Clerk** (auth).
You only need to host the one Node service. Guide below uses **Render** (free tier).

## What the build does

- `pnpm run build:deploy` builds the frontend (Vite) and the API (esbuild), then
  copies the frontend into `artifacts/api-server/dist/public`.
- `node artifacts/api-server/dist/index.mjs` serves API + frontend on `$PORT`.

## Steps

### 1. Push to GitHub
```bash
cd /c/dev/Career-Companion
git add -A
git commit -m "Deploy-ready: single-origin build + Render blueprint"
# create an empty repo on github.com first, then:
git remote add origin https://github.com/<you>/ninelab.git
git branch -M main
git push -u origin main
```

### 2. Create the Render service
1. Go to https://render.com, sign up (free), connect your GitHub.
2. **New +** -> **Blueprint** -> pick the `ninelab` repo. Render reads `render.yaml`.
3. Render prompts for the secret env vars (marked `sync:false`). Paste the same
   values from your local `.env`:
   - `DATABASE_URL`
   - `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY` (same value as CLERK_PUBLISHABLE_KEY)
   - `CLERK_SECRET_KEY`
   - `ADMIN_API_TOKEN` (any random string)
4. Click **Apply**. First build takes a few minutes.

### 3. Open the live URL
Render gives you `https://ninelab.onrender.com` (or similar).

## Notes
- **Free tier sleeps** after ~15 min idle; the next request cold-starts in ~50s.
- **AgentRouter is slow** (~30-60s per AI response). Fine for a demo; swap the
  `AI_MODEL` / provider later for speed.
- **Clerk dev keys** (`pk_test`/`sk_test`) work but show a dev banner and have
  limits. For a real launch, create a Clerk **production** instance with your own
  domain and update the three Clerk env vars.

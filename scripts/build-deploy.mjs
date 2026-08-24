// Production/deploy build: builds the frontend and the API, then colocates the
// frontend's static output next to the API bundle so a single Node process
// serves both under one origin.
//
// Usage: pnpm run build:deploy   (from the repo root)
// Requires VITE_CLERK_PUBLISHABLE_KEY in the environment (baked into the frontend
// at build time by Vite).
import { execSync } from "node:child_process";
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, extraEnv = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

if (!process.env.VITE_CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "WARNING: VITE_CLERK_PUBLISHABLE_KEY is not set — the frontend will fail to load Clerk at runtime.",
  );
}

// 1) Frontend. vite.config.ts requires PORT and BASE_PATH even for `build`.
run("pnpm --filter @workspace/ninelab run build", {
  NODE_ENV: "production",
  PORT: "5000",
  BASE_PATH: "/",
});

// 2) API server bundle (esbuild -> dist/index.mjs).
run("pnpm --filter @workspace/api-server run build");

// 3) Copy the built frontend next to the API bundle as ./public.
const frontendDist = path.join(root, "artifacts/ninelab/dist/public");
const apiPublic = path.join(root, "artifacts/api-server/dist/public");
if (!existsSync(frontendDist)) {
  throw new Error(`Frontend build not found at ${frontendDist}`);
}
rmSync(apiPublic, { recursive: true, force: true });
cpSync(frontendDist, apiPublic, { recursive: true });
console.log(`\nCopied frontend -> ${apiPublic}`);
console.log("\nDeploy build complete. Start with: pnpm start");

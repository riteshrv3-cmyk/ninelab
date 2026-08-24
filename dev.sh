#!/usr/bin/env bash
# Local dev launcher: starts the API server (port 3001) and the student app (port 5000).
# Usage: bash dev.sh    (from the Career-Companion folder, in Git Bash)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example to .env and fill in your keys." >&2
  exit 1
fi

set -a
source .env
set +a

# API server
(
  cd artifacts/api-server
  export NODE_ENV=development PORT=3001
  pnpm run build
  node --enable-source-maps ./dist/index.mjs
) &
API_PID=$!

# Student frontend
(
  cd artifacts/ninelab
  # Stop Git Bash (MSYS2) from converting a lone "/" into C:\Program Files\Git
  export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' MSYS2_ENV_CONV_EXCL='*'
  export PORT=5000 BASE_PATH=/
  pnpm run dev
) &
FE_PID=$!

trap 'kill $API_PID $FE_PID 2>/dev/null' EXIT INT TERM
echo ""
echo "API:      http://localhost:3001/api/healthz"
echo "Frontend: http://localhost:5000"
wait

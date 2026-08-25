#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# One-command launcher: PostgreSQL check + Backend + Frontend
#
#   ./run.sh        → starts everything, Ctrl+C stops all
# ──────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
mkdir -p logs

# 1) Make sure PostgreSQL is running
if ! pg_isready --quiet 2>/dev/null; then
    echo "▸ Starting PostgreSQL…"
    sudo service postgresql start || echo "⚠ Could not start PostgreSQL - start it manually!"
fi

cleanup() {
    echo ""
    echo "▸ Stopping servers…"
    kill ${BACKEND_PID:-} ${FRONTEND_PID:-} 2>/dev/null
}
trap cleanup EXIT INT TERM

# 2) Backend (FastAPI on :8001)
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "▸ Backend  starting (pid $BACKEND_PID)…"

# 3) Frontend (Vite on :5173)
(cd frontend && npm run dev) > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "▸ Frontend starting (pid $FRONTEND_PID)…"

sleep 3
echo ""
echo "─────────────────────────────────────────────────"
echo "  Frontend → http://localhost:5173"
echo "  API      → http://127.0.0.1:8001"
echo "  Swagger  → http://127.0.0.1:8001/docs"
echo "  Logs     → logs/backend.log · logs/frontend.log"
echo "  Stop     → Ctrl+C"
echo "─────────────────────────────────────────────────"

wait

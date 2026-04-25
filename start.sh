#!/usr/bin/env bash
# Start the full app: FastAPI backend + Vite frontend.
# Kills any previous sessions on the same ports first.
# Use Ctrl+C to stop both.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$LOG_DIR"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
HOST="${HOST:-localhost}"

mkdir -p "$LOG_DIR"

c_info()  { printf "\033[1;36m[start]\033[0m %s\n" "$*"; }
c_warn()  { printf "\033[1;33m[start]\033[0m %s\n" "$*"; }
c_err()   { printf "\033[1;31m[start]\033[0m %s\n" "$*" >&2; }
c_ok()    { printf "\033[1;32m[start]\033[0m %s\n" "$*"; }

kill_port() {
  local port="$1" label="$2" pids attempts=0 announced=0
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  while true; do
    # `lsof` exits non-zero when nothing matches; swallow it explicitly so the
    # surrounding `set -euo pipefail` does not abort the whole script.
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    pids="$(echo "$pids" | tr '\n' ' ')"
    pids="${pids%% }"
    pids="${pids## }"
    if [[ -z "$pids" ]]; then
      return 0
    fi
    if [[ "$announced" -eq 0 ]]; then
      c_warn "Killing existing $label process(es) on :$port -> $pids"
      announced=1
    fi
    # SIGKILL straight away because uvicorn --reload watcher can respawn
    # workers between SIGTERM and a follow-up SIGKILL.
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
    sleep 0.3
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 15 ]]; then
      c_err "Could not free :$port after $attempts attempts (still: $pids)"
      return 1
    fi
  done
}

kill_pidfile() {
  local file="$1" label="$2" pid
  [[ -f "$file" ]] || return 0
  pid="$(cat "$file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    c_warn "Killing previous $label process group (pid=$pid)"
    # Send to the whole process group first, then to the leader as a fallback.
    kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    sleep 0.5
    kill -KILL -- -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
}

cleanup() {
  local exit_code=$?
  echo
  c_info "Shutting down..."
  kill_pidfile "$PID_DIR/backend.pid" "backend"
  kill_pidfile "$PID_DIR/frontend.pid" "frontend"
  kill_port "$BACKEND_PORT" "backend"
  kill_port "$FRONTEND_PORT" "frontend"
  exit "$exit_code"
}
trap cleanup INT TERM EXIT

c_info "Killing previous sessions (if any)..."
kill_pidfile "$PID_DIR/backend.pid" "backend"
kill_pidfile "$PID_DIR/frontend.pid" "frontend"
kill_port "$BACKEND_PORT" "backend"
kill_port "$FRONTEND_PORT" "frontend"

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  c_warn "Missing $BACKEND_DIR/.venv. Creating it..."
  python3 -m venv "$BACKEND_DIR/.venv"
fi

# Keep backend deps in sync with requirements.txt. Skip the (slow) pip call
# when the marker file is newer than requirements.txt.
PY_REQ="$BACKEND_DIR/requirements.txt"
PY_MARKER="$BACKEND_DIR/.venv/.requirements.installed"
if [[ ! -f "$PY_MARKER" || "$PY_REQ" -nt "$PY_MARKER" ]]; then
  c_info "Syncing backend Python deps from requirements.txt..."
  (
    cd "$BACKEND_DIR"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r requirements.txt
  )
  touch "$PY_MARKER"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  c_warn "frontend/node_modules missing; running 'npm install' first..."
  (cd "$FRONTEND_DIR" && npm install)
fi

c_info "Starting backend on http://${HOST}:${BACKEND_PORT}"
(
  cd "$BACKEND_DIR"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec python -m uvicorn app.main:app --reload --host "$HOST" --port "$BACKEND_PORT"
) >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$PID_DIR/backend.pid"
c_ok   "  backend pid=$BACKEND_PID  log=$LOG_DIR/backend.log"

c_info "Starting frontend on http://${HOST}:${FRONTEND_PORT}"
(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" --strictPort
) >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$PID_DIR/frontend.pid"
c_ok   "  frontend pid=$FRONTEND_PID  log=$LOG_DIR/frontend.log"

echo
c_ok "Backend:  http://${HOST}:${BACKEND_PORT}/docs"
c_ok "Frontend: http://${HOST}:${FRONTEND_PORT}"
c_info "Tail logs: tail -f $LOG_DIR/backend.log $LOG_DIR/frontend.log"
c_info "Press Ctrl+C to stop both."

# If either process dies, take the whole script down so cleanup runs.
# (Uses a polling loop instead of `wait -n` for compatibility with the
# bash 3.2 that ships with macOS.)
EXITED_NAME=""
EXITED_STATUS=0
while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    EXITED_NAME="backend"
    wait "$BACKEND_PID" 2>/dev/null || true
    EXITED_STATUS=$?
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    EXITED_NAME="frontend"
    wait "$FRONTEND_PID" 2>/dev/null || true
    EXITED_STATUS=$?
    break
  fi
  sleep 1
done

c_err "$EXITED_NAME exited (status=$EXITED_STATUS); shutting down the other."
exit "$EXITED_STATUS"

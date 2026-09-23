#!/usr/bin/env bash
# Local preview server for the static site (python http.server on 127.0.0.1).
# Usage: ./manage-service.sh {start|stop|restart|status|help}   (PORT env, default 8000)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8000}"
HOST="127.0.0.1"
STATE_DIR="$ROOT_DIR/.preview"
PID_FILE="$STATE_DIR/server.pid"
LOG_FILE="$STATE_DIR/server.log"
URL="http://$HOST:$PORT/"
START_TIMEOUT_SECS=10
STOP_TIMEOUT_SECS=5

if [[ -x /opt/anaconda3/bin/python ]]; then
  PYTHON=/opt/anaconda3/bin/python
else
  PYTHON=python3
fi

usage() {
  cat <<EOF
Usage: $(basename "$0") {start|stop|restart|status|help}

  start    Serve the repo root at $URL in the background
  stop     Stop the server recorded in $PID_FILE
  restart  stop + start
  status   Show whether the server is running
  help     Show this message

Environment:
  PORT     Port to bind on $HOST (default 8000)

Logs: $LOG_FILE
EOF
}

validate_port() {
  if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
    echo "Error: invalid PORT '$PORT'" >&2
    exit 1
  fi
}

# Prints the PID from the PID file if that process is alive; returns 1 otherwise.
running_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(tr -d '[:space:]' < "$PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  echo "$pid"
}

clear_stale_pid() {
  if [[ -f "$PID_FILE" ]] && ! running_pid >/dev/null; then
    rm -f "$PID_FILE"
    echo "Removed stale PID file."
  fi
}

port_busy() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

print_hints() {
  echo "Preview: $URL"
  echo "  English:  ${URL}?lang=en"
  echo "  Chinese:  ${URL}?lang=zh"
  echo "  Pages:    ${URL}movies.html  ${URL}travel.html"
}

cmd_start() {
  validate_port
  local pid
  if pid="$(running_pid)"; then
    echo "Already running (PID $pid) at $URL" >&2
    exit 1
  fi
  clear_stale_pid
  if port_busy; then
    echo "Error: port $PORT is already in use:" >&2
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2 || true
    exit 1
  fi

  mkdir -p "$STATE_DIR"
  nohup "$PYTHON" -m http.server "$PORT" --bind "$HOST" --directory "$ROOT_DIR" \
    >>"$LOG_FILE" 2>&1 </dev/null &
  pid=$!
  echo "$pid" > "$PID_FILE"

  local waited=0
  until curl -fsS -o /dev/null "$URL" 2>/dev/null; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Error: server exited during startup; see $LOG_FILE" >&2
      tail -n 20 "$LOG_FILE" >&2 || true
      exit 1
    fi
    if (( waited >= START_TIMEOUT_SECS * 10 )); then
      kill "$pid" 2>/dev/null || true
      rm -f "$PID_FILE"
      echo "Error: server did not respond within ${START_TIMEOUT_SECS}s; see $LOG_FILE" >&2
      exit 1
    fi
    sleep 0.1
    waited=$((waited + 1))
  done

  echo "Started (PID $pid) with $PYTHON"
  print_hints
}

cmd_stop() {
  local pid
  if ! pid="$(running_pid)"; then
    clear_stale_pid
    echo "Not running."
    return 0
  fi

  kill "$pid"
  local waited=0
  while kill -0 "$pid" 2>/dev/null; do
    if (( waited >= STOP_TIMEOUT_SECS * 10 )); then
      echo "Process $pid did not exit after SIGTERM; sending SIGKILL" >&2
      kill -9 "$pid" 2>/dev/null || true
      sleep 0.2
      break
    fi
    sleep 0.1
    waited=$((waited + 1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    echo "Error: failed to stop process $pid" >&2
    exit 1
  fi
  rm -f "$PID_FILE"
  echo "Stopped (PID $pid)."
}

cmd_status() {
  local pid
  if pid="$(running_pid)"; then
    echo "Running (PID $pid) at $URL"
    echo "Log: $LOG_FILE"
  else
    clear_stale_pid
    echo "Not running."
    if port_busy; then
      echo "Note: port $PORT is in use by another process."
    fi
  fi
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  help | -h | --help) usage ;;
  "") usage ;;
  *) echo "Unknown command: $1" >&2; usage >&2; exit 1 ;;
esac

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.production.yml}"
PROFILES="${COMPOSE_PROFILES:-dashboard,monitoring,fun}"

IFS=',' read -ra PROFILE_LIST <<< "$PROFILES"
COMPOSE_ARGS=(-f "$COMPOSE_FILE")
for profile in "${PROFILE_LIST[@]}"; do
  trimmed="${profile//[[:space:]]/}"
  [ -n "$trimmed" ] && COMPOSE_ARGS+=(--profile "$trimmed")
done

cd "$ROOT_DIR"

log() {
  printf '%s [watchdog] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

is_running() {
  local service="$1"
  local cid
  cid="$(docker compose "${COMPOSE_ARGS[@]}" ps -q "$service" 2>/dev/null | head -n 1)"
  if [ -z "$cid" ]; then
    return 1
  fi
  [ "$(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || true)" = "running" ]
}

check_from_bot() {
  local url="$1"
  docker exec chopsticks-bot node -e "fetch('$url').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1));"
}

recover_stack() {
  log "health check failed; applying targeted recovery"
  docker compose "${COMPOSE_ARGS[@]}" up -d bot agents dashboard funhub prometheus grafana >/dev/null 2>&1 || true
  docker compose "${COMPOSE_ARGS[@]}" restart bot agents dashboard funhub prometheus grafana >/dev/null 2>&1 || true
}

# Ensure baseline services are up.
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis lavalink bot agents >/dev/null

failures=()

if ! is_running bot; then
  failures+=("bot-not-running")
else
  check_from_bot "http://127.0.0.1:8080/healthz" || failures+=("bot-healthz")
fi

if is_running dashboard; then
  check_from_bot "http://dashboard:8788/health" || failures+=("dashboard-health")
fi

if is_running funhub; then
  check_from_bot "http://funhub:8790/health" || failures+=("funhub-health")
fi

if is_running prometheus; then
  check_from_bot "http://prometheus:9090/-/healthy" || failures+=("prometheus-health")
fi

if is_running grafana; then
  check_from_bot "http://grafana:3000/api/health" || failures+=("grafana-health")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  log "detected failures: ${failures[*]}"
  recover_stack
  sleep 10

  # Post-recovery gate: bot health is mandatory.
  if ! check_from_bot "http://127.0.0.1:8080/healthz"; then
    log "recovery failed: bot healthz still not 200"
    exit 1
  fi

  log "recovery completed"
  exit 0
fi

log "all checks passed"

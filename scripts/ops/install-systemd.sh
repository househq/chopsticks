#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-chopsticks}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
RUN_USER="${RUN_USER:-$(id -un)}"
RUN_GROUP="${RUN_GROUP:-$(id -gn)}"
COMPOSE_PROFILES="${COMPOSE_PROFILES:-dashboard,monitoring,fun}"

SUDO=""
if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  SUDO="sudo"
fi

service_unit="$SYSTEMD_DIR/${SERVICE_NAME}.service"
watchdog_service_unit="$SYSTEMD_DIR/${SERVICE_NAME}-watchdog.service"
watchdog_timer_unit="$SYSTEMD_DIR/${SERVICE_NAME}-watchdog.timer"

echo "[install] writing $service_unit"
$SUDO tee "$service_unit" >/dev/null <<UNIT
[Unit]
Description=Chopsticks Discord Platform (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$ROOT_DIR
Environment=COMPOSE_PROFILES=$COMPOSE_PROFILES
ExecStart=/usr/bin/env bash -lc 'cd $ROOT_DIR && ./scripts/start.sh'
ExecStop=/usr/bin/env bash -lc 'cd $ROOT_DIR && ./scripts/ops/chopsticksctl.sh down'
ExecReload=/usr/bin/env bash -lc 'cd $ROOT_DIR && ./scripts/ops/chopsticksctl.sh up'
TimeoutStartSec=240
TimeoutStopSec=180

[Install]
WantedBy=multi-user.target
UNIT

echo "[install] writing $watchdog_service_unit"
$SUDO tee "$watchdog_service_unit" >/dev/null <<UNIT
[Unit]
Description=Chopsticks Platform Watchdog
After=${SERVICE_NAME}.service
Requires=${SERVICE_NAME}.service

[Service]
Type=oneshot
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$ROOT_DIR
Environment=COMPOSE_PROFILES=$COMPOSE_PROFILES
ExecStart=/usr/bin/env bash -lc 'cd $ROOT_DIR && ./scripts/ops/chopsticks-watchdog.sh'
UNIT

echo "[install] writing $watchdog_timer_unit"
$SUDO tee "$watchdog_timer_unit" >/dev/null <<UNIT
[Unit]
Description=Run Chopsticks watchdog every 2 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
AccuracySec=30s
Persistent=true
Unit=${SERVICE_NAME}-watchdog.service

[Install]
WantedBy=timers.target
UNIT

echo "[install] reloading systemd"
$SUDO systemctl daemon-reload

echo "[install] enabling ${SERVICE_NAME}.service"
$SUDO systemctl enable --now "${SERVICE_NAME}.service"

echo "[install] enabling ${SERVICE_NAME}-watchdog.timer"
$SUDO systemctl enable --now "${SERVICE_NAME}-watchdog.timer"

echo "[install] complete"
echo "[install] service status: systemctl status ${SERVICE_NAME}.service --no-pager"
echo "[install] timer status: systemctl status ${SERVICE_NAME}-watchdog.timer --no-pager"

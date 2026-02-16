#!/usr/bin/env bash
set -euo pipefail

# Compatibility entrypoint (docs + systemd). The canonical "one-click" path is:
#   ./scripts/ops/chopsticksctl.sh up

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

exec ./scripts/ops/chopsticksctl.sh up

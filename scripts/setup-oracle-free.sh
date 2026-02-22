#!/usr/bin/env bash
# setup-oracle-free.sh — One-shot Chopsticks setup on Oracle Cloud Free Tier (A1 ARM64)
#
# Run as root (or with sudo) on a fresh Oracle Linux 8 or Ubuntu 22.04 instance:
#   curl -fsSL https://raw.githubusercontent.com/your-org/chopsticks/main/scripts/setup-oracle-free.sh | sudo bash
#
# Or after cloning:
#   sudo bash scripts/setup-oracle-free.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()     { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

# ── Detect OS ──────────────────────────────────────────────────────────────────
detect_os() {
  if   [[ -f /etc/oracle-release ]]; then echo "oracle"
  elif [[ -f /etc/os-release ]] && grep -q 'Ubuntu' /etc/os-release; then echo "ubuntu"
  else die "Unsupported OS. Run on Oracle Linux 8+ or Ubuntu 22.04+."; fi
}
OS=$(detect_os)
info "Detected OS: $OS"

# ── Install Docker ─────────────────────────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    success "Docker already installed: $(docker --version)"; return
  fi
  info "Installing Docker..."
  if [[ $OS == "ubuntu" ]]; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif [[ $OS == "oracle" ]]; then
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo -y 2>/dev/null || true
    dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
  fi
  success "Docker installed: $(docker --version)"
}

install_misc() {
  info "Installing curl, git, openssl..."
  if [[ $OS == "ubuntu" ]]; then
    apt-get install -y -qq git curl openssl jq
  elif [[ $OS == "oracle" ]]; then
    dnf install -y git curl openssl jq
  fi
}

# ── Oracle VCN + iptables firewall rules ──────────────────────────────────────
# Oracle Cloud blocks traffic at two layers:
#   1. VCN Security List (configure in OCI Console — see FREE_HOSTING.md)
#   2. iptables on the instance (managed here)
# We only open the ports the bot actually needs outbound-reachable from Discord.
configure_firewall() {
  info "Configuring iptables (Oracle Cloud instances use iptables, not ufw by default)..."

  if [[ $OS == "ubuntu" ]]; then
    # Ubuntu 22.04 on Oracle uses iptables too; disable ufw if active
    ufw --force disable 2>/dev/null || true
  fi

  # Allow established / related
  iptables -I INPUT  1 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
  iptables -I OUTPUT 1 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true

  # SSH — keep it open
  iptables -I INPUT 2 -p tcp --dport 22 -j ACCEPT 2>/dev/null || true

  # Docker internal bridge (needs to remain open for inter-container comms)
  iptables -I FORWARD 1 -i docker0 -j ACCEPT 2>/dev/null || true
  iptables -I FORWARD 1 -o docker0 -j ACCEPT 2>/dev/null || true

  # Optionally expose a health endpoint if you wire a reverse proxy later
  # iptables -I INPUT 3 -p tcp --dport 80  -j ACCEPT
  # iptables -I INPUT 4 -p tcp --dport 443 -j ACCEPT

  # Persist rules
  if [[ $OS == "ubuntu" ]]; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent
    netfilter-persistent save
  elif [[ $OS == "oracle" ]]; then
    service iptables save 2>/dev/null || iptables-save > /etc/sysconfig/iptables
  fi

  success "Firewall configured."
}

# ── Clone / locate repo ───────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/chopsticks}"
setup_repo() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Repo already at $INSTALL_DIR — pulling latest..."
    git -C "$INSTALL_DIR" pull --ff-only || warn "git pull failed; continuing with existing code."
  elif [[ -d "$INSTALL_DIR" ]]; then
    info "Directory $INSTALL_DIR exists but is not a git repo — assuming code is already present."
  else
    # Prompt for repo URL if not set
    REPO_URL="${REPO_URL:-}"
    if [[ -z "$REPO_URL" ]]; then
      read -rp "Enter your Chopsticks git repo URL (or press Enter to skip): " REPO_URL
    fi
    if [[ -n "$REPO_URL" ]]; then
      git clone "$REPO_URL" "$INSTALL_DIR"
    else
      die "No repo URL provided. Copy your code to $INSTALL_DIR and re-run."
    fi
  fi
  success "Code at $INSTALL_DIR"
}

# ── Generate .env ─────────────────────────────────────────────────────────────
generate_env() {
  cd "$INSTALL_DIR"
  if [[ -f .env ]]; then
    warn ".env already exists — skipping generation. Edit it manually if needed."
    return
  fi

  info "Generating .env from .env.example..."
  [[ -f .env.example ]] || die "No .env.example found in $INSTALL_DIR."
  cp .env.example .env

  # Auto-generate secrets
  AGENT_TOKEN_KEY=$(openssl rand -hex 32)
  AGENT_RUNNER_SECRET=$(openssl rand -hex 32)
  DASHBOARD_SESSION_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  LAVALINK_PASSWORD=$(openssl rand -hex 16)
  DEV_API_PASSWORD=$(openssl rand -hex 20)

  sed -i "s|AGENT_TOKEN_KEY=.*|AGENT_TOKEN_KEY=${AGENT_TOKEN_KEY}|" .env
  sed -i "s|AGENT_RUNNER_SECRET=.*|AGENT_RUNNER_SECRET=${AGENT_RUNNER_SECRET}|" .env
  sed -i "s|DASHBOARD_SESSION_SECRET=.*|DASHBOARD_SESSION_SECRET=${DASHBOARD_SESSION_SECRET}|" .env
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  sed -i "s|LAVALINK_PASSWORD=.*|LAVALINK_PASSWORD=${LAVALINK_PASSWORD}|" .env
  sed -i "s|DEV_API_PASSWORD=.*|DEV_API_PASSWORD=${DEV_API_PASSWORD}|" .env

  # Update connection strings with new password
  sed -i "s|postgresql://chopsticks:chopsticks@|postgresql://chopsticks:${POSTGRES_PASSWORD}@|g" .env
  sed -i "s|LAVALINK_PASSWORD=youshallnotpass|LAVALINK_PASSWORD=${LAVALINK_PASSWORD}|" .env

  success ".env generated. You still need to fill in:"
  echo ""
  echo "   DISCORD_TOKEN=         (your bot token from discord.com/developers)"
  echo "   CLIENT_ID=             (your bot's application ID)"
  echo "   BOT_OWNER_IDS=         (your Discord user ID)"
  echo ""
  echo "   Edit: nano $INSTALL_DIR/.env"
}

# ── Enable Docker swap accounting (required for mem_limit) ────────────────────
enable_swap_accounting() {
  if [[ $OS == "ubuntu" ]]; then
    GRUB_FILE=/etc/default/grub
    if ! grep -q "cgroup_enable=memory" "$GRUB_FILE" 2>/dev/null; then
      info "Enabling cgroup memory accounting for Docker mem_limit..."
      sed -i 's/GRUB_CMDLINE_LINUX="/GRUB_CMDLINE_LINUX="cgroup_enable=memory swapaccount=1 /' "$GRUB_FILE"
      update-grub 2>/dev/null || true
      warn "Reboot required for mem_limit to take effect. Bot will still start without it."
    fi
  fi
}

# ── Run migrations ────────────────────────────────────────────────────────────
run_migrations() {
  cd "$INSTALL_DIR"
  info "Starting postgres temporarily to run migrations..."
  docker compose -f docker-compose.free.yml up -d postgres
  sleep 8
  info "Running database migrations..."
  docker compose -f docker-compose.free.yml run --rm \
    -e STORAGE_DRIVER=postgres \
    bot node scripts/migrate.js 2>/dev/null || \
  docker run --rm --network chopsticks_chopsticks \
    --env-file .env \
    -e STORAGE_DRIVER=postgres \
    "$(docker compose -f docker-compose.free.yml images -q bot 2>/dev/null | head -1)" \
    node scripts/migrate.js 2>/dev/null || \
  warn "Migration step skipped — run manually: docker compose -f docker-compose.free.yml run --rm bot node scripts/migrate.js"
}

# ── Start the stack ───────────────────────────────────────────────────────────
start_stack() {
  cd "$INSTALL_DIR"
  info "Building and starting Chopsticks..."
  docker compose -f docker-compose.free.yml build --no-cache
  docker compose -f docker-compose.free.yml up -d
  success "Stack started!"
}

# ── Print status ──────────────────────────────────────────────────────────────
print_status() {
  cd "$INSTALL_DIR"
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN} Chopsticks is running on Oracle Cloud Free Tier! 🥢${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  docker compose -f docker-compose.free.yml ps
  echo ""
  echo "Useful commands:"
  echo "  Logs:     docker compose -f docker-compose.free.yml logs -f bot"
  echo "  Restart:  docker compose -f docker-compose.free.yml restart bot"
  echo "  Stop:     docker compose -f docker-compose.free.yml down"
  echo "  Update:   git pull && docker compose -f docker-compose.free.yml up -d --build"
  echo ""
  warn "If the bot token or CLIENT_ID is not set, edit .env and restart:"
  echo "  nano $INSTALL_DIR/.env"
  echo "  docker compose -f docker-compose.free.yml restart bot agents"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN} Chopsticks — Oracle Cloud Free Tier Setup${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  install_misc
  install_docker
  configure_firewall
  enable_swap_accounting
  setup_repo
  generate_env
  start_stack
  print_status
}

main "$@"

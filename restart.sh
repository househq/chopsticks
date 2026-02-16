#!/usr/bin/env bash

# Chopsticks Docker Restart Script
# Handles graceful restart with proper startup sequencing

set -euo pipefail

COMPOSE_FILE="docker-compose.production.yml"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -x "$SCRIPT_DIR/scripts/ops/chopsticksctl.sh" ]; then
  # Prefer the unified control entrypoint to avoid drift.
  exec "$SCRIPT_DIR/scripts/ops/chopsticksctl.sh" "${1:-up}" "${2:-}"
fi

echo "═══════════════════════════════════════════════════════════════"
echo "🔄 Chopsticks Docker Restart Script"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: $COMPOSE_FILE not found in current directory"
    echo "Run this script from the Chopsticks root directory"
    exit 1
fi

# Parse arguments
ACTION="${1:-full}"
FORCE="${2:-}"

case "$ACTION" in
    full|stop|start|restart|logs|status)
        ;;
    *)
        echo "Usage: $0 {full|stop|start|restart|logs|status} [force]"
        echo ""
        echo "Commands:"
        echo "  full      Stop all services, wait, then start (default)"
        echo "  stop      Graceful shutdown"
        echo "  start     Start all services"
        echo "  restart   Restart services without full stop"
        echo "  logs      Show real-time logs"
        echo "  status    Check service status"
        echo ""
        exit 1
        ;;
esac

# Function to show spinner
spinner() {
    local pid=$!
    local spin='-\|/'
    local i=0
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r${spin:$i:1} $1"
        sleep .1
    done
    printf "\r✓ $1\n"
}

# Function to check health
check_health() {
    echo ""
    echo "📊 Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps --services --status=running
    echo ""
    
    # Check bot readiness
    if docker-compose -f "$COMPOSE_FILE" logs bot 2>/dev/null | grep -q "Ready as"; then
        echo "✅ Bot is online"
    else
        echo "⏳ Bot starting..."
    fi
    
    # Check agents readiness
    if docker-compose -f "$COMPOSE_FILE" logs agents 2>/dev/null | grep -q "polling"; then
        echo "✅ Agent runner is ready"
    else
        echo "⏳ Agent runner starting..."
    fi
}

# Execute action
case "$ACTION" in
    stop)
        echo "🛑 Stopping services gracefully..."
        docker-compose -f "$COMPOSE_FILE" down 2>&1 | sed 's/^/   /'
        echo "✅ Stopped"
        ;;
    
    start)
        echo "🚀 Starting services..."
        docker-compose -f "$COMPOSE_FILE" up -d 2>&1 | sed 's/^/   /'
        echo ""
        echo "⏳ Waiting for services to be ready... (this may take 30-60 seconds)"
        sleep 15
        check_health
        ;;
    
    restart)
        echo "🔄 Restarting services..."
        docker-compose -f "$COMPOSE_FILE" restart 2>&1 | sed 's/^/   /'
        echo ""
        echo "⏳ Waiting for services to be ready... (this may take 10-30 seconds)"
        sleep 10
        check_health
        ;;
    
    full)
        echo "🛑 Stopping all services..."
        docker-compose -f "$COMPOSE_FILE" down 2>&1 | sed 's/^/   /'
        
        echo "⏳ Waiting 5 seconds..."
        sleep 5
        
        echo "🚀 Starting all services..."
        docker-compose -f "$COMPOSE_FILE" up -d 2>&1 | sed 's/^/   /'
        
        echo ""
        echo "⏳ Waiting for services to be ready... (this may take 30-60 seconds)"
        sleep 20
        
        echo ""
        echo "🔍 Initial status check..."
        docker-compose -f "$COMPOSE_FILE" ps
        
        echo ""
        echo "⏳ Waiting additional 10 seconds for full initialization..."
        sleep 10
        
        check_health
        
        echo ""
        echo "✅ Restart complete! Services should be online."
        echo ""
        echo "Next steps:"
        echo "  • Check detailed logs: $0 logs"
        echo "  • Run test command: /test-chopsticks or /agents status"
        echo "  • Monitor progress: $0 logs"
        ;;
    
    logs)
        echo "📋 Real-time logs (Ctrl+C to exit):"
        echo ""
        docker-compose -f "$COMPOSE_FILE" logs -f --tail=50
        ;;
    
    status)
        echo "📊 Service Status:"
        docker-compose -f "$COMPOSE_FILE" ps
        check_health
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════════"

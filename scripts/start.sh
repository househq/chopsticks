#!/bin/bash
# Unified startup script for Chopsticks platform
# One-command bring-up from clean machine

set -e

echo "🥢 Starting Chopsticks Platform..."

# Detect environment
if [ -f "docker-compose.production.yml" ]; then
  COMPOSE_FILE="docker-compose.production.yml"
elif [ -f "docker-compose.yml" ]; then
  COMPOSE_FILE="docker-compose.yml"
else
  echo "❌ No docker-compose file found"
  exit 1
fi

echo "Using compose file: $COMPOSE_FILE"

# Check prerequisites
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not installed"
  exit 1
fi

if ! command -v docker compose &> /dev/null; then
  echo "❌ Docker Compose not installed"
  exit 1
fi

# Check .env file
if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found"
  if [ -f ".env.example" ]; then
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo "⚠️  Please configure .env and run again"
    exit 1
  else
    echo "❌ No .env.example found"
    exit 1
  fi
fi

# Start services
echo "Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check health
HEALTH_URL="http://localhost:8080/health"
MAX_WAIT=60

for i in $(seq 1 $MAX_WAIT); do
  if curl -f -s "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✅ Platform is ready!"
    echo ""
    echo "Services:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "Health: $HEALTH_URL"
    echo "Dashboard: http://localhost:3003"
    echo "Metrics: http://localhost:8080/metrics"
    echo ""
    echo "View logs: docker logs chopsticks-bot -f"
    exit 0
  fi
  
  if [ $i -eq $MAX_WAIT ]; then
    echo "❌ Platform did not become ready in time"
    echo "Check logs: docker logs chopsticks-bot"
    exit 1
  fi
  
  sleep 1
done

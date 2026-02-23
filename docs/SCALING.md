# Scaling Guide — 200,000 Daily Active Users

This document covers everything needed to operate Chopsticks at large scale.
All infrastructure changes are already wired in code; this is the operator runbook.

---

## Architecture Overview at Scale

```
                    ┌─────────────────────┐
                    │   Discord Gateway   │
                    └──────────┬──────────┘
                               │  WebSocket (per shard)
             ┌─────────────────┼─────────────────┐
             │                 │                 │
        Shard 0           Shard 1 … N       Shard N+1
      (index.js)         (index.js)         (index.js)
             │                 │                 │
             └─────────────────┴─────────────────┘
                               │
                        ┌──────┴──────┐
                        │  PgBouncer  │  ← transaction-mode pooler
                        │ pool=25/shard│
                        └──────┬──────┘
                               │
                        ┌──────┴──────┐
                        │ PostgreSQL  │  max_connections=200
                        └─────────────┘
                               │
                        ┌──────┴──────┐
                        │    Redis    │  ← L2 cache (60s guild TTL)
                        └─────────────┘
                               │ (in-process)
                        ┌──────┴──────┐
                        │  LRU Cache  │  ← L1 cache (2000 guilds, 60s)
                        └─────────────┘
```

---

## Shard Count Formula

Discord requires **1 shard per 2,500 guilds**. With Discord's gateway rate limit
(1,000 identify requests per 5 seconds), the practical rule of thumb:

```
shards = ceil(guild_count / 2000)    # conservative
```

Set via environment variable:

```env
DISCORD_SHARDS=auto   # Let discord.js calculate (recommended for < 150k guilds)
DISCORD_SHARDS=8      # Manual override (e.g. for 16,000+ guilds)
```

At **200k DAU** you likely need **4–8 shards** (assuming ~10k–20k guilds).
Each shard runs as a separate Node.js process under the `ShardingManager`.

### Shard spawning

```bash
npm run start:shard          # uses src/shard.js (ShardingManager)
# OR use ecosystem.config.cjs (PM2):
pm2 start ecosystem.config.cjs
```

---

## Database Connection Pooling (PgBouncer)

**Required** for > 5k guilds or any horizontal scaling.

### Why

Each Node.js process opens up to `PG_POOL_MAX` (default 10) persistent
connections to PostgreSQL. With 4 shards + 1 agents runner + 1 dashboard:

```
6 processes × 10 connections = 60 connections baseline
```

Under burst load (Discord rate-limit window, mass join/leave events) this spikes.
`max_connections=200` in PostgreSQL is the hard ceiling.

PgBouncer multiplexes all clients through a small pool:

```
Any number of Node processes → PgBouncer (pool=25) → PostgreSQL (25 connections)
```

### Configuration

In `.env` point the bot at PgBouncer, not PostgreSQL directly:

```env
# Production (via PgBouncer)
POSTGRES_URL=postgres://chopsticks:pass@pgbouncer:5432/chopsticks

# Direct (dev/migration only)
# POSTGRES_URL=postgres://chopsticks:pass@postgres:5432/chopsticks
```

> ⚠️ Run migrations directly against PostgreSQL, not through PgBouncer.
> PgBouncer transaction mode is incompatible with `SET` statements used by migrations.

### Starting PgBouncer

```bash
docker compose -f docker-compose.production.yml up -d pgbouncer
```

---

## In-Process LRU Cache (L1)

Every command that reads guild config hits `loadGuildData()`.
At 200k DAU with ~10k guilds, the hot guilds fit entirely in the LRU:

| Variable | Default | Description |
|---|---|---|
| `LOCAL_CACHE_GUILD_MAX` | 2000 | Max guild entries in LRU |
| `LOCAL_CACHE_GUILD_TTL` | 60000 | TTL in ms (60 s) |
| `LOCAL_CACHE_USER_MAX`  | 5000 | Max user entries in LRU |
| `LOCAL_CACHE_USER_TTL`  | 30000 | TTL in ms (30 s) |

Cache hit rate under normal load: **> 90%** for top guilds.

**Layer order:** LRU (0 ms) → Redis (~0.5 ms) → PostgreSQL (~2–5 ms)

---

## Redis Tuning

For 200k DAU, Redis should be configured with:

```
# docker-compose.production.yml already sets these:
--maxmemory 256mb            # increase from 128mb for scale
--maxmemory-policy allkeys-lru
--appendonly yes
```

For **cross-shard consistency**, all shards share one Redis instance.
If Redis is unavailable, the bot degrades gracefully to PostgreSQL reads.

### Redis Cluster (> 1M DAU)

For truly massive scale, replace single Redis with Redis Cluster:
```bash
# Install ioredis and update cache.js to use cluster mode
npm install ioredis
# Set: REDIS_CLUSTER_NODES=host1:6379,host2:6379,host3:6379
```

---

## Circuit Breakers (External APIs)

All external API commands (`/weather`, `/github`, `/wiki`, etc.) are protected
by `opossum` circuit breakers via `src/utils/externalCircuit.js`.

| Setting | Value | Meaning |
|---|---|---|
| `timeout` | 4500 ms | Abort HTTP call after 4.5 s |
| `errorThresholdPercentage` | 50% | Open after 50% failure rate |
| `resetTimeout` | 30 s | Re-test upstream after 30 s |
| `volumeThreshold` | 5 | Minimum calls before tripping |

When a breaker opens, commands respond instantly with a degraded embed
instead of waiting for a timeout. Upstream recovery is automatic.

View breaker states at runtime:
```js
import { breakerStats } from "./src/utils/externalCircuit.js";
console.log(breakerStats()); // { github: { state: "closed", ... }, ... }
```

---

## Interaction Timeout Guard

Discord's interaction reply window is **3 seconds**.
All deferred interactions in external API commands are wrapped with `withTimeout()`
(`src/utils/interactionTimeout.js`) with a 2.5 s deadline.

If a command hangs past 2.5 s, users see a friendly "Taking longer than expected"
embed instead of the broken "This interaction failed" message.

---

## HTTP Compression

The dashboard server uses `compression` middleware (gzip/deflate).
At scale this reduces JSON API payload sizes by 60–80%.

---

## Performance Targets (200k DAU)

| Metric | Target | How |
|---|---|---|
| P99 interaction latency | < 800 ms | LRU + Redis cache |
| P99 external API commands | < 2500 ms | Circuit breaker + 4.5s timeout |
| Dashboard p99 | < 500 ms | Compression + CDN |
| DB connections at peak | < 50 | PgBouncer transaction pool |
| Bot restart time | < 30 s | Docker restart: unless-stopped |
| Shard recovery | < 60 s | respawn: true, delay: 5.5s |

---

## Load Testing

```bash
# Start the dashboard first
npm run dashboard

# In another terminal:
DASHBOARD_URL=http://localhost:3000 npm run loadtest
```

The load test fires 10 concurrent connections for 10 seconds against
`/health` and `/api/internal/status`, then prints RPS, p99, and error count.
Exits non-zero if p99 > 500 ms.

Tune with env vars:
```env
LOADTEST_DURATION=30       # seconds
LOADTEST_CONNECTIONS=50    # concurrent connections
```

---

## Horizontal Scaling Checklist

- [ ] `POSTGRES_URL` points to PgBouncer, not PostgreSQL directly
- [ ] `REDIS_URL` is reachable from all bot processes
- [ ] `DISCORD_TOKEN` is set; `DISCORD_SHARDS=auto` or manually calculated
- [ ] `PG_POOL_MAX=5` per process (PgBouncer handles multiplexing)
- [ ] `GUILD_CACHE_TTL_SEC=60` (Redis TTL matches LRU TTL)
- [ ] `NODE_ENV=production` (disables dev dashboard, enables structured JSON logs)
- [ ] `LOG_LEVEL=info` (not debug in production)
- [ ] All Lavalink nodes accessible to agent runners
- [ ] Prometheus scraping all bot instances (multi-target via relabeling)
- [ ] Grafana alerts on: shard death, circuit breaker open, p99 > 1s, Redis memory > 80%

---

## Environment Variables (Scale-Relevant)

| Variable | Default | Description |
|---|---|---|
| `DISCORD_SHARDS` | `auto` | Shard count or `auto` |
| `PG_POOL_MAX` | `10` | Max PG connections per process |
| `PG_POOL_MIN` | `2` | Min PG connections per process |
| `GUILD_CACHE_TTL_SEC` | `30` | Redis guild cache TTL |
| `LOCAL_CACHE_GUILD_MAX` | `2000` | LRU max guild entries |
| `LOCAL_CACHE_GUILD_TTL` | `60000` | LRU guild TTL (ms) |
| `LOCAL_CACHE_USER_MAX` | `5000` | LRU max user entries |
| `LOCAL_CACHE_USER_TTL` | `30000` | LRU user TTL (ms) |
| `LOADTEST_DURATION` | `10` | autocannon test duration (s) |
| `LOADTEST_CONNECTIONS` | `10` | autocannon concurrency |

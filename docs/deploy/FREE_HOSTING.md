# Free Hosting Guide

This guide covers two paths to host Chopsticks for **$0/month** forever.

| | Oracle A1 (All-in-One) | Hybrid Free Tier |
|---|---|---|
| **Cost** | $0 forever | $0 forever |
| **Lavalink** | ✅ Runs locally | ⚠️ Needs Oracle A1 or public node |
| **Setup effort** | Medium | High |
| **Best for** | Single server, full control | Experimenting / minimal usage |

---

## Path A — Oracle Cloud Always Free (Recommended)

Oracle's **Always Free** tier includes resources that never expire:

- **1× A1 Ampere ARM VM** — up to 4 OCPUs + 24 GB RAM (free forever)
- **200 GB block storage**
- **10 TB outbound data/month**

This is enough to run every Chopsticks service (bot, agents, Lavalink, Postgres, Redis) on a single machine.

### Step 1 — Create an Oracle Cloud account

1. Go to [cloud.oracle.com](https://cloud.oracle.com) → **Start for free**
2. A credit card is required for identity verification — **you will not be charged** for Always Free resources
3. Choose the **home region** closest to your Discord users (US East / US West / Frankfurt / Singapore) — this cannot be changed later

### Step 2 — Create the A1 instance

1. In the Console, go to **Compute → Instances → Create Instance**
2. Under **Image and shape**:
   - Image: **Ubuntu 22.04** (recommended) or Oracle Linux 8
   - Shape: click **Change shape** → **Ampere** → **VM.Standard.A1.Flex**
   - Set **OCPUs: 4** and **Memory: 24 GB** (maximizes free allocation)
3. Under **Networking**: leave defaults (a VCN + public subnet will be created automatically)
4. Under **Add SSH keys**: paste your public SSH key (generate one with `ssh-keygen -t ed25519` if needed)
5. Click **Create**

> The instance will have a public IP. Note it for step 4.

### Step 3 — Open firewall ports in the OCI Console

Oracle has **two firewalls**: the VCN Security List (cloud-level) and iptables (OS-level). The setup script handles iptables. You must open the VCN rules manually:

1. In the Console, go to **Networking → Virtual Cloud Networks → your VCN → Security Lists → Default Security List**
2. Click **Add Ingress Rules** and add:

   | Stateless | Source CIDR | Protocol | Destination Port | Description |
   |---|---|---|---|---|
   | No | `0.0.0.0/0` | TCP | `22` | SSH |

   > The bot communicates **outbound only** to Discord's API. No inbound ports required for basic operation. If you want a dashboard exposed via HTTPS later, add ports 80 and 443.

3. The setup script opens iptables rules on the instance automatically.

### Step 4 — SSH in and run the setup script

```bash
ssh ubuntu@<your-instance-public-ip>

# One-shot setup (installs Docker, configures firewall, generates secrets, starts everything):
curl -fsSL https://raw.githubusercontent.com/your-org/chopsticks/main/scripts/setup-oracle-free.sh -o setup.sh
sudo bash setup.sh
```

Or if you clone the repo first:

```bash
git clone https://github.com/your-org/chopsticks /opt/chopsticks
cd /opt/chopsticks
sudo bash scripts/setup-oracle-free.sh
```

### Step 5 — Fill in Discord credentials

```bash
nano /opt/chopsticks/.env
```

Set these three values (everything else was auto-generated):

```bash
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
BOT_OWNER_IDS=your_discord_user_id_here
```

Then restart:

```bash
cd /opt/chopsticks
docker compose -f docker-compose.free.yml restart bot agents
docker compose -f docker-compose.free.yml logs -f bot
```

### Step 6 — Register slash commands

```bash
cd /opt/chopsticks
docker compose -f docker-compose.free.yml run --rm bot node src/deploy-commands.js
```

### Step 7 — Deploy agents

In Discord, run:
```
/agents deploy desired_total:10
```

Follow the invite links to add agent bots to your server.

### Day-to-day commands

```bash
cd /opt/chopsticks

# View logs
docker compose -f docker-compose.free.yml logs -f bot
docker compose -f docker-compose.free.yml logs -f agents
docker compose -f docker-compose.free.yml logs -f lavalink

# Restart a service
docker compose -f docker-compose.free.yml restart bot

# Update to latest code
git pull
docker compose -f docker-compose.free.yml up -d --build

# Stop everything
docker compose -f docker-compose.free.yml down

# Check resource usage
docker stats --no-stream
```

### ARM64 compatibility note

The `node:20-slim` base image and all system packages (`libcairo`, `libopus`, `libsodium`, etc.) are available natively for ARM64. The Docker build runs natively on the A1 — no cross-compilation or emulation needed. Build times are fast.

---

## Path B — Hybrid Free Tier (Neon + Upstash + Fly.io)

Use this if you can't get an Oracle A1 instance (they do occasionally have capacity issues in popular regions) or want managed databases.

> **Lavalink caveat**: Fly.io's free machines (256 MB RAM) cannot run Lavalink. For music playback you still need either an Oracle A1 instance running just Lavalink, or a public Lavalink node (see below).

### Services

| Service | Provider | Free Tier |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | 0.5 GB storage, always on, no sleep |
| Redis | [Upstash](https://upstash.com) | 10,000 commands/day, 256 MB, no sleep |
| Bot + Agents | [Fly.io](https://fly.io) | 3 shared VMs, 256 MB RAM each |
| Lavalink | Oracle A1 (1 OCPU, 6 GB) or public node | Free on Oracle |

### Setup

#### 1. PostgreSQL — Neon

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project → copy the **Connection String** (format: `postgresql://user:pass@host/db?sslmode=require`)
3. Set in `.env`:
   ```bash
   DATABASE_URL=postgresql://...your-neon-url...
   POSTGRES_URL=postgresql://...your-neon-url...
   ```

#### 2. Redis — Upstash

1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database → copy the **Redis URL** (format: `redis://:password@host:port`)
3. Set in `.env`:
   ```bash
   REDIS_URL=redis://:password@your-upstash-host:port
   ```

> **Rate limit**: Upstash free tier allows 10,000 commands/day. A busy server with many users may hit this. Monitor usage in the Upstash console; if needed, upgrade to the $10/month plan or use a local Redis on Oracle A1 instead.

#### 3. Lavalink — Oracle A1 (1 OCPU, 6 GB shape)

Run Lavalink-only on a small Oracle A1 instance (you can create up to 4 A1 instances totaling 4 OCPU + 24 GB within the free allocation):

```bash
# On your Oracle A1 instance, run only Lavalink:
docker run -d --name lavalink \
  --restart unless-stopped \
  -e _JAVA_OPTIONS="-Xmx1G -Xms256M" \
  -e SERVER_PORT=2333 \
  -e LAVALINK_SERVER_PASSWORD=your-lavalink-password \
  -v /opt/chopsticks/lavalink/application.yml:/opt/Lavalink/application.yml:ro \
  -p 2333:2333 \
  ghcr.io/lavalink-devs/lavalink:4
```

Then set in `.env`:
```bash
LAVALINK_HOST=<oracle-instance-public-ip>
LAVALINK_PORT=2333
LAVALINK_PASSWORD=your-lavalink-password
```

> Make sure port 2333 is open in your Oracle VCN Security List and iptables.

#### Alternative: Public Lavalink node

Several community-run free Lavalink nodes are available. These are shared infrastructure and may be unreliable or rate-limited. Use only for testing:

```bash
# In .env — example public node (check lavalink.darrennathanael.com for current list):
LAVALINK_HOST=lavalink.darrennathanael.com
LAVALINK_PORT=80
LAVALINK_PASSWORD=youshallnotpass
```

#### 4. Bot + Agents — Fly.io

1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Sign up and log in: `fly auth signup` / `fly auth login`
3. From the repo root:

   ```bash
   # Deploy the main bot
   fly launch --name chopsticks-bot --no-deploy
   # Edit fly.toml — set memory to 512MB, remove http_service section
   fly secrets set DISCORD_TOKEN=... CLIENT_ID=... BOT_OWNER_IDS=... AGENT_TOKEN_KEY=... \
     DATABASE_URL=... REDIS_URL=... STORAGE_DRIVER=postgres \
     LAVALINK_HOST=... LAVALINK_PASSWORD=...
   fly deploy

   # Deploy agents (separate app)
   fly launch --name chopsticks-agents --no-deploy
   fly secrets set ... # same env vars
   fly deploy
   ```

> Fly.io shared VMs (`shared-cpu-1x`) have 256 MB RAM. The bot alone fits; the agent runner is tight. If you hit OOM, use `fly scale memory 512` (still within free allocation if you have credits).

---

## Checking everything works

Once deployed (either path):

```bash
# In Discord:
/ping               # Bot should respond
/music play test    # Should play audio (requires agents deployed and Lavalink running)
/music playlist panel  # Admin: enable user playlists, set hub channel
```

---

## Keeping the free tier free

Oracle A1 instances are free as long as they remain **Always Free eligible**:
- Do not change the shape away from A1 Flex
- Do not attach paid block volumes or other paid services
- Log into the OCI Console at least once every 60 days (or set up billing alerts at $0 cap for peace of mind)

Neon free tier pauses after **5 minutes of inactivity** on the Neon free plan (as of their current policy) but reconnects automatically on the next query. This is fine for a Discord bot since queries happen on each command.

Upstash free tier is always on — no sleep.

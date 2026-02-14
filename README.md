# Chopsticks

Chopsticks is a self-hosted Discord bot built for scale with agent-backed music, VoiceMaster, dashboards, and a modular command system.

**🚨 Currently at Maturity Level 0 - See [MATURITY.md](./MATURITY.md) for platform stability status**

## Highlights
- Agent-backed music (no main-bot audio)
- VoiceMaster join-to-create
- Per-guild music settings (/music settings)
- Slash + prefix commands
- Dashboard with admin controls
- Metrics + health endpoints

## Quick Start

The fastest way to start Chopsticks:

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Discord bot token and other settings
nano .env

# Start everything (one command!)
make start

# Check health
make health

# View logs
make logs
```

See `make help` for all available commands.

## Maturity Model

This project follows a strict **maturity-driven development model** to ensure platform stability before feature expansion.

- **Current Level:** 0 (Running Baseline)
- **Status:** 🔴 In Progress
- **Next Milestone:** Complete Level 0 exit criteria

**Key Rules:**
1. No feature work until Level 0 complete
2. No level advancement without mechanical verification
3. Regressions block all work until fixed

For details, see:
- [MATURITY.md](./MATURITY.md) - Full maturity model with all 9 levels
- [MATURITY_SUMMARY.md](./MATURITY_SUMMARY.md) - Quick reference

## Quickstart (Local Development)
1. Copy env:
   ```bash
   cp .env.example .env
   ```
2. Install:
   ```bash
   npm install
   ```
3. Deploy commands (guild):
   ```bash
   npm run deploy:guild
   ```
4. Start:
   ```bash
   npm run start:all
   ```

## Production (Ubuntu)
See `DEPLOY.md`.

## Operations
- Metrics: `http://<host>:9100/metrics`
- Health: `http://<host>:9100/healthz`

## Repo Layout
- `src/` bot + agents + dashboard
- `scripts/` migrations, deploy scripts
- `docs/` operations, architecture, runbooks

## Support
File issues in GitHub and follow `docs/support.md` for triage and resolution flow.

---

## Voice Tool v1 (Spec Lock)

This repository implements a VoiceMaster-style voice system.
This document defines the behavior contract. Code must obey this contract.

## Core Concepts

### Lobby
A lobby is a persistent voice channel configured by an admin.
It is never created or deleted by the bot automatically.

Purpose:
- Entry point for users
- Trigger for custom channel creation

### Custom Voice Channel
A custom voice channel is a temporary voice channel created by the bot.

Properties:
- Created when a user joins a lobby
- Owned by the joining user
- Placed under the lobby’s configured category
- Deleted automatically when empty

## Lifecycle Rules (Invariant)

1. User joins a lobby  
   → Bot creates a custom voice channel  
   → Bot moves the user into it

2. Additional users may join the custom channel  
   → No new channel is created

3. All users leave a custom channel  
   → Channel is deleted

These rules must always hold.

## Ownership Rules

- The user who triggered creation is the owner
- Ownership is stored in persistent state
- Ownership does not automatically transfer
- Ownership logic is enforced by future features only

## Persistence Rules

The bot persists:
- Lobby configuration
- Active custom channel ownership

The bot does NOT persist:
- Voice members
- Runtime-only Discord state

After a restart:
- Lobbies remain configured
- Orphaned custom channels may exist and must be handled by cleanup logic

## Non-Goals (Explicit)

This version does NOT:
- Rename channels
- Lock channels
- Transfer ownership
- Provide UI beyond slash commands
- Attempt recovery beyond deletion on empty

These are future features and must be additive.

## Stability Contract

Any future change must:
- Preserve all lifecycle rules
- Preserve lobby → custom relationship
- Not introduce multiple command trees
- Not introduce implicit behavior

If behavior changes, this document must change first.

<div align="center">

<h1>🥢 Chopsticks</h1>

<p><strong>A feature-rich Discord bot built for communities — music, moderation, economy, games, and more.</strong></p>

[![License](https://img.shields.io/badge/license-MIT%20%2B%20Fair%20Use-blue?style=flat-square)](LICENSE)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-90%20passing-brightgreen?style=flat-square)](#testing)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

<br/>

[**Invite Chopsticks**](#) · [**Support Server**](#) · [**Report a Bug**](../../issues) · [**Request a Feature**](../../issues)

</div>

---

## ✨ Features

### 🎵 Music
High-quality audio powered by Lavalink with a full playback suite:
- Play from YouTube, Spotify, SoundCloud, and more
- Queue management — shuffle, loop, skip, seek, volume
- `/play`, `/queue`, `/nowplaying`, `/skip`, `/stop`, `/loop`, `/volume`
- Multi-agent voice pool — simultaneous playback across multiple channels

### 🛡️ Moderation
Professional moderation tooling with guardrails built in:
- `/ban`, `/kick`, `/mute`, `/warn`, `/timeout`, `/purge`
- Preview + confirmation before bulk actions
- Filtered purge by user, content, links, attachments, or bots
- Self/owner/hierarchy safety checks on all actions
- Embed-based outputs with audit-trail detail

### 💰 Economy & Progression
A full server economy with persistence:
- `/balance`, `/daily`, `/work`, `/gather` — earn and spend Credits
- `/shop`, `/buy`, `/inventory`, `/vault` — items and collectibles
- `/leaderboard` — server-wide rankings
- `/profile` — per-user progression card with privacy controls

### 🎮 Games & Fun
- `/trivia` — solo, PvP versus, fleet, and agent-duel modes
- `/gather` and `/work` — loot missions with card-image outputs
- `/fun` — interactive fun commands with catalog search
- `/agent chat` — chat with a deployed agent identity

### 🤖 Agent System
Multi-bot voice agent pool managed from a single control bot:
- Pooled agents for parallel voice/music workloads
- Per-guild pool selection and priority routing
- `/agents` — manage agent tokens, pools, and deployment

### 📊 Dashboard & Monitoring
- Web dashboard for server configuration and stats
- Prometheus metrics + Grafana-ready integration
- Live container log viewer (ops profile)

---

## 🚀 Getting Started

> **Note:** Chopsticks is operated by **[goot27](https://github.com/goot27) / [Wok Specialists](https://github.com/wokspec)**. To add it to your server, use the invite link above.
>
> If you'd like to contribute to development, see [Contributing](#contributing) below.

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+

### Quick Setup

```bash
# 1. Clone and install
git clone https://github.com/wokspec/Chopsticks.git
cd Chopsticks
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DISCORD_TOKEN, CLIENT_ID, BOT_OWNER_IDS, POSTGRES_URL, REDIS_URL

# 3. Run migrations
npm run migrate

# 4. Deploy slash commands to your guild
npm run deploy:guild

# 5. Start the bot
npm run start:all
```

See [`docs/deploy/`](docs/deploy/) for full deployment guides.

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Bot framework | [discord.js v14](https://discord.js.org) |
| Audio backend | [Lavalink](https://github.com/lavalink-devs/Lavalink) + [lavalink-client](https://github.com/appellation/lavalink-client) |
| Database | PostgreSQL + [pg](https://github.com/brianc/node-postgres) |
| Cache | Redis + [ioredis](https://github.com/redis/ioredis) |
| Dashboard | Express + Discord OAuth2 |
| Metrics | Prometheus + prom-client |
| Logging | [Pino](https://getpino.io) |

---

## 🧪 Testing

```bash
# Run all unit/contract tests
npm test

# Maturity-level checks
make test-level-0
make test-level-1
make test-protocol
```

90 tests passing across agent protocol, session lifecycle, and deployment contracts.

---

## 📁 Repository Structure

```
src/              Application code (bot, agents, dashboard, utils)
test/             Unit & contract tests
migrations/       Database schema migrations
docs/             Architecture, protocol, schema, operations guides
scripts/          Startup, deployment, and ops helpers
```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- Branch from `main` as `feat/<name>` or `fix/<name>`
- Keep PRs small and focused
- Run `npm test` before submitting
- Follow the existing code style and error-handling patterns

[Open an Issue](../../issues) · [Open a Pull Request](../../pulls)

---

## 📜 License

Chopsticks is released under the **[MIT License with Fair Use Attribution Clause](LICENSE)**.

- ✅ Free for personal and non-commercial use
- ✅ Modify and contribute freely
- ⚠️ Attribution required if revenue > $500/yr or users > 500
- ❌ Cannot be sold or offered as a commercial service without permission

See [LICENSE](LICENSE) for full terms. Also see [TRADEMARKS.md](TRADEMARKS.md) and [SECURITY.md](SECURITY.md).

---

## 🔒 Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

---

<div align="center">

Built with ❤️ by **[goot27](https://github.com/goot27)** · **[Wok Specialists](https://github.com/wokspec)**

</div>

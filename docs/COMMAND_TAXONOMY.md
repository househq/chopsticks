# Chopsticks — Command Taxonomy

> **MAP Cycle 1 — Command Architecture Pod**  
> Status: Active | Last updated: MAP-C1

---

## Locked Slash Command Surface (18 commands)

These 18 slash commands are the **stable, versioned core API**. They are never removed, always globally deployed, and serve as onboarding + navigation anchors.

| Command | Category | Permission | Purpose |
|---------|----------|-----------|---------|
| `/help` | info | Everyone | Unified discoverability hub — slash + prefix by category |
| `/setup` | admin | ManageGuild | Guided server onboarding wizard |
| `/dashboard` | admin | ManageGuild | Admin JWT link to web dashboard |
| `/config` | admin | ManageGuild | Bot config read/write |
| `/agents` | agents | ManageGuild | Agent pool management |
| `/pools` | agents | ManageGuild | Pool creation/management |
| `/agentkeys` | ai | ManageGuild | BYOK API key link/unlink/status |
| `/mod` | mod | ModerateMembers | Ban/kick/mute/warn dispatch |
| `/antinuke` | safety | Administrator | Antinuke configuration |
| `/tickets` | tools | ManageGuild/Everyone | Ticket system config + open |
| `/music` | music | Everyone | Music controls (play/stop/queue) |
| `/voice` | voice | ManageChannels | Voice lobby controls |
| `/ai` | ai | Everyone | AI token config + agent chat |
| `/verify` | safety | Everyone | Member verification flow |
| `/profile` | social | Everyone | User profile card |
| `/levels` | social | Everyone | XP leaderboard |
| `/game` | game | Everyone | Game hub panel (economy portal) |
| `/stats` | info | Everyone | Bot + server statistics |

### Why only 18?
Discord slash commands have a **100-command limit per bot**. More importantly:
- Users remember ≤10 commands they use regularly
- Every slash command is a maintenance commitment
- Slash commands require Discord API registration (rate-limited)
- The prefix surface handles power-user complexity

---

## Canonical Category Enum

All `meta.category` values in command modules MUST use one of:

| Category | Slash uses | Prefix uses | Description |
|----------|-----------|------------|-------------|
| `admin` | `/setup`, `/dashboard`, `/config` | `!prefix`, `!settings` | Server setup & bot config |
| `mod` | `/mod` | `!ban`, `!kick`, `!warn`, `!cases` | Moderation actions |
| `safety` | `/antinuke`, `/verify` | `!antispam`, `!automod` | Abuse prevention & verification |
| `agents` | `/agents`, `/pools` | `!agentpool`, `!deploy` | Agent pool management |
| `ai` | `/ai`, `/agentkeys` | `!ask`, `!workflow` | AI capabilities & BYOK |
| `economy` | — (prefix-first) | `!balance`, `!pay`, `!shop` | Credits, wallet, trade |
| `game` | `/game` | `!work`, `!gather`, `!craft` | Game progression |
| `social` | `/profile`, `/levels` | `!rep`, `!marry`, `!streak` | Social features |
| `music` | `/music` | `!play`, `!skip`, `!queue` | Music playback |
| `voice` | `/voice` | `!vc`, `!lobby` | Voice controls |
| `fun` | — (prefix-first) | `!8ball`, `!ship`, `!riddle` | Entertainment |
| `community` | — (prefix-first) | `!poll`, `!suggest`, `!giveaway` | Community tools |
| `utility` | — (prefix-first) | `!convert`, `!remind`, `!afk` | General utility |
| `tools` | `/tickets`, `/embed` | `!customcmd`, `!autoresponder` | Server tools |
| `info` | `/stats`, `/help` | `!serverinfo`, `!botinfo` | Information |
| `media` | — (prefix-first) | `!meme`, `!gif`, `!image` | Media & images |
| `entertainment` | — (prefix-first) | `!trivia`, `!wyr`, `!tod` | Games & entertainment |
| `internal` | (system only) | — | Internal handlers |

### Migration from Legacy Values
| Old Value | New Canonical |
|-----------|--------------|
| `"util"` | `"utility"` |
| `"tools"` (when it means admin) | `"admin"` |
| `"server"` | `"admin"` |
| `"pools"` | `"agents"` |
| `"community"` | `"community"` (same) |
| `"entertainment"` | `"entertainment"` (same) |

---

## Command Placement Rules

### A new command goes to SLASH if:
1. It is one of the 18 locked core commands
2. It requires rich interaction (buttons, modals, selects) at the point of invocation
3. It is the primary onboarding path for a feature

### A new command goes to PREFIX if:
1. It is a power-user tool, bulk operation, or experimental feature
2. It overlaps with an existing slash command's scope (feature variant)
3. It benefits from rapid iteration without API registration overhead
4. Users chain it with other commands

### Both surfaces:
- High-traffic features used by >50% of server members
- Features that have both admin config and member usage paths

---

## Versioned Prefix Namespaces

```
!work           # v1 stable — never removed
!v2:work        # v2 if API changes — opt-in
!beta:work      # experimental — unstable, guild opt-in
```

Guild admins can configure `!config prefix.beta on` to enable beta commands.

---

## Deprecation Protocol

When a slash command is deprecated (moved to prefix-only):
1. Add deprecation notice to reply: "⚠️ This command moves to `!cmd` in 30 days"
2. Keep slash command live for 30 days minimum
3. Update `deployGlobal: false` to stop new-guild registration
4. After 30 days: remove from deployment, keep handler for graceful fallback message

---

## Pod Ownership

| Category | Owning Pod |
|----------|-----------|
| admin, mod, safety | Moderation & Safety Pod |
| agents, ai | Agent Orchestration Pod + AI Utilities Pod |
| economy, game | (Economy/Game — future pod) |
| social | UX & Embed Systems Pod |
| music, voice | Voice & Media Pod |
| fun, entertainment, media | UX & Embed Systems Pod |
| utility, tools, info | Command Architecture Pod |
| community | Command Architecture Pod |
| internal | Ops & Reliability Pod |

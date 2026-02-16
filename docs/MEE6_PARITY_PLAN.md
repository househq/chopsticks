# Chopsticks MEE6-Parity Plan

Last updated: 2026-02-16

## Goal
Match key MEE6 capability surface inside Chopsticks architecture (controller + agents + dashboard/services), without regressing existing pooling/voice/game features.

## Reference Surface (MEE6)
- Plugin model and dashboard-driven configuration
- Moderator + automations + custom commands + levels/economy
- Reaction roles, audit logs, social connectors, giveaways/polls
- Source references:
  - https://help.mee6.xyz/
  - https://help.mee6.xyz/support/solutions/articles/101000385394-getting-started-with-mee6
  - https://help.mee6.xyz/support/solutions/articles/101000484903-what-permissions-does-mee6-need-
  - https://help.mee6.xyz/support/solutions/articles/101000546996-getting-started-with-mee6-automations
  - https://help.mee6.xyz/support/solutions/articles/101000475709-how-to-use-audit-logs-to-track-your-members-actions

## Capability Map

### Done (new/updated)
- Reaction Roles core:
  - `/reactionroles add|remove|list|clear_message`
  - Message reaction add/remove event processing with role assignment/removal
  - Persistent guild bindings in storage (`reactionRoles.bindings`)
- Starboard core:
  - `/starboard setup|status|disable|clear_posts`
  - Reaction threshold highlights with message jump links and image support
  - Persistent post mapping in storage (`starboard.posts`)
- Welcome plugin hardening:
  - Professional embed outputs
  - `/welcome preview` config inspection
- Levels role rewards:
  - `/levels rewards add|remove|list|sync`
  - Automatic role reward sync on member join and on level-up
- Automations v1 command surface:
  - `/automations create|template|list|enable|disable|delete|run`
  - Event runtime execution for `member_join`, `member_leave`, `message_create`
- Moderation log routing:
  - `/modlogs setup|event|status|disable|test`
  - Per-action filters + optional failed-attempt logging
  - Core moderation commands now emit structured mod log events
- Tickets core:
  - `/tickets setup|panel|status|open|close`
  - Button-first ticket panel with dropdown type selection
  - Private ticket channels, close flow, transcript-on-close, audit/modlog events
- UI hardening:
  - Command Center embeds and cleaner category/search output
  - Game panel feedback and failures moved to structured embeds

### Existing in Chopsticks (already present)
- Moderation command set (`ban`, `kick`, `timeout`, `purge`, `warn`, etc.)
- Levels/economy/game progression, leaderboards, quests, crafting
- Welcome and autorole baseline
- Giveaways, polls, custom commands, macros
- VoiceMaster and deployable agent orchestration

### Next priority slices
1. Advanced automations conditions (role checks, channel filters, keyword filters, cooldowns)
2. Social connectors v1 (YouTube/Twitch webhook-driven announcements)
3. Dashboard pages for reaction roles, starboard, levels rewards, automations, mod logs, and tickets controls
4. Ticket enhancements (claim/transfer, SLA timers, auto-close inactivity, panel editor)

## Constraints
- Keep all DB changes additive/backward compatible.
- Preserve agent pool/deploy contracts.
- No silent failures: all commands/actions return structured result embeds and log details.

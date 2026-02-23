/**
 * src/utils/localCache.js
 *
 * In-process LRU cache — a fast synchronous layer in front of Redis.
 *
 * Purpose: at 200k DAU every command reads guild config at least once.
 * Redis is fast (~0.3ms RTT on localhost) but at burst peaks the accumulated
 * overhead adds up. This LRU cache stores the last N guild configs in-process
 * with a short TTL, eliminating the network hop entirely for hot guilds.
 *
 * Layer order:  in-process LRU  →  Redis  →  PostgreSQL
 *
 * Exported singletons:
 *   guildLRU  — LRU for guild config objects  (max 2000, TTL 60s)
 *   userLRU   — LRU for user wallet/profile    (max 5000, TTL 30s)
 */

import { LRUCache } from "lru-cache";

const GUILD_MAX  = parseInt(process.env.LOCAL_CACHE_GUILD_MAX  ?? "2000", 10);
const GUILD_TTL  = parseInt(process.env.LOCAL_CACHE_GUILD_TTL  ?? "60000", 10); // ms
const USER_MAX   = parseInt(process.env.LOCAL_CACHE_USER_MAX   ?? "5000", 10);
const USER_TTL   = parseInt(process.env.LOCAL_CACHE_USER_TTL   ?? "30000", 10); // ms

/** Guild config LRU — keyed by guildId */
export const guildLRU = new LRUCache({
  max: GUILD_MAX,
  ttl: GUILD_TTL,
  updateAgeOnGet: false,  // TTL is wall-clock from set, not last access
  allowStale: false,
});

/** User data LRU — keyed by userId or "guild:userId" composite */
export const userLRU = new LRUCache({
  max: USER_MAX,
  ttl: USER_TTL,
  updateAgeOnGet: false,
  allowStale: false,
});

/**
 * Invalidate all LRU entries for a given guildId.
 * Call this from saveGuildData so writes propagate immediately.
 */
export function invalidateGuild(guildId) {
  guildLRU.delete(guildId);
}

/**
 * Invalidate all LRU entries for a given userId.
 */
export function invalidateUser(userId) {
  userLRU.delete(userId);
}

/** Return cache size stats for /botinfo or health checks */
export function localCacheStats() {
  return {
    guilds: { size: guildLRU.size, max: GUILD_MAX, ttlMs: GUILD_TTL },
    users:  { size: userLRU.size,  max: USER_MAX,  ttlMs: USER_TTL  },
  };
}

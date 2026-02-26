/**
 * src/utils/commandCategories.js
 * Canonical command category enum — MAP Cycle 1 (Command Taxonomy Lock)
 *
 * All slash and prefix command modules MUST use one of these category strings
 * in their `meta.category` field. This is the locked contract.
 *
 * Rules:
 * - Slash commands: 18 locked core commands only (see COMMAND_TAXONOMY.md)
 * - Prefix commands: unlimited surface, organized by category
 * - No new category added without a MAP cycle decision
 */

export const CATEGORIES = Object.freeze({
  // ── Administration & Setup ─────────────────────────────────────────────
  ADMIN:         "admin",       // Server config, setup, bot management
  MOD:           "mod",         // Moderation actions (ban, kick, mute, warn)
  SAFETY:        "safety",      // Antinuke, antispam, automod, verification

  // ── Agent & AI ─────────────────────────────────────────────────────────
  AGENTS:        "agents",      // Agent pool management, deployment
  AI:            "ai",          // AI utilities, chat, token config, BYOK

  // ── Economy & Game ─────────────────────────────────────────────────────
  ECONOMY:       "economy",     // Credits, wallet, shop, trade, bank
  GAME:          "game",        // Game progression, work, gather, craft
  SOCIAL:        "social",      // Reputation, marriage, profile, levels

  // ── Music & Voice ──────────────────────────────────────────────────────
  MUSIC:         "music",       // Music playback, queue, DJ controls
  VOICE:         "voice",       // Voice lobby, VC management

  // ── Community & Fun ────────────────────────────────────────────────────
  FUN:           "fun",         // Fun commands, games, reactions
  COMMUNITY:     "community",   // Polls, suggestions, events, giveaways

  // ── Utility & Tools ────────────────────────────────────────────────────
  UTILITY:       "utility",     // General utility (convert, remind, afk, alias)
  TOOLS:         "tools",       // Server tools (embed, threads, custom commands)
  INFO:          "info",        // Information commands (stats, help, serverinfo)

  // ── Media & Entertainment ──────────────────────────────────────────────
  MEDIA:         "media",       // Images, memes, GIFs, animals
  ENTERTAINMENT: "entertainment", // Trivia, riddles, would you rather, truth/dare

  // ── Internal / System ─────────────────────────────────────────────────
  INTERNAL:      "internal",    // Internal handlers (ai-modal, system commands)
});

/**
 * All valid category values as a Set for O(1) lookup.
 */
export const VALID_CATEGORIES = new Set(Object.values(CATEGORIES));

/**
 * Check if a category string is valid.
 * @param {string} category
 * @returns {boolean}
 */
export function isValidCategory(category) {
  return VALID_CATEGORIES.has(category);
}

/**
 * Migration map: old category names → new canonical names
 * Used by the category migration script.
 */
export const CATEGORY_MIGRATION = Object.freeze({
  // Old → New
  "admin":       CATEGORIES.ADMIN,
  "util":        CATEGORIES.UTILITY,
  "utility":     CATEGORIES.UTILITY,
  "tools":       CATEGORIES.TOOLS,
  "tool":        CATEGORIES.TOOLS,
  "social":      CATEGORIES.SOCIAL,
  "fun":         CATEGORIES.FUN,
  "mod":         CATEGORIES.MOD,
  "economy":     CATEGORIES.ECONOMY,
  "game":        CATEGORIES.GAME,
  "music":       CATEGORIES.MUSIC,
  "voice":       CATEGORIES.VOICE,
  "ai":          CATEGORIES.AI,
  "agents":      CATEGORIES.AGENTS,
  "media":       CATEGORIES.MEDIA,
  "entertainment": CATEGORIES.ENTERTAINMENT,
  "community":   CATEGORIES.COMMUNITY,
  "info":        CATEGORIES.INFO,
  "pools":       CATEGORIES.AGENTS,   // pools are part of agent management
  "server":      CATEGORIES.ADMIN,    // server config = admin
  "internal":    CATEGORIES.INTERNAL,
});

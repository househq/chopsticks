/**
 * Agent Protocol Constants and Pure Helpers — MAP Cycle 3
 *
 * This module contains:
 *   - Protocol version constants (shared between manager and runner)
 *   - Session/assistant/text key generators (pure functions)
 *   - Pod tag registry (canonical pod tag values)
 *   - Utility helpers (safeInt, buildInviteUrl)
 *
 * Zero side effects. No imports from other local modules.
 */

import { timingSafeEqual } from "node:crypto";

// ── Protocol Version ──────────────────────────────────────────────────────────

export const PROTOCOL_VERSION   = "1.0.0";
export const SUPPORTED_VERSIONS = new Set(["1.0.0"]);

// ── Agent Limits ──────────────────────────────────────────────────────────────

export const MAX_AGENTS_PER_GUILD = 49;

// ── Pod Tags ──────────────────────────────────────────────────────────────────
// Canonical set of pod-tag values an agent may announce in its hello message.
// Agents not announcing a podTag are treated as "general".

export const POD_TAGS = Object.freeze({
  GENERAL:   "general",
  MUSIC:     "music",
  ASSISTANT: "assistant",
  VOICE:     "voice",
  MODERATION: "moderation",
});

export const VALID_POD_TAGS = new Set(Object.values(POD_TAGS));

/**
 * Normalises an incoming podTag from an agent hello.
 * Returns a canonical string or "general" if unknown/absent.
 * @param {string|null|undefined} tag
 * @returns {string}
 */
export function normalizePodTag(tag) {
  const t = String(tag ?? "").trim().toLowerCase();
  return VALID_POD_TAGS.has(t) ? t : POD_TAGS.GENERAL;
}

// ── Session Key Generators ────────────────────────────────────────────────────

export function sessionKey(guildId, voiceChannelId) {
  return `${guildId}:${voiceChannelId}`;
}

export function assistantKey(guildId, voiceChannelId) {
  return `a:${guildId}:${voiceChannelId}`;
}

export function textKey(kind, guildId, textChannelId, ownerUserId) {
  const k = String(kind || "text");
  return `t:${k}:${guildId}:${textChannelId}:${ownerUserId || "0"}`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function safeInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildInviteUrl({ clientId, permissions }) {
  const perms = BigInt(permissions ?? 0);
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${perms.toString()}&scope=bot%20applications.commands`;
}

/**
 * Constant-time string equality check for secrets.
 * Returns true only if both strings are identical and non-empty.
 * @param {string} presented
 * @param {string} expected
 * @returns {boolean}
 */
export function secretsMatch(presented, expected) {
  const bP = Buffer.from(String(presented), "utf8");
  const bE = Buffer.from(String(expected),  "utf8");
  return bP.length > 0
    && bP.length === bE.length
    && timingSafeEqual(bP, bE);
}

// src/utils/voiceConfig.js
// Per-guild voice LLM provider configuration.
// Stores encrypted API keys in guild_settings.data.voice.
// Default provider is "none" — no LLM calls are made by default.

import crypto from "node:crypto";
import retry from "async-retry";
import { getPool } from "./storage_pg.js";
import { logger } from "./logger.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

export const ALLOWED_PROVIDERS = ["none", "ollama", "anthropic", "openai"];

const KEY = process.env.AGENT_TOKEN_KEY;
const KEY_READY = KEY && KEY.length === 64;
if (!KEY_READY) {
  logger.warn("voiceConfig: AGENT_TOKEN_KEY missing or invalid — API keys stored unencrypted");
}

function encryptToken(text) {
  if (!KEY_READY) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, "hex"), iv);
    let enc = cipher.update(text, "utf8", "hex");
    enc += cipher.final("hex");
    return `${iv.toString("hex")}:${enc}:${cipher.getAuthTag().toString("hex")}`;
  } catch (err) {
    logger.error("voiceConfig encrypt failed", { error: err?.message });
    throw new Error("encrypt_failed");
  }
}

function decryptToken(text) {
  if (!KEY_READY) return text;
  if (!text || typeof text !== "string") return null;
  const parts = text.split(":");
  if (parts.length !== 3) return text; // unencrypted legacy value
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY, "hex"), Buffer.from(parts[0], "hex"));
    decipher.setAuthTag(Buffer.from(parts[2], "hex"));
    let dec = decipher.update(parts[1], "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch {
    logger.warn("voiceConfig decrypt failed — token needs re-linking");
    return null;
  }
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getGuildVoiceConfig(guildId) {
  const pool = getPool();
  const res = await retry(() => pool.query(
    "SELECT data FROM guild_settings WHERE guild_id = $1",
    [guildId]
  ), { retries: 2, minTimeout: 100 });

  const voice = res.rows[0]?.data?.voice || {};
  return {
    provider: ALLOWED_PROVIDERS.includes(voice.provider) ? voice.provider : "none",
    hasApiKey: Boolean(voice.encrypted_api_key),
    ollamaUrl: voice.ollama_url || null,
  };
}

// Resolve decrypted API key for internal use only — never returned to users.
export async function resolveGuildApiKey(guildId) {
  const pool = getPool();
  const res = await retry(() => pool.query(
    "SELECT data FROM guild_settings WHERE guild_id = $1",
    [guildId]
  ), { retries: 2, minTimeout: 100 });

  const enc = res.rows[0]?.data?.voice?.encrypted_api_key;
  if (!enc) return null;
  return decryptToken(enc);
}

// ── Write ───────────────────────────────────────────────────────────────────

async function patchVoice(guildId, patch) {
  const pool = getPool();
  const patchJson = JSON.stringify(patch);
  await retry(() => pool.query(`
    INSERT INTO guild_settings (guild_id, data, rev)
    VALUES ($1, jsonb_build_object('voice', $2::jsonb), 1)
    ON CONFLICT (guild_id) DO UPDATE SET
      data = guild_settings.data || jsonb_build_object(
        'voice', COALESCE(guild_settings.data->'voice', '{}'::jsonb) || $2::jsonb
      ),
      rev = guild_settings.rev + 1,
      updated_at = NOW()
  `, [guildId, patchJson]), { retries: 2, minTimeout: 100 });
}

export async function setGuildVoiceProvider(guildId, provider) {
  if (!ALLOWED_PROVIDERS.includes(provider)) throw new Error(`invalid_provider:${provider}`);
  await patchVoice(guildId, { provider });
}

export async function setGuildVoiceApiKey(guildId, rawApiKey) {
  const encrypted = encryptToken(rawApiKey);
  await patchVoice(guildId, { encrypted_api_key: encrypted });
}

export async function setGuildOllamaUrl(guildId, url) {
  await patchVoice(guildId, { ollama_url: url });
}

export async function clearGuildVoiceConfig(guildId) {
  await patchVoice(guildId, { provider: "none", encrypted_api_key: null, ollama_url: null });
}

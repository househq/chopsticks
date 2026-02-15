import { clampIntensity } from "./variants.js";
import { randomFunFromRuntime } from "./runtime.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";

export const DEFAULT_GUILD_FUN_CONFIG = {
  enabled: true,
  intensity: 3,
  features: {
    welcome: true,
    giveaway: true,
    daily: true,
    work: true
  }
};

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

export function normalizeGuildFunConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const features = src.features && typeof src.features === "object" ? src.features : {};
  return {
    enabled: toBool(src.enabled, DEFAULT_GUILD_FUN_CONFIG.enabled),
    intensity: clampIntensity(src.intensity ?? DEFAULT_GUILD_FUN_CONFIG.intensity),
    features: {
      welcome: toBool(features.welcome, DEFAULT_GUILD_FUN_CONFIG.features.welcome),
      giveaway: toBool(features.giveaway, DEFAULT_GUILD_FUN_CONFIG.features.giveaway),
      daily: toBool(features.daily, DEFAULT_GUILD_FUN_CONFIG.features.daily),
      work: toBool(features.work, DEFAULT_GUILD_FUN_CONFIG.features.work)
    }
  };
}

export function formatGuildFunConfig(config) {
  const out = normalizeGuildFunConfig(config);
  return [
    `enabled=${out.enabled}`,
    `intensity=${out.intensity}`,
    `welcome=${out.features.welcome}`,
    `giveaway=${out.features.giveaway}`,
    `daily=${out.features.daily}`,
    `work=${out.features.work}`
  ].join(" | ");
}

export async function getGuildFunConfig(guildId) {
  const data = await loadGuildData(guildId);
  const cfg = normalizeGuildFunConfig(data.fun);
  return { ok: true, config: cfg, data };
}

export async function setGuildFunConfig(guildId, patch = {}) {
  const data = await loadGuildData(guildId);
  const current = normalizeGuildFunConfig(data.fun);

  const next = normalizeGuildFunConfig({
    ...current,
    ...patch,
    features: {
      ...current.features,
      ...(patch.features && typeof patch.features === "object" ? patch.features : {})
    }
  });

  data.fun = next;
  await saveGuildData(guildId, data);
  return { ok: true, config: next };
}

function truncate(text, max = 220) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  if (max <= 3) return s.slice(0, Math.max(0, max));
  return `${s.slice(0, Math.max(0, max - 3))}...`;
}

export async function maybeBuildGuildFunLine({ guildId, feature, actorTag, target, intensity, maxLength = 220 }) {
  if (!guildId || !feature) return null;
  try {
    const data = await loadGuildData(guildId);
    const cfg = normalizeGuildFunConfig(data.fun);
    if (!cfg.enabled) return null;
    if (!cfg.features?.[feature]) return null;

    const out = await randomFunFromRuntime({
      actorTag: actorTag || "chopsticks",
      target: target || "crew",
      intensity: clampIntensity(intensity ?? cfg.intensity)
    });

    if (!out?.ok || !out?.text) return null;
    return truncate(out.text, maxLength);
  } catch {
    return null;
  }
}

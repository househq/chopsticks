// src/utils/textLlm.js
// LLM client for the voice-llm microservice.
// When guildId is provided, per-guild provider config is consulted first.
// Default: provider=none returns "" immediately (no paid calls without admin opt-in).

import { getGuildVoiceConfig, resolveGuildApiKey } from "./voiceConfig.js";

function isValidHttpUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeGenerateUrl(url) {
  const base = String(url || "").trim().replace(/\/$/, "");
  if (!base) return "";
  if (base.endsWith("/generate")) return base;
  return `${base}/generate`;
}

export async function generateText({ prompt, system = "", guildId = null } = {}) {
  // Per-guild provider check — return empty string if no provider configured.
  if (guildId) {
    try {
      const cfg = await getGuildVoiceConfig(guildId);
      if (cfg.provider === "none") return "";  // No LLM until admin links a provider

      // Build per-guild override to pass to voice-llm service
      const apiKey = ["anthropic", "openai"].includes(cfg.provider)
        ? await resolveGuildApiKey(guildId)
        : null;
      const ollamaUrl = cfg.provider === "ollama" ? cfg.ollamaUrl : null;

      const raw = String(process.env.TEXT_LLM_URL || process.env.VOICE_ASSIST_LLM_URL || "").trim();
      if (!raw) return "";
      if (!isValidHttpUrl(raw)) throw new Error("llm-url-invalid");

      return await callVoiceLlm(normalizeGenerateUrl(raw), {
        prompt, system,
        provider: cfg.provider,
        ...(apiKey   && { apiKey }),
        ...(ollamaUrl && { ollamaUrl }),
      });
    } catch (err) {
      // If DB lookup fails, fall through to env-level config
      if (!String(err?.message).startsWith("llm-")) throw err;
    }
  }

  // Env-level fallback (no guild context or DB error)
  const raw = String(process.env.TEXT_LLM_URL || process.env.VOICE_ASSIST_LLM_URL || "").trim();
  if (!raw) throw new Error("llm-not-configured");
  if (!isValidHttpUrl(raw)) throw new Error("llm-url-invalid");
  return callVoiceLlm(normalizeGenerateUrl(raw), { prompt, system });
}

async function callVoiceLlm(url, body) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const detail = data?.backends_tried
        ? data.backends_tried.map(b => `${b.backend||b.error}:${b.error||""}`).join("; ")
        : await res.text().catch(() => "");
      throw new Error(`llm-failed:${res.status}:${detail.slice(0, 160)}`);
    }

    const data = await res.json().catch(() => null);
    const text = String(data?.text || data?.response || "").trim();
    if (!text) throw new Error("llm-empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}


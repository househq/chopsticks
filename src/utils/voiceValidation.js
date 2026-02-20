// src/utils/voiceValidation.js
// Validate provider API keys with a cheap test call before persisting.

import { request } from "undici";

const TIMEOUT_MS = 8_000;

export async function validateProviderKey(provider, apiKey, ollamaUrl) {
  switch (provider) {
    case "anthropic": return validateAnthropic(apiKey);
    case "openai":    return validateOpenAI(apiKey);
    case "ollama":    return validateOllama(ollamaUrl);
    case "none":      return { ok: true };
    default: return { ok: false, error: `unknown_provider:${provider}` };
  }
}

async function validateAnthropic(apiKey) {
  if (!apiKey) return { ok: false, error: "api_key_required" };
  try {
    const r = await request("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      bodyTimeout: TIMEOUT_MS,
      headersTimeout: TIMEOUT_MS,
    });
    // 200 or 400 (bad request but auth passed) = valid key
    if (r.statusCode === 200 || r.statusCode === 400) return { ok: true };
    if (r.statusCode === 401) return { ok: false, error: "invalid_api_key" };
    return { ok: false, error: `anthropic_status:${r.statusCode}` };
  } catch (err) {
    return { ok: false, error: `anthropic_network:${err?.message?.slice(0, 60)}` };
  }
}

async function validateOpenAI(apiKey) {
  if (!apiKey) return { ok: false, error: "api_key_required" };
  try {
    const r = await request("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      bodyTimeout: TIMEOUT_MS,
      headersTimeout: TIMEOUT_MS,
    });
    if (r.statusCode === 200) return { ok: true };
    if (r.statusCode === 401) return { ok: false, error: "invalid_api_key" };
    return { ok: false, error: `openai_status:${r.statusCode}` };
  } catch (err) {
    return { ok: false, error: `openai_network:${err?.message?.slice(0, 60)}` };
  }
}

async function validateOllama(ollamaUrl) {
  const base = (ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
  try {
    const r = await request(`${base}/api/tags`, {
      method: "GET",
      bodyTimeout: TIMEOUT_MS,
      headersTimeout: TIMEOUT_MS,
    });
    if (r.statusCode === 200) return { ok: true };
    return { ok: false, error: `ollama_status:${r.statusCode}` };
  } catch (err) {
    return { ok: false, error: `ollama_unreachable:${err?.message?.slice(0, 60)}` };
  }
}

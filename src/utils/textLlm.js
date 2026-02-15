// src/utils/textLlm.js
// Optional local LLM client. Works with services/voice-llm (POST /generate).

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

export async function generateText({ prompt, system = "" } = {}) {
  const raw = String(process.env.TEXT_LLM_URL || process.env.VOICE_ASSIST_LLM_URL || "").trim();
  if (!raw) throw new Error("llm-not-configured");
  if (!isValidHttpUrl(raw)) throw new Error("llm-url-invalid");

  const url = normalizeGenerateUrl(raw);
  const body = JSON.stringify({ prompt: String(prompt || ""), system: String(system || "") });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`llm-failed:${res.status}:${text.slice(0, 120)}`);
    }

    const data = await res.json().catch(() => null);
    const text = String(data?.text || data?.response || "").trim();
    if (!text) throw new Error("llm-empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}


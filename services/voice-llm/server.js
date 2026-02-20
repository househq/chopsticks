import express from "express";
import { request } from "undici";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ── Backend configuration ──────────────────────────────────────────────────
const OLLAMA_URL   = (process.env.OLLAMA_URL   || "http://ollama:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL  || "llama3.1:8b";
const OLLAMA_OPTIONS = process.env.OLLAMA_OPTIONS || "";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL   || "claude-3-haiku-20240307";
const ANTHROPIC_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 512);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || "gpt-4o-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

// PRIMARY = first available backend; FALLBACK_ORDER = priority list
const FALLBACK_ORDER = (process.env.VOICE_LLM_BACKENDS || "anthropic,openai,ollama")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

const TIMEOUT_MS = Number(process.env.VOICE_LLM_TIMEOUT_MS || 15_000);

// ── Backend implementations ────────────────────────────────────────────────

async function generateOllama(prompt, system) {
  const body = { model: OLLAMA_MODEL, prompt, stream: false };
  if (system) body.system = system;
  if (OLLAMA_OPTIONS) {
    try { body.options = JSON.parse(OLLAMA_OPTIONS); } catch {}
  }
  const r = await request(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    bodyTimeout: TIMEOUT_MS,
    headersTimeout: TIMEOUT_MS,
  });
  if (r.statusCode >= 400) {
    const t = await r.body.text().catch(() => "");
    throw new Error(`ollama_failed:${r.statusCode}:${t.slice(0, 120)}`);
  }
  const data = await r.body.json().catch(() => null);
  const text = String(data?.response || "").trim();
  if (!text) throw new Error("ollama_empty");
  return text;
}

async function generateAnthropic(prompt, system) {
  if (!ANTHROPIC_API_KEY) throw new Error("anthropic_not_configured");
  const messages = [{ role: "user", content: prompt }];
  const body = { model: ANTHROPIC_MODEL, max_tokens: ANTHROPIC_MAX_TOKENS, messages };
  if (system) body.system = system;

  const r = await request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    bodyTimeout: TIMEOUT_MS,
    headersTimeout: TIMEOUT_MS,
  });
  if (r.statusCode >= 400) {
    const t = await r.body.text().catch(() => "");
    throw new Error(`anthropic_failed:${r.statusCode}:${t.slice(0, 120)}`);
  }
  const data = await r.body.json().catch(() => null);
  const text = String(data?.content?.[0]?.text || "").trim();
  if (!text) throw new Error("anthropic_empty");
  return text;
}

async function generateOpenAI(prompt, system) {
  if (!OPENAI_API_KEY) throw new Error("openai_not_configured");
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const body = { model: OPENAI_MODEL, messages };

  const r = await request(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    bodyTimeout: TIMEOUT_MS,
    headersTimeout: TIMEOUT_MS,
  });
  if (r.statusCode >= 400) {
    const t = await r.body.text().catch(() => "");
    throw new Error(`openai_failed:${r.statusCode}:${t.slice(0, 120)}`);
  }
  const data = await r.body.json().catch(() => null);
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("openai_empty");
  return text;
}

const BACKENDS = { ollama: generateOllama, anthropic: generateAnthropic, openai: generateOpenAI };

// ── Fallback chain ─────────────────────────────────────────────────────────

async function generateWithFallback(prompt, system) {
  const errors = [];
  for (const name of FALLBACK_ORDER) {
    const fn = BACKENDS[name];
    if (!fn) continue;
    try {
      const text = await fn(prompt, system);
      if (errors.length > 0) {
        console.warn(`[voice-llm] primary backend(s) failed (${errors.map(e=>e.backend).join(",")}); succeeded with ${name}`);
      }
      return { text, backend: name };
    } catch (err) {
      errors.push({ backend: name, error: String(err?.message || err) });
      console.warn(`[voice-llm] backend ${name} failed: ${err?.message || err}`);
    }
  }
  throw Object.assign(new Error("all_backends_failed"), { errors });
}

// ── Per-request provider override (used when textLlm.js passes guild config) ─

async function generateWithProvider(prompt, system, provider, apiKey, ollamaUrlOverride) {
  if (provider === "anthropic") {
    // Temporarily use provided key if different from env
    const origKey = ANTHROPIC_API_KEY;
    if (apiKey) {
      // Clone and call with override key
      const r = await requestWithKey(
        "https://api.anthropic.com/v1/messages",
        {
          model: ANTHROPIC_MODEL,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          messages: [{ role: "user", content: prompt }],
          ...(system && { system }),
        },
        { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      );
      return { text: r, backend: "anthropic:guild" };
    }
    if (!origKey) throw Object.assign(new Error("anthropic_not_configured"), { errors: [{ backend: "anthropic", error: "no_key" }] });
    const text = await generateAnthropic(prompt, system);
    return { text, backend: "anthropic" };
  }

  if (provider === "openai") {
    const key = apiKey || OPENAI_API_KEY;
    if (!key) throw Object.assign(new Error("openai_not_configured"), { errors: [{ backend: "openai", error: "no_key" }] });
    const r = await requestWithKey(
      `${OPENAI_BASE_URL}/chat/completions`,
      { model: OPENAI_MODEL, max_tokens: 512, messages: [{ role: "user", content: prompt }] },
      { Authorization: `Bearer ${key}` }
    );
    return { text: r, backend: apiKey ? "openai:guild" : "openai" };
  }

  if (provider === "ollama") {
    const url = (ollamaUrlOverride || OLLAMA_URL).replace(/\/$/, "");
    const body = { model: OLLAMA_MODEL, prompt, stream: false };
    if (system) body.system = system;
    const rr = await request(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      bodyTimeout: TIMEOUT_MS,
      headersTimeout: TIMEOUT_MS,
    });
    if (rr.statusCode >= 400) throw new Error(`ollama_failed:${rr.statusCode}`);
    const data = await rr.body.json().catch(() => null);
    const text = String(data?.response || "").trim();
    if (!text) throw new Error("ollama_empty");
    return { text, backend: ollamaUrlOverride ? "ollama:guild" : "ollama" };
  }

  throw new Error(`unknown_provider:${provider}`);
}

async function requestWithKey(url, body, extraHeaders = {}) {
  const r = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
    bodyTimeout: TIMEOUT_MS,
    headersTimeout: TIMEOUT_MS,
  });
  if (r.statusCode >= 400) {
    const t = await r.body.text().catch(() => "");
    throw new Error(`provider_failed:${r.statusCode}:${t.slice(0, 120)}`);
  }
  const data = await r.body.json().catch(() => null);
  // Support both anthropic and openai response shapes
  const text = String(
    data?.content?.[0]?.text || data?.choices?.[0]?.message?.content || ""
  ).trim();
  if (!text) throw new Error("provider_empty");
  return text;
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.post("/generate", async (req, res) => {
  const prompt   = String(req.body?.prompt || "").trim();
  const system   = String(req.body?.system || "").trim();
  const provider = String(req.body?.provider || "").trim().toLowerCase();
  const apiKey   = String(req.body?.apiKey  || "").trim();
  const ollamaUrl = String(req.body?.ollamaUrl || "").trim();

  if (!prompt) return res.status(400).json({ error: "missing_prompt" });

  try {
    let result;
    // Per-request provider override (set by textLlm.js from per-guild config)
    if (provider && provider !== "none") {
      result = await generateWithProvider(prompt, system, provider, apiKey, ollamaUrl);
    } else if (provider === "none") {
      // Explicit no-op: caller says this guild has no provider
      return res.json({ text: "", backend: "none" });
    } else {
      result = await generateWithFallback(prompt, system);
    }
    res.json(result);
  } catch (err) {
    const errors = err.errors || [{ error: String(err?.message || err) }];
    console.error("[voice-llm] all backends failed:", errors);
    res.status(500).json({ error: "llm_error", backends_tried: errors });
  }
});

app.get("/health", (_req, res) => {
  const configured = FALLBACK_ORDER.filter(name => {
    if (name === "anthropic") return !!ANTHROPIC_API_KEY;
    if (name === "openai")    return !!OPENAI_API_KEY;
    if (name === "ollama")    return true;
    return false;
  });
  res.json({
    ok: configured.length > 0,
    backends_order: FALLBACK_ORDER,
    backends_configured: configured,
    ollama_model: OLLAMA_MODEL,
    anthropic_model: ANTHROPIC_API_KEY ? ANTHROPIC_MODEL : null,
    openai_model: OPENAI_API_KEY ? OPENAI_MODEL : null,
  });
});

const port = Number(process.env.PORT || 9001);
app.listen(port, () => {
  console.log(`[voice-llm] listening on :${port} — backends: ${FALLBACK_ORDER.join(" → ")}`);
});

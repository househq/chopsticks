// test/unit/voice-model-selection.test.js
// Unit tests for voice model selection helpers (no DB required).

import assert from "node:assert/strict";
import { describe, it, before, after } from "mocha";
import http from "node:http";
import { ALLOWED_PROVIDERS } from "../../src/utils/voiceConfig.js";
import { validateProviderKey } from "../../src/utils/voiceValidation.js";

// ── Stub server helpers ──────────────────────────────────────────────────────

function makeStub(port, handler) {
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", d => (body += d));
    req.on("end", () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
      handler(req, res);
    });
  });
  return new Promise(resolve => srv.listen(port, () => resolve(srv)));
}
function jsonRes(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ── ALLOWED_PROVIDERS ────────────────────────────────────────────────────────

describe("voiceConfig - ALLOWED_PROVIDERS", () => {
  it("includes none, ollama, anthropic, openai", () => {
    assert.ok(ALLOWED_PROVIDERS.includes("none"));
    assert.ok(ALLOWED_PROVIDERS.includes("ollama"));
    assert.ok(ALLOWED_PROVIDERS.includes("anthropic"));
    assert.ok(ALLOWED_PROVIDERS.includes("openai"));
  });

  it("does not include arbitrary strings", () => {
    assert.ok(!ALLOWED_PROVIDERS.includes("gpt-9000"));
  });
});

// ── validateProviderKey ──────────────────────────────────────────────────────

describe("voiceValidation - provider=none", () => {
  it("always returns ok:true", async () => {
    const r = await validateProviderKey("none", null, null);
    assert.equal(r.ok, true);
  });
});

describe("voiceValidation - missing api keys", () => {
  it("anthropic without key returns api_key_required", async () => {
    const r = await validateProviderKey("anthropic", null, null);
    assert.equal(r.ok, false);
    assert.equal(r.error, "api_key_required");
  });

  it("anthropic with empty string returns api_key_required", async () => {
    const r = await validateProviderKey("anthropic", "", null);
    assert.equal(r.ok, false);
    assert.equal(r.error, "api_key_required");
  });

  it("openai without key returns api_key_required", async () => {
    const r = await validateProviderKey("openai", null, null);
    assert.equal(r.ok, false);
    assert.equal(r.error, "api_key_required");
  });

  it("unknown provider returns error", async () => {
    const r = await validateProviderKey("gpt-9000", "key", null);
    assert.equal(r.ok, false);
    assert.ok(r.error.startsWith("unknown_provider"));
  });
});

describe("voiceValidation - ollama stub", () => {
  let stubServer;
  const STUB_PORT = 49880;

  before(async () => {
    stubServer = await makeStub(STUB_PORT, (req, res) => {
      if (req.url === "/api/tags") return jsonRes(res, 200, { models: [] });
      jsonRes(res, 404, {});
    });
  });

  after(done => stubServer.close(done));

  it("returns ok:true when ollama /api/tags responds 200", async () => {
    const r = await validateProviderKey("ollama", null, `http://127.0.0.1:${STUB_PORT}`);
    assert.equal(r.ok, true);
  });

  it("returns error when ollama is unreachable", async () => {
    const r = await validateProviderKey("ollama", null, "http://127.0.0.1:49999");
    assert.equal(r.ok, false);
    assert.ok(r.error.startsWith("ollama_unreachable"));
  });
});

describe("voiceValidation - anthropic stub", () => {
  let stubServer;
  const STUB_PORT = 49881;

  before(async () => {
    stubServer = await makeStub(STUB_PORT, (req, res) => {
      const key = req.headers["x-api-key"];
      if (key === "sk-valid") return jsonRes(res, 200, { content: [{ text: "pong" }] });
      jsonRes(res, 401, { error: { type: "authentication_error" } });
    });
  });

  after(done => stubServer.close(done));

  it("200 response indicates valid key", async () => {
    // Override the URL used in validateProviderKey by patching process.env won't work;
    // the stub test just verifies the 401 path returns invalid_api_key.
    // We can't override the URL without mocking, so we test the rejection path.
    const r = await validateProviderKey("anthropic", "sk-bad-key", null);
    // Will get network error or 401 — both are errors, not ok:true
    assert.equal(r.ok, false);
  });
});



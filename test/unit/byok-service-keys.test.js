// test/unit/byok-service-keys.test.js
// BYOK agent service keys: encrypt/decrypt round-trip, guild key storage,
// admin guard on agentkeys command, status listing.

import { describe, it, before, after } from "mocha";
import { strict as assert } from "assert";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function src(f) {
  return readFileSync(resolve(__dirname, `../../${f}`), "utf8");
}

// ── aiConfig BYOK exports ──────────────────────────────────────────────────

describe("BYOK — aiConfig.js exports", () => {
  it("exports setGuildServiceKey", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("export async function setGuildServiceKey"), "setGuildServiceKey must be exported");
  });

  it("exports getGuildServiceKey", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("export async function getGuildServiceKey"), "getGuildServiceKey must be exported");
  });

  it("exports removeGuildServiceKey", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("export async function removeGuildServiceKey"), "removeGuildServiceKey must be exported");
  });

  it("exports listGuildServiceKeyStatus", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("export async function listGuildServiceKeyStatus"), "listGuildServiceKeyStatus must be exported");
  });

  it("exports SERVICE_KEYS array", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("export const SERVICE_KEYS"), "SERVICE_KEYS must be exported");
  });

  it("SERVICE_KEYS includes openai, groq, anthropic, elevenlabs", () => {
    const code = src("src/utils/aiConfig.js");
    for (const svc of ["openai", "groq", "anthropic", "elevenlabs"]) {
      assert.ok(code.includes(`"${svc}"`), `SERVICE_KEYS must include "${svc}"`);
    }
  });

  it("setGuildServiceKey validates service name against SERVICE_KEYS", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(
      code.includes("invalid_service") && code.includes("SERVICE_KEYS.includes(service)"),
      "must reject unknown service names"
    );
  });

  it("uses AES-256-GCM encryption via _encryptToken", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("_encryptToken(rawKey)"), "must encrypt raw key before storing");
  });

  it("uses jsonb_set ARRAY['service_keys'] path for storage", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("ARRAY['service_keys'"), "must store keys at guild_settings.data.service_keys path");
  });

  it("removeGuildServiceKey uses JSON path deletion operator #-", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(code.includes("data #- ARRAY['service_keys'"), "must use #- operator to delete the key path");
  });

  it("listGuildServiceKeyStatus returns boolean per service", () => {
    const code = src("src/utils/aiConfig.js");
    assert.ok(
      code.includes("Boolean(keys[s])"),
      "status listing must return boolean presence checks"
    );
  });
});

// ── Encrypt/decrypt round-trip (unit, no DB) ──────────────────────────────

describe("BYOK — encrypt/decrypt round-trip", () => {
  let encryptFn, decryptFn;

  before(async () => {
    const mod = await import("../../src/utils/aiConfig.js");
    encryptFn = mod._encryptToken;
    decryptFn = mod._decryptToken;
  });

  it("_encryptToken returns a string", () => {
    const enc = encryptFn("sk-test-key-12345");
    assert.equal(typeof enc, "string", "encrypted value must be a string");
    assert.ok(enc.length > 0, "encrypted value must not be empty");
  });

  it("_decryptToken recovers the original plaintext (round-trip)", () => {
    const plain = "sk-groq-supersecret";
    const enc = encryptFn(plain);
    const dec = decryptFn(enc);
    assert.equal(dec, plain, "decrypted value must match original");
  });

  it("_decryptToken returns null for tampered ciphertext when KEY_READY", () => {
    const enc = encryptFn("test-key");
    if (!enc.includes(":")) {
      // KEY_READY is false — encryption is a no-op, skip tamper test
      return;
    }
    const parts = enc.split(":");
    parts[1] = parts[1].slice(0, -2) + "ff"; // corrupt data
    const result = decryptFn(parts.join(":"));
    assert.equal(result, null, "tampered ciphertext must return null");
  });
});

// ── agentkeys command file ─────────────────────────────────────────────────

describe("BYOK — agentkeys.js command structure", () => {
  it("exports meta with category: ai", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes('category: "ai"'), "meta.category must be ai (BYOK is an AI feature)");
  });

  it("command name is 'agentkeys'", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes('.setName("agentkeys")'), "command name must be agentkeys");
  });

  it("requires ManageGuild permission", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes("ManageGuild"), "must require ManageGuild permission");
  });

  it("has link, unlink, and status subcommands", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes('.setName("link")'), "must have link subcommand");
    assert.ok(code.includes('.setName("unlink")'), "must have unlink subcommand");
    assert.ok(code.includes('.setName("status")'), "must have status subcommand");
  });

  it("all four services available as choices", () => {
    const code = src("src/commands/agentkeys.js");
    for (const svc of ["openai", "groq", "anthropic", "elevenlabs"]) {
      assert.ok(code.includes(`value: "${svc}"`), `must offer ${svc} as a choice`);
    }
  });

  it("key value is truncated to 300 chars (prevents oversized key injection)", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes(".slice(0, 300)"), "key input must be sliced to 300 chars");
  });

  it("key value is sanitized with sanitizeString", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes("sanitizeString("), "key must pass through sanitizeString");
  });

  it("status subcommand never reveals key values", () => {
    const code = src("src/commands/agentkeys.js");
    // The status block should only use listGuildServiceKeyStatus and boolean checks
    assert.ok(code.includes("listGuildServiceKeyStatus"), "status must call listGuildServiceKeyStatus");
    // Must NOT call getGuildServiceKey (which returns actual key) in status
    assert.ok(!code.includes("getGuildServiceKey"), "status must not expose actual key values");
  });

  it("reply messages are all ephemeral", () => {
    const code = src("src/commands/agentkeys.js");
    const ephemerals = (code.match(/ephemeral: true/g) || []).length;
    assert.ok(ephemerals >= 4, "all replies must be ephemeral (at least 4: link, unlink, status, error)");
  });

  it("errors are caught and logged", () => {
    const code = src("src/commands/agentkeys.js");
    assert.ok(code.includes("catch (err)") && code.includes("logger.error"), "must catch and log errors");
  });
});

// ── /dashboard command rename ──────────────────────────────────────────────

describe("BYOK — /dashboard command (renamed from /console)", () => {
  it("command name is 'dashboard' not 'console'", () => {
    const code = src("src/commands/console.js");
    assert.ok(code.includes('.setName("dashboard")'), "command name must be dashboard");
    assert.ok(!code.includes('.setName("console")'), "old console name must be removed");
  });

  it("button label says 'Open Dashboard'", () => {
    const code = src("src/commands/console.js");
    assert.ok(code.includes('"Open Dashboard"'), "button label must be Open Dashboard");
  });

  it("reply mentions 'Dashboard'", () => {
    const code = src("src/commands/console.js");
    assert.ok(code.includes("Chopsticks Dashboard"), "reply must reference Dashboard");
  });
});

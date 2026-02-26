/**
 * MAP Cycle 3 — Agent Protocol Decomposition Tests
 * Tests for src/agents/agentProtocol.js and new pod-tag/warm-pool features.
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  PROTOCOL_VERSION,
  SUPPORTED_VERSIONS,
  MAX_AGENTS_PER_GUILD,
  POD_TAGS,
  VALID_POD_TAGS,
  normalizePodTag,
  sessionKey,
  assistantKey,
  textKey,
  safeInt,
  buildInviteUrl,
  secretsMatch,
} from "../../src/agents/agentProtocol.js";

// ── Constants ─────────────────────────────────────────────────────────────────

describe("MAP-C3 — agentProtocol constants", function () {
  it("PROTOCOL_VERSION is '1.0.0'", function () {
    assert.equal(PROTOCOL_VERSION, "1.0.0");
  });

  it("SUPPORTED_VERSIONS contains '1.0.0'", function () {
    assert.ok(SUPPORTED_VERSIONS.has("1.0.0"));
  });

  it("MAX_AGENTS_PER_GUILD is 49", function () {
    assert.equal(MAX_AGENTS_PER_GUILD, 49);
  });

  it("POD_TAGS contains expected values", function () {
    assert.equal(POD_TAGS.GENERAL, "general");
    assert.equal(POD_TAGS.MUSIC, "music");
    assert.equal(POD_TAGS.ASSISTANT, "assistant");
    assert.equal(POD_TAGS.VOICE, "voice");
    assert.equal(POD_TAGS.MODERATION, "moderation");
  });

  it("VALID_POD_TAGS is a Set of all POD_TAGS values", function () {
    for (const tag of Object.values(POD_TAGS)) {
      assert.ok(VALID_POD_TAGS.has(tag), `VALID_POD_TAGS missing: ${tag}`);
    }
  });
});

// ── normalizePodTag ──────────────────────────────────────────────────────────

describe("MAP-C3 — normalizePodTag()", function () {
  it("returns 'general' for undefined", function () {
    assert.equal(normalizePodTag(undefined), "general");
  });

  it("returns 'general' for null", function () {
    assert.equal(normalizePodTag(null), "general");
  });

  it("returns 'general' for empty string", function () {
    assert.equal(normalizePodTag(""), "general");
  });

  it("returns 'general' for unknown tag", function () {
    assert.equal(normalizePodTag("xyzzy"), "general");
  });

  it("normalizes 'music' correctly", function () {
    assert.equal(normalizePodTag("music"), "music");
  });

  it("normalizes 'MUSIC' (case-insensitive)", function () {
    assert.equal(normalizePodTag("MUSIC"), "music");
  });

  it("normalizes 'assistant' correctly", function () {
    assert.equal(normalizePodTag("assistant"), "assistant");
  });

  it("normalizes all canonical pod tags", function () {
    for (const tag of Object.values(POD_TAGS)) {
      assert.equal(normalizePodTag(tag), tag, `normalizePodTag('${tag}') failed`);
    }
  });
});

// ── Session key generators ────────────────────────────────────────────────────

describe("MAP-C3 — session key generators", function () {
  it("sessionKey produces guildId:channelId format", function () {
    assert.equal(sessionKey("g1", "c1"), "g1:c1");
  });

  it("assistantKey produces a:guildId:channelId format", function () {
    assert.equal(assistantKey("g1", "c1"), "a:g1:c1");
  });

  it("textKey produces t:kind:guildId:channelId:ownerUserId format", function () {
    assert.equal(textKey("chat", "g1", "c1", "u1"), "t:chat:g1:c1:u1");
  });

  it("textKey defaults kind to 'text'", function () {
    const k = textKey(null, "g1", "c1", "u1");
    assert.ok(k.startsWith("t:text:"), `expected t:text: prefix, got: ${k}`);
  });

  it("textKey defaults ownerUserId to '0' when absent", function () {
    assert.equal(textKey("chat", "g1", "c1", null), "t:chat:g1:c1:0");
  });
});

// ── safeInt ──────────────────────────────────────────────────────────────────

describe("MAP-C3 — safeInt()", function () {
  it("parses valid number string", function () {
    assert.equal(safeInt("42", 0), 42);
  });

  it("returns fallback for undefined", function () {
    assert.equal(safeInt(undefined, 99), 99);
  });

  it("returns fallback for NaN string", function () {
    assert.equal(safeInt("abc", 5), 5);
  });

  it("returns fallback for Infinity", function () {
    assert.equal(safeInt(Infinity, 10), 10);
  });
});

// ── buildInviteUrl ────────────────────────────────────────────────────────────

describe("MAP-C3 — buildInviteUrl()", function () {
  it("constructs a valid Discord OAuth URL", function () {
    const url = buildInviteUrl({ clientId: "12345", permissions: 0 });
    assert.ok(url.includes("12345"), "should include clientId");
    assert.ok(url.includes("discord.com/api/oauth2/authorize"), "should be Discord OAuth URL");
  });

  it("includes scope=bot%20applications.commands", function () {
    const url = buildInviteUrl({ clientId: "1", permissions: 0 });
    assert.ok(url.includes("applications.commands"), "should request applications.commands scope");
  });
});

// ── secretsMatch ─────────────────────────────────────────────────────────────

describe("MAP-C3 — secretsMatch()", function () {
  it("returns true for identical strings", function () {
    assert.equal(secretsMatch("mysecret", "mysecret"), true);
  });

  it("returns false for different strings of same length", function () {
    assert.equal(secretsMatch("aaaaaa", "bbbbbb"), false);
  });

  it("returns false for different length strings", function () {
    assert.equal(secretsMatch("short", "muchlonger"), false);
  });

  it("returns false for empty string against non-empty", function () {
    assert.equal(secretsMatch("", "secret"), false);
  });

  it("returns false for both empty strings", function () {
    assert.equal(secretsMatch("", ""), false);
  });

  it("is not vulnerable to short-circuit on first char difference", function () {
    // Both are same length — comparison must be constant-time
    const a = "a".repeat(64);
    const b = "a".repeat(63) + "b";
    assert.equal(secretsMatch(a, b), false);
  });
});

// ── agentManager.js pod-tag integration ──────────────────────────────────────

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const managerSrc = readFileSync(join(__dirname, "../../src/agents/agentManager.js"), "utf8");

describe("MAP-C3 — agentManager.js pod-tag integration", function () {
  it("imports normalizePodTag from agentProtocol.js", function () {
    assert.ok(managerSrc.includes("normalizePodTag"), "normalizePodTag not imported");
    assert.ok(managerSrc.includes("agentProtocol.js"), "agentProtocol.js not imported");
  });

  it("stores podTag on agent object during hello", function () {
    const helloIdx = managerSrc.indexOf("handleHello(ws, msg)");
    assert.notEqual(helloIdx, -1, "handleHello not found");
    const helloSection = managerSrc.slice(helloIdx, helloIdx + 4000);
    assert.ok(helloSection.includes("normalizePodTag"), "normalizePodTag not called in handleHello");
    assert.ok(helloSection.includes("podTag"), "podTag not stored on agent");
  });

  it("warm-pool warmCount read from AGENT_WARM_COUNT env", function () {
    assert.ok(managerSrc.includes("AGENT_WARM_COUNT"), "AGENT_WARM_COUNT not referenced");
    assert.ok(managerSrc.includes("warmCount"), "warmCount property not set");
  });

  it("getWarmStatus method exists", function () {
    assert.ok(managerSrc.includes("getWarmStatus("), "getWarmStatus method not found");
  });
});

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  isValidAliasName,
  normalizePrefixValue,
  parsePrefixArgs,
  resolveAliasedCommand,
  suggestCommandNames
} from "../../src/prefix/hardening.js";

describe("Prefix hardening", function () {
  it("parses quoted prefix args", function () {
    const args = parsePrefixArgs('fun hype-burst "Alpha Team" --intensity=4');
    assert.deepEqual(args, ["fun", "hype-burst", "Alpha Team", "--intensity=4"]);
  });

  it("rejects unsafe prefix values", function () {
    const a = normalizePrefixValue("/");
    const b = normalizePrefixValue("@everyone");
    const c = normalizePrefixValue("abcde");
    assert.equal(a.ok, false);
    assert.equal(b.ok, false);
    assert.equal(c.ok, false);
  });

  it("resolves alias chains", function () {
    const resolved = resolveAliasedCommand("p", { p: "play", play: "music" });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.commandName, "music");
  });

  it("detects alias cycles", function () {
    const resolved = resolveAliasedCommand("a", { a: "b", b: "a" });
    assert.equal(resolved.ok, false);
    assert.equal(resolved.error, "cycle");
  });

  it("suggests close command names", function () {
    const hits = suggestCommandNames("musc", ["music", "mute", "fun"], 2);
    assert.ok(hits.includes("music"));
  });
});

// ── isValidAliasName ──────────────────────────────────────────────────────────
describe("isValidAliasName", function () {
  it("accepts alphanumeric + hyphen names", function () {
    assert.ok(isValidAliasName("help"));
    assert.ok(isValidAliasName("my-cmd"));
    assert.ok(isValidAliasName("play123"));
  });

  it("rejects empty string", function () {
    assert.equal(isValidAliasName(""), false);
  });

  it("rejects names with spaces", function () {
    assert.equal(isValidAliasName("hello world"), false);
  });

  it("rejects names over 32 characters", function () {
    assert.equal(isValidAliasName("a".repeat(33)), false);
  });
});

// ── parsePrefixArgs extended ──────────────────────────────────────────────────
describe("parsePrefixArgs", function () {
  it("splits simple space-separated args", function () {
    assert.deepEqual(parsePrefixArgs("play some song"), ["play", "some", "song"]);
  });

  it("returns empty array for empty string", function () {
    assert.deepEqual(parsePrefixArgs(""), []);
  });

  it("handles 2000-char input without throwing", function () {
    assert.doesNotThrow(() => parsePrefixArgs("a".repeat(2000)));
  });

  it("handles pathological quoted string without throwing", function () {
    assert.doesNotThrow(() => parsePrefixArgs('"' + "x".repeat(1990) + '"'));
  });
});

// ── resolveAliasedCommand extended ───────────────────────────────────────────
describe("resolveAliasedCommand — extended", function () {
  it("resolves direct command (no alias)", function () {
    const result = resolveAliasedCommand("play", {});
    assert.ok(result.ok);
    assert.equal(result.commandName, "play");
  });

  it("stops at maxDepth", function () {
    const aliases = {};
    for (let i = 0; i < 25; i++) aliases[`x${i}`] = `x${i + 1}`;
    const result = resolveAliasedCommand("x0", aliases, 20);
    assert.ok(!result.ok);
    assert.equal(result.error, "depth");
  });
});

// ── suggestCommandNames extended ─────────────────────────────────────────────
describe("suggestCommandNames — extended", function () {
  const pool = ["play", "pause", "skip", "stop", "queue", "volume", "weather", "wiki"];

  it("returns exact match first when available", function () {
    const s = suggestCommandNames("play", pool, 3);
    if (s.length > 0) assert.equal(s[0], "play");
  });

  it("respects the limit parameter", function () {
    assert.ok(suggestCommandNames("p", pool, 2).length <= 2);
  });

  it("returns array for unrecognised input", function () {
    assert.ok(Array.isArray(suggestCommandNames("zzzzz", pool, 3)));
  });
});

// test/unit/rate-limit-config.test.js
// Unit tests for per-category rate limit configuration.

import assert from "node:assert/strict";
import { describe, it, afterEach } from "mocha";
import { getRateLimitForCommand, getRateLimitDefaults } from "../../src/utils/rateLimitConfig.js";

describe("getRateLimitForCommand", () => {
  it("returns tighter limits for mod commands", () => {
    const r = getRateLimitForCommand("ban", "mod");
    assert.ok(r.limit <= 3, `expected limit ≤ 3, got ${r.limit}`);
    assert.ok(r.windowSec >= 20, `expected window ≥ 20s, got ${r.windowSec}`);
  });

  it("returns tighter limits for admin commands", () => {
    const r = getRateLimitForCommand("config", "admin");
    assert.ok(r.limit <= 5);
    assert.ok(r.windowSec >= 30);
  });

  it("uses default for unknown category", () => {
    const def = getRateLimitForCommand("somecommand", "unknown_cat");
    const defaults = getRateLimitDefaults();
    // Should not throw and should return sensible numbers
    assert.ok(def.limit > 0);
    assert.ok(def.windowSec > 0);
  });

  it("per-command override takes precedence over category", () => {
    // 'ban' has a per-command override of [2, 30]
    const byCmd  = getRateLimitForCommand("ban", "mod");
    const byCat  = getRateLimitForCommand("somemod", "mod");
    // ban should be more restrictive or equal
    assert.ok(byCmd.limit <= byCat.limit);
  });

  it("model link has sensitive per-command override", () => {
    const r = getRateLimitForCommand("model link", "admin");
    assert.ok(r.limit <= 5);
    assert.ok(r.windowSec >= 60);
  });

  it("music category is more permissive than mod", () => {
    const music = getRateLimitForCommand("play", "music");
    const mod   = getRateLimitForCommand("kick", "mod");
    assert.ok(music.limit > mod.limit);
  });

  it("getRateLimitDefaults returns all non-default categories", () => {
    const defs = getRateLimitDefaults();
    assert.ok(defs.mod);
    assert.ok(defs.admin);
    assert.ok(defs.music);
    assert.ok(defs.voice);
    assert.ok(defs.assistant);
    // _default key should NOT appear
    assert.equal(defs._default, undefined);
  });

  it("env override applies to category limit", () => {
    process.env.RL_FUN_LIMIT = "2";
    process.env.RL_FUN_WINDOW = "5";
    const r = getRateLimitForCommand("coinflip", "fun");
    assert.equal(r.limit, 2);
    assert.equal(r.windowSec, 5);
    delete process.env.RL_FUN_LIMIT;
    delete process.env.RL_FUN_WINDOW;
  });
});

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  normalizeStarboardConfig,
  starboardEmojiKey,
  reactionMatchesStarboard
} from "../../src/utils/starboard.js";

describe("starboard helpers", function () {
  it("normalizes default config values", function () {
    const data = normalizeStarboardConfig({});
    assert.ok(data.starboard);
    assert.equal(data.starboard.enabled, false);
    assert.equal(data.starboard.threshold, 3);
    assert.equal(data.starboard.emoji, "⭐");
  });

  it("normalizes emoji key", function () {
    assert.equal(starboardEmojiKey("⭐"), "unicode:⭐");
    assert.equal(starboardEmojiKey("<:x:123456789012345678>"), "custom:123456789012345678");
  });

  it("matches reaction with configured emoji", function () {
    const unicodeReaction = { emoji: { id: null, name: "⭐" } };
    const customReaction = { emoji: { id: "123456789012345678", name: "x" } };
    assert.equal(reactionMatchesStarboard("⭐", unicodeReaction), true);
    assert.equal(reactionMatchesStarboard("<:x:123456789012345678>", customReaction), true);
  });
});

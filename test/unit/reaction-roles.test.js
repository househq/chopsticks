import { strict as assert } from "node:assert";
import {
  normalizeEmojiInput,
  emojiKeyFromReaction,
  reactionRoleBindingKey,
  normalizeReactionRoleConfig
} from "../../src/utils/reactionRoles.js";

describe("reaction role helpers", function () {
  it("normalizes unicode emoji input", function () {
    assert.equal(normalizeEmojiInput("✅"), "unicode:✅");
  });

  it("normalizes custom emoji input", function () {
    assert.equal(normalizeEmojiInput("<:check:123456789012345678>"), "custom:123456789012345678");
    assert.equal(normalizeEmojiInput("123456789012345678"), "custom:123456789012345678");
  });

  it("builds stable binding key", function () {
    assert.equal(
      reactionRoleBindingKey("10", "20", "unicode:✅"),
      "10:20:unicode:✅"
    );
  });

  it("normalizes guild data shape", function () {
    const data = normalizeReactionRoleConfig({});
    assert.ok(data.reactionRoles);
    assert.deepEqual(data.reactionRoles.bindings, {});
  });

  it("extracts emoji key from reaction payload", function () {
    const custom = emojiKeyFromReaction({ emoji: { id: "123", name: "x" } });
    const unicode = emojiKeyFromReaction({ emoji: { id: null, name: "✅" } });
    assert.equal(custom, "custom:123");
    assert.equal(unicode, "unicode:✅");
  });
});

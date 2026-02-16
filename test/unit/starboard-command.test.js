import { describe, it } from "mocha";
import { strict as assert } from "assert";
import starboardCommand from "../../src/commands/starboard.js";

describe("Starboard command definition", function () {
  it("exposes expected subcommands", function () {
    const json = starboardCommand.data.toJSON();
    assert.equal(json.name, "starboard");
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("setup"));
    assert.ok(names.has("status"));
    assert.ok(names.has("disable"));
    assert.ok(names.has("clear_posts"));
  });
});

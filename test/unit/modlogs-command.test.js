import { describe, it } from "mocha";
import { strict as assert } from "assert";
import modlogsCommand from "../../src/commands/modlogs.js";

describe("Modlogs command definition", function () {
  it("exposes expected subcommands", function () {
    const json = modlogsCommand.data.toJSON();
    assert.equal(json.name, "modlogs");
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("setup"));
    assert.ok(names.has("event"));
    assert.ok(names.has("status"));
    assert.ok(names.has("disable"));
    assert.ok(names.has("test"));
  });
});

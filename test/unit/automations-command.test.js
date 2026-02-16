import { describe, it } from "mocha";
import { strict as assert } from "assert";
import automationsCommand from "../../src/commands/automations.js";

describe("Automations command definition", function () {
  it("exposes expected subcommands", function () {
    const json = automationsCommand.data.toJSON();
    assert.equal(json.name, "automations");
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("create"));
    assert.ok(names.has("template"));
    assert.ok(names.has("list"));
    assert.ok(names.has("enable"));
    assert.ok(names.has("disable"));
    assert.ok(names.has("delete"));
    assert.ok(names.has("run"));
  });
});

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import setupCommand, { handleSelect, handleButton } from "../../src/commands/setup.js";

describe("Setup command definition", function () {
  it("exposes wizard and status subcommands", function () {
    const json = setupCommand.data.toJSON();
    assert.equal(json.name, "setup");
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("wizard"));
    assert.ok(names.has("status"));
  });

  it("exports setup component handlers", function () {
    assert.equal(typeof handleSelect, "function");
    assert.equal(typeof handleButton, "function");
  });
});

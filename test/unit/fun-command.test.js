import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { data as funData, execute, autocomplete } from "../../src/commands/fun.js";

describe("Fun command definition", function () {
  it("includes play/random/catalog/settings subcommands", function () {
    const json = funData.toJSON();
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("play"));
    assert.ok(names.has("random"));
    assert.ok(names.has("catalog"));
    assert.ok(names.has("settings"));
  });

  it("exports execute + autocomplete", function () {
    assert.equal(typeof execute, "function");
    assert.equal(typeof autocomplete, "function");
  });
});

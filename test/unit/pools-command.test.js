import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { data, autocomplete, handleSelect, handleButton } from "../../src/commands/pools.js";

describe("Pools command definition", function () {
  it("exposes select subcommand", function () {
    const json = data.toJSON();
    assert.equal(json.name, "pools");
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("select"));
    assert.ok(names.has("ui"));
    assert.ok(names.has("setup"));
  });

  it("exports autocomplete handler", function () {
    assert.equal(typeof autocomplete, "function");
  });

  it("exports ui component handlers", function () {
    assert.equal(typeof handleSelect, "function");
    assert.equal(typeof handleButton, "function");
  });

  it("enables autocomplete on key pool options", function () {
    const json = data.toJSON();
    const check = name => {
      const sub = (json.options || []).find(o => o.name === name);
      assert.ok(sub, `${name} subcommand missing`);
      const poolOpt = (sub.options || []).find(o => o.name === "pool");
      assert.ok(poolOpt, `${name}.pool option missing`);
      assert.equal(poolOpt.autocomplete, true, `${name}.pool autocomplete should be true`);
    };
    check("view");
    check("select");
    check("delete");
    check("transfer");
    check("contributions");
    check("admin_view");
  });
});

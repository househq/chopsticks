import { describe, it } from "mocha";
import { strict as assert } from "assert";
import levelsCommand from "../../src/commands/levels.js";

describe("Levels command definition", function () {
  it("exposes /levels rewards group with expected subcommands", function () {
    const json = levelsCommand.data.toJSON();
    assert.equal(json.name, "levels");
    const groups = (json.options || []).filter(o => o.type === 2);
    const rewards = groups.find(g => g.name === "rewards");
    assert.ok(rewards, "rewards group missing");
    const subs = new Set((rewards.options || []).map(s => s.name));
    assert.ok(subs.has("add"));
    assert.ok(subs.has("remove"));
    assert.ok(subs.has("list"));
    assert.ok(subs.has("sync"));
  });
});

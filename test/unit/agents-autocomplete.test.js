import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { data, autocomplete } from "../../src/commands/agents.js";

describe("Agents command autocomplete", function () {
  it("exports autocomplete handler", function () {
    assert.equal(typeof autocomplete, "function");
  });

  it("enables autocomplete on deploy from_pool", function () {
    const json = data.toJSON();
    const deploy = (json.options || []).find(o => o.name === "deploy");
    assert.ok(deploy, "deploy subcommand missing");
    const fromPool = (deploy.options || []).find(o => o.name === "from_pool");
    assert.ok(fromPool, "from_pool option missing");
    assert.equal(fromPool.autocomplete, true);
  });

  it("enables autocomplete on add_token pool option", function () {
    const json = data.toJSON();
    const addToken = (json.options || []).find(o => o.name === "add_token");
    assert.ok(addToken, "add_token subcommand missing");
    const pool = (addToken.options || []).find(o => o.name === "pool");
    assert.ok(pool, "pool option missing");
    assert.equal(pool.autocomplete, true);
  });
});

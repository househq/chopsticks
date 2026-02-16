import { describe, it } from "mocha";
import { strict as assert } from "assert";
import ticketsCommand, { handleButton, handleSelect } from "../../src/commands/tickets.js";

describe("Tickets command definition", function () {
  it("exposes expected subcommands", function () {
    const json = ticketsCommand.data.toJSON();
    assert.equal(json.name, "tickets");
    const names = new Set((json.options || []).map(o => o.name));
    assert.ok(names.has("setup"));
    assert.ok(names.has("panel"));
    assert.ok(names.has("status"));
    assert.ok(names.has("open"));
    assert.ok(names.has("close"));
  });

  it("exports ticket component handlers", function () {
    assert.equal(typeof handleButton, "function");
    assert.equal(typeof handleSelect, "function");
  });
});

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { data as triviaCommand, handleSelect, handleButton } from "../../src/commands/trivia.js";

describe("Trivia command definition", function () {
  it("exposes /trivia start + stop", function () {
    const json = triviaCommand.toJSON();
    assert.equal(json.name, "trivia");
    const subs = (json.options || []).filter(o => o.type === 1).map(o => o.name);
    assert.ok(subs.includes("start"));
    assert.ok(subs.includes("stop"));
  });

  it("exports component handlers", function () {
    assert.equal(typeof handleSelect, "function");
    assert.equal(typeof handleButton, "function");
  });
});


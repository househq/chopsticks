import { describe, it } from "mocha";
import { strict as assert } from "assert";

// ── Weather ───────────────────────────────────────────────────────────────────
import { data as weatherData, execute as weatherExecute } from "../../src/commands/weather.js";
describe("weather command", function () {
  it("is named 'weather'", function () {
    assert.equal(weatherData.toJSON().name, "weather");
  });
  it("requires a 'location' option", function () {
    const opts = weatherData.toJSON().options ?? [];
    const loc = opts.find(o => o.name === "location");
    assert.ok(loc, "location option missing");
    assert.ok(loc.required, "location should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof weatherExecute, "function");
  });
});

// ── Open-Meteo utility ────────────────────────────────────────────────────────
import { wmoLabel } from "../../src/utils/openmeteo.js";
describe("openmeteo wmoLabel", function () {
  it("returns emoji+label tuple for known code 0", function () {
    const [emoji, label] = wmoLabel(0);
    assert.equal(emoji, "☀️");
    assert.ok(label.length > 0);
  });
  it("returns a fallback tuple for unknown code 999", function () {
    const [emoji, label] = wmoLabel(999);
    assert.ok(typeof emoji === "string");
    assert.ok(typeof label === "string");
  });
});

// ── OTDB helper ───────────────────────────────────────────────────────────────
import { pickTriviaQuestion, pickTriviaQuestionWithFallback } from "../../src/game/trivia/bank.js";
describe("trivia bank with OTDB fallback", function () {
  it("pickTriviaQuestion returns an object or null", function () {
    const q = pickTriviaQuestion({ difficulty: "easy" });
    assert.ok(q === null || (typeof q === "object" && q.prompt));
  });
  it("pickTriviaQuestionWithFallback returns a promise", function () {
    const p = pickTriviaQuestionWithFallback({ difficulty: "easy" });
    assert.ok(p && typeof p.then === "function");
    return p.then(q => assert.ok(q === null || (typeof q === "object" && (q.prompt || q.question))));
  });
});

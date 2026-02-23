import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { data as triviaCommand, handleSelect, handleButton } from "../../src/commands/trivia.js";

describe("Trivia command definition", function () {
  it("exposes /trivia start + solo + versus + fleet + stop", function () {
    const json = triviaCommand.toJSON();
    assert.equal(json.name, "trivia");
    const subs = (json.options || []).filter(o => o.type === 1).map(o => o.name);
    assert.ok(subs.includes("start"));
    assert.ok(subs.includes("solo"));
    assert.ok(subs.includes("versus"));
    assert.ok(subs.includes("fleet"));
    assert.ok(subs.includes("stop"));
  });

  it("supports opponents option on start and fleet", function () {
    const json = triviaCommand.toJSON();
    const byName = new Map((json.options || []).filter(o => o.type === 1).map(o => [o.name, o]));
    const start = byName.get("start");
    const fleet = byName.get("fleet");
    assert.ok(start);
    assert.ok(fleet);
    const startOpp = (start.options || []).find(o => o.name === "opponents");
    const fleetOpp = (fleet.options || []).find(o => o.name === "opponents");
    assert.ok(startOpp);
    assert.ok(fleetOpp);
  });

  it("requires a user option for versus", function () {
    const json = triviaCommand.toJSON();
    const versus = (json.options || []).find(o => o.type === 1 && o.name === "versus");
    assert.ok(versus);
    const userOpt = (versus.options || []).find(o => o.name === "user");
    assert.ok(userOpt);
    assert.equal(userOpt.type, 6); // USER
    assert.equal(Boolean(userOpt.required), true);
  });

  it("exports component handlers", function () {
    assert.equal(typeof handleSelect, "function");
    assert.equal(typeof handleButton, "function");
  });
});

// ── Trivia bank + OTDB fallback ───────────────────────────────────────────────
import {
  TRIVIA_DIFFICULTIES,
  TRIVIA_CATEGORIES,
  listTriviaCategories,
  pickTriviaQuestion,
  pickTriviaQuestionWithFallback,
} from "../../src/game/trivia/bank.js";
import { OTDB_CATEGORIES } from "../../src/game/trivia/opentdb.js";

describe("Trivia bank", function () {
  it("exports expected difficulty levels", function () {
    assert.ok(Array.isArray(TRIVIA_DIFFICULTIES));
    assert.ok(TRIVIA_DIFFICULTIES.includes("easy"));
    assert.ok(TRIVIA_DIFFICULTIES.includes("hard"));
  });

  it("exports expected categories", function () {
    assert.ok(Array.isArray(TRIVIA_CATEGORIES));
    assert.ok(TRIVIA_CATEGORIES.includes("General"));
  });

  it("listTriviaCategories returns array", function () {
    const cats = listTriviaCategories();
    assert.ok(Array.isArray(cats));
    assert.ok(cats.length > 0);
  });

  it("pickTriviaQuestion returns null or valid question shape", function () {
    const q = pickTriviaQuestion({ difficulty: "easy", category: "General" });
    if (q !== null) {
      assert.ok(typeof q === "object");
      // Local bank uses 'prompt', OTDB uses 'question'
      assert.ok(q.prompt || q.question, "question must have prompt or question field");
    }
  });

  it("pickTriviaQuestionWithFallback returns a function", function () {
    assert.equal(typeof pickTriviaQuestionWithFallback, "function");
  });

  it("pickTriviaQuestionWithFallback resolves to null or question object", async function () {
    // Run with no network — will return local question or null
    const result = await pickTriviaQuestionWithFallback({ difficulty: "easy", category: "General" });
    if (result !== null) {
      assert.ok(typeof result === "object");
      assert.ok(result.prompt || result.question);
    }
  });
});

describe("OTDB module", function () {
  it("OTDB_CATEGORIES is a non-empty array of strings", function () {
    assert.ok(Array.isArray(OTDB_CATEGORIES));
    assert.ok(OTDB_CATEGORIES.length > 0);
    assert.ok(OTDB_CATEGORIES.every(c => typeof c === "string"));
  });

  it("includes expected categories", function () {
    assert.ok(OTDB_CATEGORIES.includes("General"));
    assert.ok(OTDB_CATEGORIES.includes("Music"));
    assert.ok(OTDB_CATEGORIES.includes("Tech"));
  });
});

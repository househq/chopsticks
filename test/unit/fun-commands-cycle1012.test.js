// test/unit/fun-commands-cycle1012.test.js
// Unit tests for fun commands added in Cycles 10–12
// Covers: compliment, wouldyourather, ship, battle, riddle, roast (JSON bank + spam guard)

import { describe, it, before } from "mocha";
import { strict as assert } from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ── Roast JSON bank ───────────────────────────────────────────────────────────
describe("roasts.json bank", function () {
  let roasts;
  before(function () {
    roasts = require("../../src/fun/roasts.json");
  });

  it("exports an array", function () {
    assert.ok(Array.isArray(roasts));
  });
  it("has at least 50 entries", function () {
    assert.ok(roasts.length >= 50, `only ${roasts.length} entries`);
  });
  it("every entry is a non-empty string", function () {
    for (const r of roasts) {
      assert.equal(typeof r, "string");
      assert.ok(r.trim().length > 0, "found empty roast string");
    }
  });
  it("no duplicate roasts", function () {
    const unique = new Set(roasts);
    assert.equal(unique.size, roasts.length, "duplicate roast strings found");
  });
});

// ── /roast command ────────────────────────────────────────────────────────────
import { data as roastData, execute as roastExecute, meta as roastMeta } from "../../src/commands/roast.js";

describe("/roast command", function () {
  it("is named 'roast'", function () {
    assert.equal(roastData.toJSON().name, "roast");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof roastExecute, "function");
  });
  it("has meta.category = 'fun'", function () {
    assert.equal(roastMeta.category, "fun");
  });
  it("has optional 'target' user option", function () {
    const opts = roastData.toJSON().options || [];
    const target = opts.find(o => o.name === "target");
    assert.ok(target, "missing 'target' option");
    assert.equal(target.required, false);
    assert.equal(target.type, 6); // USER type
  });
  it("has optional 'vibe' string option with 4 choices", function () {
    const opts = roastData.toJSON().options || [];
    const vibe = opts.find(o => o.name === "vibe");
    assert.ok(vibe, "missing 'vibe' option");
    assert.equal(vibe.choices.length, 4);
    const values = vibe.choices.map(c => c.value);
    for (const v of ["playful", "hard", "nerdy", "rap"]) {
      assert.ok(values.includes(v), `missing vibe choice '${v}'`);
    }
  });
});

// ── /compliment command ───────────────────────────────────────────────────────
import { data as complimentData, execute as complimentExecute, meta as complimentMeta } from "../../src/commands/compliment.js";

describe("/compliment command", function () {
  it("is named 'compliment'", function () {
    assert.equal(complimentData.toJSON().name, "compliment");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof complimentExecute, "function");
  });
  it("has meta.category = 'fun'", function () {
    assert.equal(complimentMeta.category, "fun");
  });
  it("has optional 'target' user option", function () {
    const opts = complimentData.toJSON().options || [];
    const target = opts.find(o => o.name === "target");
    assert.ok(target, "missing 'target' option");
    assert.equal(target.required, false);
    assert.equal(target.type, 6);
  });
  it("has optional 'style' choice option with 4 choices", function () {
    const opts = complimentData.toJSON().options || [];
    const style = opts.find(o => o.name === "style");
    assert.ok(style, "missing 'style' option");
    assert.equal(style.choices.length, 4);
    const values = style.choices.map(c => c.value);
    for (const v of ["genuine", "dramatic", "nerdy", "rap"]) {
      assert.ok(values.includes(v), `missing style choice '${v}'`);
    }
  });
});

// ── WYR JSON bank ─────────────────────────────────────────────────────────────
describe("wyr.json bank", function () {
  let questions;
  before(function () {
    questions = require("../../src/fun/wyr.json");
  });

  it("exports an array", function () {
    assert.ok(Array.isArray(questions));
  });
  it("has at least 50 entries", function () {
    assert.ok(questions.length >= 50, `only ${questions.length} entries`);
  });
  it("every entry is a 2-element array of non-empty strings", function () {
    for (const q of questions) {
      assert.ok(Array.isArray(q), "entry is not an array");
      assert.equal(q.length, 2, "entry does not have exactly 2 choices");
      assert.equal(typeof q[0], "string");
      assert.equal(typeof q[1], "string");
      assert.ok(q[0].trim().length > 0, "first choice is empty");
      assert.ok(q[1].trim().length > 0, "second choice is empty");
    }
  });
  it("no two questions have identical first choice", function () {
    const firsts = questions.map(q => q[0]);
    const unique = new Set(firsts);
    assert.equal(unique.size, firsts.length, "duplicate first choices found");
  });
});

// ── /wouldyourather command ───────────────────────────────────────────────────
import { data as wyrData, execute as wyrExecute, meta as wyrMeta } from "../../src/commands/wouldyourather.js";

describe("/wouldyourather command", function () {
  it("is named 'wouldyourather'", function () {
    assert.equal(wyrData.toJSON().name, "wouldyourather");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof wyrExecute, "function");
  });
  it("has meta.category = 'fun'", function () {
    assert.equal(wyrMeta.category, "fun");
  });
  it("takes no required options", function () {
    const opts = wyrData.toJSON().options || [];
    const required = opts.filter(o => o.required);
    assert.equal(required.length, 0, "should have no required options");
  });
});

// ── /ship — deterministic score ───────────────────────────────────────────────
import { data as shipData, execute as shipExecute, meta as shipMeta } from "../../src/commands/ship.js";

// Replicate the internal shipScore function to test it independently
function shipScore(idA, idB) {
  const [lo, hi] = [idA, idB].sort();
  let h = 5381;
  for (const c of `${lo}:${hi}`) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h % 101;
}

describe("/ship command", function () {
  it("is named 'ship'", function () {
    assert.equal(shipData.toJSON().name, "ship");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof shipExecute, "function");
  });
  it("has meta.category = 'fun'", function () {
    assert.equal(shipMeta.category, "fun");
  });
  it("requires user1 option", function () {
    const opts = shipData.toJSON().options || [];
    const u1 = opts.find(o => o.name === "user1");
    assert.ok(u1, "missing 'user1' option");
    assert.equal(u1.required, true);
    assert.equal(u1.type, 6);
  });
  it("user2 is optional", function () {
    const opts = shipData.toJSON().options || [];
    const u2 = opts.find(o => o.name === "user2");
    assert.ok(u2, "missing 'user2' option");
    assert.equal(u2.required, false);
  });

  describe("shipScore determinism", function () {
    it("same pair always returns same score", function () {
      const s1 = shipScore("111111111111111111", "222222222222222222");
      const s2 = shipScore("111111111111111111", "222222222222222222");
      assert.equal(s1, s2);
    });
    it("is commutative (A,B) === (B,A)", function () {
      const ab = shipScore("123456789", "987654321");
      const ba = shipScore("987654321", "123456789");
      assert.equal(ab, ba);
    });
    it("returns a value in range 0–100", function () {
      for (const pair of [["1", "2"], ["99999", "11111"], ["a", "b"], ["0", "0"]]) {
        const s = shipScore(pair[0], pair[1]);
        assert.ok(s >= 0 && s <= 100, `score ${s} out of range`);
      }
    });
    it("different pairs produce different scores (no trivial collision)", function () {
      const scores = new Set();
      for (let i = 0; i < 20; i++) {
        scores.add(shipScore(String(i * 7 + 100), String(i * 13 + 200)));
      }
      assert.ok(scores.size > 10, "suspiciously many collisions in shipScore");
    });
  });
});

// ── /battle command ───────────────────────────────────────────────────────────
import { data as battleData, execute as battleExecute, meta as battleMeta } from "../../src/commands/battle.js";

describe("/battle command", function () {
  it("is named 'battle'", function () {
    assert.equal(battleData.toJSON().name, "battle");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof battleExecute, "function");
  });
  it("has meta.category = 'fun'", function () {
    assert.equal(battleMeta.category, "fun");
  });
  it("has meta.guildOnly = true", function () {
    assert.equal(battleMeta.guildOnly, true);
  });
  it("requires 'opponent' user option", function () {
    const opts = battleData.toJSON().options || [];
    const opp = opts.find(o => o.name === "opponent");
    assert.ok(opp, "missing 'opponent' option");
    assert.equal(opp.required, true);
    assert.equal(opp.type, 6);
  });
  it("has optional 'wager' integer option with min 10 max 5000", function () {
    const opts = battleData.toJSON().options || [];
    const wager = opts.find(o => o.name === "wager");
    assert.ok(wager, "missing 'wager' option");
    assert.equal(wager.required, false);
    assert.equal(wager.min_value, 10);
    assert.equal(wager.max_value, 5000);
  });
});

// ── Riddles JSON bank ─────────────────────────────────────────────────────────
describe("riddles.json bank", function () {
  let riddles;
  before(function () {
    riddles = require("../../src/fun/riddles.json");
  });

  it("exports an array", function () {
    assert.ok(Array.isArray(riddles));
  });
  it("has at least 75 entries", function () {
    assert.ok(riddles.length >= 75, `only ${riddles.length} entries`);
  });
  it("every entry has non-empty 'q' and 'a' string fields", function () {
    for (const r of riddles) {
      assert.equal(typeof r.q, "string", "q field missing or wrong type");
      assert.equal(typeof r.a, "string", "a field missing or wrong type");
      assert.ok(r.q.trim().length > 0, "empty question");
      assert.ok(r.a.trim().length > 0, "empty answer");
    }
  });
  it("no duplicate questions", function () {
    const questions = riddles.map(r => r.q);
    const unique = new Set(questions);
    assert.equal(unique.size, questions.length, "duplicate riddle questions found");
  });
});

// ── /riddle command ───────────────────────────────────────────────────────────
import { data as riddleData, execute as riddleExecute, meta as riddleMeta } from "../../src/commands/riddle.js";

describe("/riddle command", function () {
  it("is named 'riddle'", function () {
    assert.equal(riddleData.toJSON().name, "riddle");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof riddleExecute, "function");
  });
  it("has meta.category = 'fun'", function () {
    assert.equal(riddleMeta.category, "fun");
  });
  it("has optional 'reveal' boolean option", function () {
    const opts = riddleData.toJSON().options || [];
    const reveal = opts.find(o => o.name === "reveal");
    assert.ok(reveal, "missing 'reveal' option");
    assert.equal(reveal.required, false);
    assert.equal(reveal.type, 5); // BOOLEAN type
  });
  it("takes no required options", function () {
    const opts = riddleData.toJSON().options || [];
    const required = opts.filter(o => o.required);
    assert.equal(required.length, 0);
  });
});

// ── /imagine command meta ─────────────────────────────────────────────────────
import { data as imagineData, execute as imagineExecute, meta as imagineMeta } from "../../src/commands/imagine.js";

describe("/imagine command", function () {
  it("is named 'imagine'", function () {
    assert.equal(imagineData.toJSON().name, "imagine");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof imagineExecute, "function");
  });
  it("requires 'prompt' string option with maxLength 500", function () {
    const opts = imagineData.toJSON().options || [];
    const prompt = opts.find(o => o.name === "prompt");
    assert.ok(prompt, "missing 'prompt' option");
    assert.equal(prompt.required, true);
    assert.equal(prompt.max_length, 500);
  });
  it("has optional 'style' option with 6 choices", function () {
    const opts = imagineData.toJSON().options || [];
    const style = opts.find(o => o.name === "style");
    assert.ok(style, "missing 'style' option");
    assert.equal(style.choices.length, 6);
    const values = style.choices.map(c => c.value);
    for (const v of ["default", "artistic", "photorealistic", "fantasy", "cyberpunk", "anime"]) {
      assert.ok(values.includes(v), `missing style choice '${v}'`);
    }
  });
});

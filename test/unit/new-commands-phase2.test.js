import { describe, it } from "mocha";
import { strict as assert } from "assert";

// ── Mod ───────────────────────────────────────────────────────────────────────
import { data as modData, execute as modExecute } from "../../src/commands/mod.js";
describe("mod command", function () {
  it("is named 'mod'", function () {
    assert.equal(modData.toJSON().name, "mod");
  });
  it("has ban/unban/softban/massban/kick/timeout/warn/warnings/clearwarns subcommands", function () {
    const subNames = new Set((modData.toJSON().options || []).map(o => o.name));
    const required = ["ban", "unban", "softban", "massban", "kick", "timeout", "warn", "warnings", "clearwarns"];
    for (const r of required) assert.ok(subNames.has(r), `missing '${r}' subcommand`);
  });
  it("exports execute as a function", function () {
    assert.equal(typeof modExecute, "function");
  });
});

// ── Lockdown ──────────────────────────────────────────────────────────────────
import { data as lockdownData, execute as lockdownExecute, meta as lockdownMeta } from "../../src/commands/lockdown.js";
import { PermissionFlagsBits } from "discord.js";
describe("lockdown command", function () {
  it("is named 'lockdown'", function () {
    assert.equal(lockdownData.toJSON().name, "lockdown");
  });
  it("has start/end/lock/unlock subcommands", function () {
    const subNames = new Set((lockdownData.toJSON().options || []).map(o => o.name));
    for (const r of ["start", "end", "lock", "unlock"]) assert.ok(subNames.has(r), `missing '${r}' subcommand`);
  });
  it("has ManageChannels in defaultMemberPermissions", function () {
    const json = lockdownData.toJSON();
    assert.ok(json.default_member_permissions != null, "defaultMemberPermissions should be set");
  });
  it("meta has ManageChannels userPerms", function () {
    assert.ok(Array.isArray(lockdownMeta.userPerms), "userPerms should be an array");
    assert.ok(lockdownMeta.userPerms.includes(PermissionFlagsBits.ManageChannels));
  });
  it("exports execute as a function", function () {
    assert.equal(typeof lockdownExecute, "function");
  });
});

// ── Roast ─────────────────────────────────────────────────────────────────────
import { data as roastData, execute as roastExecute } from "../../src/commands/roast.js";
describe("roast command", function () {
  it("is named 'roast'", function () {
    assert.equal(roastData.toJSON().name, "roast");
  });
  it("has a 'target' user option", function () {
    const opts = roastData.toJSON().options ?? [];
    const target = opts.find(o => o.name === "target");
    assert.ok(target, "target option missing");
  });
  it("has a 'vibe' string option with choices", function () {
    const opts = roastData.toJSON().options ?? [];
    const vibe = opts.find(o => o.name === "vibe");
    assert.ok(vibe, "vibe option missing");
    assert.ok(Array.isArray(vibe.choices) && vibe.choices.length > 0, "vibe should have choices");
  });
  it("vibe choices include playful and rap", function () {
    const opts = roastData.toJSON().options ?? [];
    const vibe = opts.find(o => o.name === "vibe");
    const values = new Set(vibe.choices.map(c => c.value));
    assert.ok(values.has("playful"), "missing 'playful' choice");
    assert.ok(values.has("rap"), "missing 'rap' choice");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof roastExecute, "function");
  });
});

// ── Imagine ───────────────────────────────────────────────────────────────────
import { data as imagineData, execute as imagineExecute } from "../../src/commands/imagine.js";
describe("imagine command", function () {
  it("is named 'imagine'", function () {
    assert.equal(imagineData.toJSON().name, "imagine");
  });
  it("has a required 'prompt' string option", function () {
    const opts = imagineData.toJSON().options ?? [];
    const prompt = opts.find(o => o.name === "prompt");
    assert.ok(prompt, "prompt option missing");
    assert.ok(prompt.required, "prompt should be required");
  });
  it("has an optional 'style' string option with choices", function () {
    const opts = imagineData.toJSON().options ?? [];
    const style = opts.find(o => o.name === "style");
    assert.ok(style, "style option missing");
    assert.ok(!style.required, "style should be optional");
    assert.ok(Array.isArray(style.choices) && style.choices.length > 0, "style should have choices");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof imagineExecute, "function");
  });
});

// ── Dadjoke ───────────────────────────────────────────────────────────────────
import { data as dadjokeData, execute as dadjokeExecute } from "../../src/commands/dadjoke.js";
describe("dadjoke command", function () {
  it("is named 'dadjoke'", function () {
    assert.equal(dadjokeData.toJSON().name, "dadjoke");
  });
  it("has no required options", function () {
    const opts = dadjokeData.toJSON().options ?? [];
    assert.ok(opts.every(o => !o.required), "dadjoke should have no required options");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof dadjokeExecute, "function");
  });
});

// ── Fact ─────────────────────────────────────────────────────────────────────
import { data as factData, execute as factExecute } from "../../src/commands/fact.js";
describe("fact command (phase2)", function () {
  it("is named 'fact'", function () {
    assert.equal(factData.toJSON().name, "fact");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof factExecute, "function");
  });
});

// ── Wiki ─────────────────────────────────────────────────────────────────────
import { data as wikiData, execute as wikiExecute } from "../../src/commands/wiki.js";
describe("wiki command (phase2)", function () {
  it("is named 'wiki'", function () {
    assert.equal(wikiData.toJSON().name, "wiki");
  });
  it("has a required 'query' option", function () {
    const opts = wikiData.toJSON().options ?? [];
    const q = opts.find(o => o.name === "query");
    assert.ok(q, "query option missing");
    assert.ok(q.required, "query should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof wikiExecute, "function");
  });
});

// ── Joke ─────────────────────────────────────────────────────────────────────
import { data as jokeData, execute as jokeExecute } from "../../src/commands/joke.js";
describe("joke command (phase2)", function () {
  it("is named 'joke'", function () {
    assert.equal(jokeData.toJSON().name, "joke");
  });
  it("has 'category' option with choices", function () {
    const opts = jokeData.toJSON().options ?? [];
    const cat = opts.find(o => o.name === "category");
    assert.ok(cat, "category option missing");
    assert.ok(Array.isArray(cat.choices) && cat.choices.length > 0, "category should have choices");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof jokeExecute, "function");
  });
});

// ── Book ─────────────────────────────────────────────────────────────────────
import { data as bookData, execute as bookExecute } from "../../src/commands/book.js";
describe("book command (phase2)", function () {
  it("is named 'book'", function () {
    assert.equal(bookData.toJSON().name, "book");
  });
  it("has a required 'query' option", function () {
    const opts = bookData.toJSON().options ?? [];
    const q = opts.find(o => o.name === "query");
    assert.ok(q, "query option missing");
    assert.ok(q.required, "query should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof bookExecute, "function");
  });
});

// ── Urban Dictionary ──────────────────────────────────────────────────────────
import { data as urbanData, execute as urbanExecute } from "../../src/commands/urban.js";
describe("urban command (phase2)", function () {
  it("is named 'urban'", function () {
    assert.equal(urbanData.toJSON().name, "urban");
  });
  it("has a required 'term' option", function () {
    const opts = urbanData.toJSON().options ?? [];
    const t = opts.find(o => o.name === "term");
    assert.ok(t, "term option missing");
    assert.ok(t.required, "term should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof urbanExecute, "function");
  });
});

// ── APOD ─────────────────────────────────────────────────────────────────────
import { data as apodData, execute as apodExecute } from "../../src/commands/apod.js";
describe("apod command (phase2)", function () {
  it("is named 'apod'", function () {
    assert.equal(apodData.toJSON().name, "apod");
  });
  it("has optional 'date' option", function () {
    const opts = apodData.toJSON().options ?? [];
    const date = opts.find(o => o.name === "date");
    assert.ok(date, "date option missing");
    assert.ok(!date.required, "date should be optional");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof apodExecute, "function");
  });
});

// ── GitHub ────────────────────────────────────────────────────────────────────
import { data as githubData, execute as githubExecute } from "../../src/commands/github.js";
describe("github command (phase2)", function () {
  it("is named 'github'", function () {
    assert.equal(githubData.toJSON().name, "github");
  });
  it("has a required 'query' option", function () {
    const opts = githubData.toJSON().options ?? [];
    const q = opts.find(o => o.name === "query");
    assert.ok(q, "query option missing");
    assert.ok(q.required, "query should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof githubExecute, "function");
  });
});

// ── Color ─────────────────────────────────────────────────────────────────────
import { data as colorData, execute as colorExecute } from "../../src/commands/color.js";
describe("color command", function () {
  it("is named 'color'", function () {
    assert.equal(colorData.toJSON().name, "color");
  });
  it("has a required 'hex' option", function () {
    const opts = colorData.toJSON().options ?? [];
    const hex = opts.find(o => o.name === "hex");
    assert.ok(hex, "hex option missing");
    assert.ok(hex.required, "hex should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof colorExecute, "function");
  });
});

// ── Anime ─────────────────────────────────────────────────────────────────────
import { data as animeData, execute as animeExecute } from "../../src/commands/anime.js";
describe("anime command (phase2)", function () {
  it("is named 'anime'", function () {
    assert.equal(animeData.toJSON().name, "anime");
  });
  it("has a required 'title' option", function () {
    const opts = animeData.toJSON().options ?? [];
    const t = opts.find(o => o.name === "title");
    assert.ok(t, "title option missing");
    assert.ok(t.required, "title should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof animeExecute, "function");
  });
});

// ── Steam ─────────────────────────────────────────────────────────────────────
import { data as steamData, execute as steamExecute } from "../../src/commands/steam.js";
describe("steam command", function () {
  it("is named 'steam'", function () {
    assert.equal(steamData.toJSON().name, "steam");
  });
  it("has a required 'profile' option", function () {
    const opts = steamData.toJSON().options ?? [];
    const p = opts.find(o => o.name === "profile");
    assert.ok(p, "profile option missing");
    assert.ok(p.required, "profile should be required");
  });
  it("exports execute as a function", function () {
    assert.equal(typeof steamExecute, "function");
  });
});

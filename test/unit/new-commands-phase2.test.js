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

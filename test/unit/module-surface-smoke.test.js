import { describe, it } from "mocha";
import { strict as assert } from "assert";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve("src");
const COMMANDS_DIR = path.join(ROOT, "commands");
const EVENTS_DIR = path.join(ROOT, "events");

describe("Module surface smoke", function () {
  this.timeout(15000);

  it("loads all command modules with unique slash names", async function () {
    const files = fs
      .readdirSync(COMMANDS_DIR)
      .filter(file => file.endsWith(".js"))
      .sort();

    const commandNames = new Map();
    const invalid = [];
    for (const file of files) {
      const mod = await import(pathToFileURL(path.join(COMMANDS_DIR, file)).href);
      const cmd =
        mod.default ??
        (mod.data && mod.execute
          ? { data: mod.data, execute: mod.execute, meta: mod.meta, autocomplete: mod.autocomplete }
          : null);

      if (!cmd?.data?.name || typeof cmd.execute !== "function") {
        invalid.push(file);
        continue;
      }

      const name = cmd.data.name;
      if (commandNames.has(name)) {
        assert.fail(`duplicate slash command name "${name}" in ${commandNames.get(name)} and ${file}`);
      }
      commandNames.set(name, file);
    }

    assert.deepEqual(invalid, [], `invalid command module(s): ${invalid.join(", ")}`);
    assert.ok(commandNames.size >= 70, "expected at least 70 command modules to load");
  });

  it("loads all event modules with valid contracts", async function () {
    const files = fs
      .readdirSync(EVENTS_DIR)
      .filter(file => file.endsWith(".js"))
      .sort();

    const invalid = [];
    for (const file of files) {
      const mod = await import(pathToFileURL(path.join(EVENTS_DIR, file)).href);
      const event = mod.default;
      if (!event?.name || typeof event.execute !== "function") {
        invalid.push(file);
      }
    }

    assert.deepEqual(invalid, [], `invalid event module(s): ${invalid.join(", ")}`);
    assert.ok(files.length >= 5, "expected at least 5 event modules to load");
  });
});

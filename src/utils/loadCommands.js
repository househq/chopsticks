// src/utils/loadCommands.js
// PURE COMMAND LOADER — DIAGNOSTIC SAFE

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { botLogger } from "./modernLogger.js";

export async function loadCommands() {
  const commands = new Map();

  const dir = path.join(process.cwd(), "src", "commands");
  if (!fs.existsSync(dir)) return commands;

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const fullPath = path.join(dir, file);

    let mod;
    try {
      mod = await import(pathToFileURL(fullPath).href);
    } catch (err) {
      botLogger.error({ err, file }, "COMMAND IMPORT FAILURE");
      process.exit(1);
    }

    const cmd =
      mod.default ??
      (mod.data && mod.execute ? { data: mod.data, execute: mod.execute } : null);

    if (!cmd?.data || !cmd?.execute) continue;

    // 🔒 SERIALIZATION PROBE — THIS IS WHERE YOUR ERROR IS
    try {
      cmd.data.toJSON();
    } catch (err) {
      botLogger.error({ err, file, commandName: cmd.data?.name }, "COMMAND BUILD FAILURE");
      process.exit(1);
    }

    commands.set(cmd.data.name, cmd);
  }

  return commands;
}

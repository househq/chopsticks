// src/utils/loadCommands.js
// PURE COMMAND LOADER — DIAGNOSTIC SAFE

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

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
      console.error("\n=== COMMAND IMPORT FAILURE ===");
      console.error("File:", file);
      console.error(err);
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
      console.error("\n=== COMMAND BUILD FAILURE ===");
      console.error("File:", file);
      console.error("Command name:", cmd.data?.name);
      console.error("Builder object:", cmd.data);
      console.error("Error:", err);
      process.exit(1);
    }

    commands.set(cmd.data.name, cmd);
  }

  return commands;
}

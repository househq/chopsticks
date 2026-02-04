// src/utils/loadEvents.js
// HARDENED EVENT LOADER — SUPPORTS OBJECT CONTRACT ONLY

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export async function loadEvents(client) {
  const dir = path.join(process.cwd(), "src", "events");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const evt = mod.default;

    if (!evt || typeof evt.execute !== "function" || !evt.name) {
      throw new Error(`Invalid event module: ${file}`);
    }

    client.on(evt.name, (...args) => evt.execute(...args));
  }
}

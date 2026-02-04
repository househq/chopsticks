// src/deploy-commands.js
import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands } from "./utils/loadCommands.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!CLIENT_ID) throw new Error("CLIENT_ID missing");

const rest = new REST({ version: "10" }).setToken(TOKEN);

const loaded = await loadCommands();
const payload = [];

for (const [name, cmd] of loaded.entries()) {
  try {
    const json = cmd.data.toJSON();
    payload.push(json);
  } catch (err) {
    console.error("\n=== COMMAND SERIALIZATION FAILURE ===");
    console.error(`Command: /${name}`);
    console.error("Raw builder:", cmd.data);
    console.error("Error:", err);
    process.exit(1);
  }
}

await rest.put(
  Routes.applicationCommands(CLIENT_ID),
  { body: payload }
);

console.log(`Deployed ${payload.length} global commands`);

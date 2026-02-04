// src/index.js ///
// ENTRY //
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Events
} from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===================== CLIENT ===================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

global.client = client;
client.commands = new Collection();

/* ===================== COMMAND LOADER ===================== */
/*
Rules:
- ONLY src/commands
- Slash commands only
- No domain execution at import time
*/

const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
    const mod = await import(`file://${path.join(commandsPath, file)}`);

    const cmd =
      mod.default ??
      (mod.data && mod.execute
        ? { data: mod.data, execute: mod.execute }
        : null);

    if (!cmd || !cmd.data || !cmd.execute) continue;

    client.commands.set(cmd.data.name, cmd);
  }
}

/* ===================== EVENT LOADER ===================== */

const eventsPath = path.join(__dirname, "events");

if (fs.existsSync(eventsPath)) {
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"))) {
    const mod = await import(`file://${path.join(eventsPath, file)}`);
    const event = mod.default;

    if (!event || !event.name || !event.execute) continue;

    client.on(event.name, (...args) => {
      try {
        event.execute(...args);
      } catch (err) {
        console.error(`[event:${event.name}]`, err);
      }
    });
  }
}

/* ===================== INTERACTIONS ===================== */

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`[command:${interaction.commandName}]`, err);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("Command failed.");
      } else {
        await interaction.reply({
          content: "Command failed.",
          ephemeral: true
        });
      }
    } catch {}
  }
});

/* ===================== READY ===================== */

client.once(Events.ClientReady, () => {
  console.log("Ready");
});


/* ===================== LOGIN ===================== */

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN missing");
}

await client.login(process.env.DISCORD_TOKEN);

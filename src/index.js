// src/index.js
// ENTRY

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, Collection, GatewayIntentBits, Events } from "discord.js";
import { startLavalink } from "./lavalink/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===================== CLIENT ===================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

global.client = client;
client.commands = new Collection();

/* ===================== COMMAND LOADER ===================== */

const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  const files = fs
    .readdirSync(commandsPath, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith(".js"))
    .map(d => d.name)
    .sort();

  for (const file of files) {
    const filePath = path.join(commandsPath, file);

    let mod;
    try {
      mod = await import(pathToFileURL(filePath).href);
    } catch (err) {
      console.error(`[command:load] ${file} failed`, err);
      continue;
    }

    const cmd =
      mod.default ??
      (mod.data && mod.execute ? { data: mod.data, execute: mod.execute } : null);

    if (!cmd?.data?.name || typeof cmd.execute !== "function") continue;

    client.commands.set(cmd.data.name, cmd);
  }
}

/* ===================== EVENT LOADER ===================== */

const eventsPath = path.join(__dirname, "events");

if (fs.existsSync(eventsPath)) {
  const files = fs
    .readdirSync(eventsPath, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith(".js"))
    .map(d => d.name)
    .sort();

  for (const file of files) {
    const filePath = path.join(eventsPath, file);

    let mod;
    try {
      mod = await import(pathToFileURL(filePath).href);
    } catch (err) {
      console.error(`[event:load] ${file} failed`, err);
      continue;
    }

    const event = mod.default;
    if (!event?.name || typeof event.execute !== "function") continue;

    client.on(event.name, async (...args) => {
      try {
        await event.execute(...args);
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
        await interaction.editReply("❌ Command failed.");
      } else {
        await interaction.reply({ content: "❌ Command failed.", ephemeral: true });
      }
    } catch {}
  }
});

/* ===================== READY ===================== */

client.once(Events.ClientReady, async () => {
  console.log(`✅ Ready as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} guilds`);

  try {
    await startLavalink(client);
    console.log("🎵 Lavalink initialized");
  } catch (err) {
    console.error("❌ Lavalink init failed:", err?.message ?? err);
  }
});

/* ===================== LOGIN ===================== */

if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN missing");
await client.login(process.env.DISCORD_TOKEN);

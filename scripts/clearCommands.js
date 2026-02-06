import { REST, Routes } from "discord.js";
import { config } from "dotenv";

config();

const CLEAR_MODE = (process.env.CLEAR_MODE || "guild").toLowerCase(); // "guild" | "global"
const TARGET = (process.env.CLEAR_TARGET || "dev").toLowerCase(); // "dev" | "prod"

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!DISCORD_TOKEN) throw new Error("DISCORD_TOKEN missing");
if (!CLIENT_ID) throw new Error("CLIENT_ID missing");

const DEV_GUILD_ID = process.env.DEV_GUILD_ID || process.env.GUILD_ID || "";
const PROD_GUILD_ID = process.env.PROD_GUILD_ID || "";

function resolveGuildId() {
  if (TARGET === "prod") {
    if (!PROD_GUILD_ID) throw new Error("PROD_GUILD_ID missing");
    return PROD_GUILD_ID;
  }
  if (!DEV_GUILD_ID) throw new Error("DEV_GUILD_ID (or GUILD_ID) missing for guild clear");
  return DEV_GUILD_ID;
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  if (CLEAR_MODE === "global") {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log("[clear] global: cleared");
    return;
  }

  const guildId = resolveGuildId();
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [] });
  console.log(`[clear] guild(${guildId}): cleared`);
})().catch(err => {
  console.error("❌ Clear failed:", err);
  process.exitCode = 1;
});

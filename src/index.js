import {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  Events
} from "discord.js";
import { config } from "dotenv";

import { voiceCommand } from "./tools/voice/commands.js";
import voiceStateEvent from "./events/voiceStateUpdate.js";
import { cleanupVoice } from "./tools/voice/cleanup.js";

config();

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN missing");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* ---------- COMMAND REGISTRY ---------- */

client.commands = new Collection();
client.commands.set(voiceCommand.data.name, voiceCommand);

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  await command.execute(interaction);
});

/* ---------- VOICE EVENTS ---------- */

client.on(Events.VoiceStateUpdate, (oldState, newState) =>
  voiceStateEvent.execute(oldState, newState)
);

/* ---------- READY ---------- */

client.once(Events.ClientReady, async () => {
  await cleanupVoice(client);

  client.user.setPresence({
    activities: [{ name: "in development", type: ActivityType.Custom }],
    status: "online"
  });

  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

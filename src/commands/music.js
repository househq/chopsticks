// src/commands/music.js

import { SlashCommandBuilder } from "discord.js";
import { sendControl } from "../tools/music/domain.js";

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Music playback")
  .addSubcommand(s =>
    s
      .setName("play")
      .setDescription("Play a track")
      .addStringOption(o =>
        o
          .setName("query")
          .setDescription("URL or search query")
          .setRequired(true)
      )
  )
  .addSubcommand(s =>
    s.setName("skip").setDescription("Skip current track")
  )
  .addSubcommand(s =>
    s.setName("stop").setDescription("Stop playback")
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const vc = interaction.member.voice.channel;
  if (!vc) {
    await interaction.editReply("Join a voice channel first.");
    return;
  }

  const guildId = interaction.guildId;
  const channelId = vc.id;
  const sub = interaction.options.getSubcommand();

  if (sub === "play") {
    const query = interaction.options.getString("query");
    sendControl({ type: "PLAY", guildId, channelId, query });
    await interaction.editReply("Queued.");
    return;
  }

  if (sub === "skip") {
    sendControl({ type: "SKIP", guildId, channelId });
    await interaction.editReply("Skipped.");
    return;
  }

  if (sub === "stop") {
    sendControl({ type: "STOP", guildId, channelId });
    await interaction.editReply("Stopped.");
  }
}

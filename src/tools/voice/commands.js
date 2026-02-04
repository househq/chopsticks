// src/tools/voice/commands.js
// UI-ONLY COMMAND DEFINITION

import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits
} from "discord.js";

import * as VoiceDomain from "./domain.js";

export const data = new SlashCommandBuilder()
  .setName("voice")
  .setDescription("Join-to-create voice channel configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  .addSubcommand(sub =>
    sub
      .setName("add")
      .setDescription("Register a lobby channel")
      .addChannelOption(o =>
        o
          .setName("channel")
          .setDescription("Voice channel users join")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
      .addChannelOption(o =>
        o
          .setName("category")
          .setDescription("Category to create temp channels in")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
      .addStringOption(o =>
        o
          .setName("template")
          .setDescription("Channel name template (use {user})")
      )
  )

  .addSubcommand(sub =>
    sub
      .setName("remove")
      .setDescription("Remove a lobby channel")
      .addChannelOption(o =>
        o
          .setName("channel")
          .setDescription("Lobby channel to remove")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName("enable")
      .setDescription("Enable a lobby channel")
      .addChannelOption(o =>
        o
          .setName("channel")
          .setDescription("Lobby channel to enable")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName("disable")
      .setDescription("Disable a lobby channel")
      .addChannelOption(o =>
        o
          .setName("channel")
          .setDescription("Lobby channel to disable")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName("status")
      .setDescription("Show current voice configuration")
  )

  .addSubcommand(sub =>
    sub
      .setName("reset")
      .setDescription("Reset all voice configuration")
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) return;

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const res = await VoiceDomain.addLobby(
      guildId,
      interaction.options.getChannel("channel").id,
      interaction.options.getChannel("category").id,
      interaction.options.getString("template") ?? "{user}'s room"
    );
    await interaction.reply({ content: JSON.stringify(res), ephemeral: true });
    return;
  }

  if (sub === "remove") {
    const res = await VoiceDomain.removeLobby(
      guildId,
      interaction.options.getChannel("channel").id
    );
    await interaction.reply({ content: JSON.stringify(res), ephemeral: true });
    return;
  }

  if (sub === "enable" || sub === "disable") {
    const res = await VoiceDomain.setLobbyEnabled(
      guildId,
      interaction.options.getChannel("channel").id,
      sub === "enable"
    );
    await interaction.reply({ content: JSON.stringify(res), ephemeral: true });
    return;
  }

  if (sub === "status") {
    const res = await VoiceDomain.getStatus(guildId);
    await interaction.reply({
      content: "```json\n" + JSON.stringify(res, null, 2) + "\n```",
      ephemeral: true
    });
    return;
  }

  if (sub === "reset") {
    const res = await VoiceDomain.resetVoice(guildId);
    await interaction.reply({ content: JSON.stringify(res), ephemeral: true });
  }
}

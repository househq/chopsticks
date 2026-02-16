import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageChannels],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Unlock the current channel");

export async function execute(interaction) {
  if (!interaction.inGuild()) return;
  const channel = interaction.channel;
  if (!channel?.permissionOverwrites) {
    await replyModError(interaction, {
      title: "Unlock Failed",
      summary: "This channel does not support permission overwrites."
    });
    await dispatchModerationLog(interaction.guild, {
      action: "unlock",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Unsupported channel type",
      summary: "Channel unlock blocked because permission overwrites are unavailable.",
      commandName: "unlock",
      channelId: interaction.channelId
    });
    return;
  }
  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null
    });
    await replyModSuccess(interaction, {
      title: "Channel Unlocked",
      summary: `Unlocked <#${channel.id}> for @everyone.`,
      fields: [{ name: "Channel", value: `${channel.name || channel.id} (${channel.id})` }]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "unlock",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Channel unlocked",
      summary: `Unlocked #${channel.name || channel.id} for @everyone.`,
      commandName: "unlock",
      channelId: channel.id
    });
  } catch (err) {
    const summary = err?.message || "Unable to unlock channel.";
    await replyModError(interaction, {
      title: "Unlock Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "unlock",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Channel unlock failed",
      summary,
      commandName: "unlock",
      channelId: interaction.channelId
    });
  }
}

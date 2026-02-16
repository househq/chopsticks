import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageChannels],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("lock")
  .setDescription("Lock the current channel");

export async function execute(interaction) {
  if (!interaction.inGuild()) return;
  const channel = interaction.channel;
  if (!channel?.permissionOverwrites) {
    await replyModError(interaction, {
      title: "Lock Failed",
      summary: "This channel does not support permission overwrites."
    });
    await dispatchModerationLog(interaction.guild, {
      action: "lock",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Unsupported channel type",
      summary: "Channel lock blocked because permission overwrites are unavailable.",
      commandName: "lock",
      channelId: interaction.channelId
    });
    return;
  }
  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false
    });
    await replyModSuccess(interaction, {
      title: "Channel Locked",
      summary: `Locked <#${channel.id}> for @everyone.`,
      fields: [{ name: "Channel", value: `${channel.name || channel.id} (${channel.id})` }]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "lock",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Channel locked",
      summary: `Locked #${channel.name || channel.id} for @everyone.`,
      commandName: "lock",
      channelId: channel.id
    });
  } catch (err) {
    const summary = err?.message || "Unable to lock channel.";
    await replyModError(interaction, {
      title: "Lock Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "lock",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Channel lock failed",
      summary,
      commandName: "lock",
      channelId: interaction.channelId
    });
  }
}

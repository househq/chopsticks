import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageChannels],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Set slowmode for current channel")
  .addIntegerOption(o =>
    o.setName("seconds").setDescription("0-21600").setRequired(true).setMinValue(0).setMaxValue(21600)
  );

export async function execute(interaction) {
  const seconds = interaction.options.getInteger("seconds", true);
  const channel = interaction.channel;
  if (!channel?.setRateLimitPerUser) {
    await replyModError(interaction, {
      title: "Slowmode Failed",
      summary: "This channel does not support slowmode changes."
    });
    await dispatchModerationLog(interaction.guild, {
      action: "slowmode",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Unsupported channel type",
      summary: "Slowmode update blocked because channel does not support rate limit changes.",
      commandName: "slowmode",
      channelId: interaction.channelId,
      details: { seconds: String(seconds) }
    });
    return;
  }
  try {
    await channel.setRateLimitPerUser(seconds);
    await replyModSuccess(interaction, {
      title: "Slowmode Updated",
      summary: `Set slowmode for <#${channel.id}> to **${seconds}s**.`,
      fields: [{ name: "Channel", value: `${channel.name || channel.id} (${channel.id})` }]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "slowmode",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Slowmode updated",
      summary: `Set slowmode for #${channel.name || channel.id} to ${seconds}s.`,
      commandName: "slowmode",
      channelId: channel.id,
      details: { seconds: String(seconds) }
    });
  } catch (err) {
    const summary = err?.message || "Unable to set slowmode.";
    await replyModError(interaction, {
      title: "Slowmode Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "slowmode",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      reason: "Slowmode update failed",
      summary,
      commandName: "slowmode",
      channelId: interaction.channelId,
      details: { seconds: String(seconds) }
    });
  }
}

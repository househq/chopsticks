import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { reasonOrDefault, replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.BanMembers],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Unban a user by ID")
  .addStringOption(o => o.setName("user_id").setDescription("User ID").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function execute(interaction) {
  const userId = interaction.options.getString("user_id", true);
  const reason = reasonOrDefault(interaction.options.getString("reason"));
  try {
    await interaction.guild.members.unban(userId, reason);
    await replyModSuccess(interaction, {
      title: "User Unbanned",
      summary: `Successfully unbanned **${userId}**.`,
      fields: [{ name: "Reason", value: reason }]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "unban",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: userId,
      reason,
      summary: `Unbanned ${userId}.`,
      commandName: "unban",
      channelId: interaction.channelId
    });
  } catch (err) {
    const summary = err?.message || "Unable to unban user.";
    await replyModError(interaction, {
      title: "Unban Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "unban",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: userId,
      reason,
      summary,
      commandName: "unban",
      channelId: interaction.channelId
    });
  }
}

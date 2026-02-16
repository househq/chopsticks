import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { canModerateTarget, fetchTargetMember, moderationGuardMessage } from "../moderation/guards.js";
import { notifyUserByDm, reasonOrDefault, replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.BanMembers],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
  .addIntegerOption(o =>
    o.setName("delete_days").setDescription("Delete message days (0-7)").setMinValue(0).setMaxValue(7)
  )
  .addBooleanOption(o =>
    o.setName("notify_user").setDescription("Attempt to DM user before ban")
  );

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  const reason = reasonOrDefault(interaction.options.getString("reason"));
  const deleteDays = interaction.options.getInteger("delete_days") || 0;
  const notifyUser = Boolean(interaction.options.getBoolean("notify_user"));
  const targetMember = await fetchTargetMember(interaction.guild, user.id);

  const gate = canModerateTarget(interaction, targetMember);
  if (!gate.ok) {
    const failSummary = moderationGuardMessage(gate.reason);
    await replyModError(interaction, {
      title: "Ban Blocked",
      summary: failSummary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "ban",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: failSummary,
      commandName: "ban",
      channelId: interaction.channelId
    });
    return;
  }

  const dmStatus = await notifyUserByDm(
    user,
    `You were banned from **${interaction.guild?.name || "this server"}**.\nReason: ${reason}`,
    { enabled: notifyUser }
  );

  try {
    await interaction.guild.members.ban(user.id, {
      reason,
      deleteMessageSeconds: deleteDays * 86400
    });
    await replyModSuccess(interaction, {
      title: "User Banned",
      summary: `Successfully banned **${user.tag}**.`,
      fields: [
        { name: "User", value: `${user.tag} (${user.id})` },
        { name: "Delete Message Days", value: String(deleteDays), inline: true },
        { name: "DM Notify", value: dmStatus, inline: true },
        { name: "Reason", value: reason }
      ]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "ban",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: `Banned ${user.tag}.`,
      commandName: "ban",
      channelId: interaction.channelId,
      details: {
        deleteDays: String(deleteDays),
        dmNotify: dmStatus
      }
    });
  } catch (err) {
    const summary = err?.message || "Unable to ban user.";
    await replyModError(interaction, {
      title: "Ban Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "ban",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary,
      commandName: "ban",
      channelId: interaction.channelId
    });
  }
}

import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { canModerateTarget, fetchTargetMember, moderationGuardMessage } from "../moderation/guards.js";
import { notifyUserByDm, reasonOrDefault, replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.KickMembers],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
  .addBooleanOption(o =>
    o.setName("notify_user").setDescription("Attempt to DM user before kick")
  );

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  const reason = reasonOrDefault(interaction.options.getString("reason"));
  const notifyUser = Boolean(interaction.options.getBoolean("notify_user"));
  const member = await fetchTargetMember(interaction.guild, user.id);
  if (!member) {
    await replyModError(interaction, {
      title: "Kick Failed",
      summary: "User is not a member of this guild."
    });
    await dispatchModerationLog(interaction.guild, {
      action: "kick",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: "Target user is not in the guild.",
      commandName: "kick",
      channelId: interaction.channelId
    });
    return;
  }

  const gate = canModerateTarget(interaction, member);
  if (!gate.ok) {
    const failSummary = moderationGuardMessage(gate.reason);
    await replyModError(interaction, {
      title: "Kick Blocked",
      summary: failSummary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "kick",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: failSummary,
      commandName: "kick",
      channelId: interaction.channelId
    });
    return;
  }

  const dmStatus = await notifyUserByDm(
    user,
    `You were kicked from **${interaction.guild?.name || "this server"}**.\nReason: ${reason}`,
    { enabled: notifyUser }
  );

  try {
    await member.kick(reason);
    await replyModSuccess(interaction, {
      title: "User Kicked",
      summary: `Successfully kicked **${user.tag}**.`,
      fields: [
        { name: "User", value: `${user.tag} (${user.id})` },
        { name: "DM Notify", value: dmStatus, inline: true },
        { name: "Reason", value: reason }
      ]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "kick",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: `Kicked ${user.tag}.`,
      commandName: "kick",
      channelId: interaction.channelId,
      details: { dmNotify: dmStatus }
    });
  } catch (err) {
    const summary = err?.message || "Unable to kick user.";
    await replyModError(interaction, {
      title: "Kick Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "kick",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary,
      commandName: "kick",
      channelId: interaction.channelId
    });
  }
}

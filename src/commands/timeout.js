import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { canModerateTarget, fetchTargetMember, moderationGuardMessage } from "../moderation/guards.js";
import { notifyUserByDm, reasonOrDefault, replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ModerateMembers],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a member")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addIntegerOption(o =>
    o.setName("minutes").setDescription("Minutes (0 to clear)").setRequired(true).setMinValue(0).setMaxValue(10080)
  )
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
  .addBooleanOption(o =>
    o.setName("notify_user").setDescription("Attempt to DM user about timeout")
  );

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  const minutes = interaction.options.getInteger("minutes", true);
  const reason = reasonOrDefault(interaction.options.getString("reason"));
  const notifyUser = Boolean(interaction.options.getBoolean("notify_user"));
  const member = await fetchTargetMember(interaction.guild, user.id);
  if (!member) {
    await replyModError(interaction, {
      title: "Timeout Failed",
      summary: "User is not a member of this guild."
    });
    await dispatchModerationLog(interaction.guild, {
      action: "timeout",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: "Target user is not in the guild.",
      commandName: "timeout",
      channelId: interaction.channelId,
      details: { minutes: String(minutes) }
    });
    return;
  }

  const gate = canModerateTarget(interaction, member);
  if (!gate.ok) {
    const failSummary = moderationGuardMessage(gate.reason);
    await replyModError(interaction, {
      title: "Timeout Blocked",
      summary: failSummary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "timeout",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: failSummary,
      commandName: "timeout",
      channelId: interaction.channelId,
      details: { minutes: String(minutes) }
    });
    return;
  }

  let dmMessage = "";
  if (notifyUser) {
    dmMessage = minutes === 0
      ? `Your timeout was cleared in **${interaction.guild?.name || "this server"}**.`
      : `You were timed out in **${interaction.guild?.name || "this server"}** for ${minutes} minute(s).\nReason: ${reason}`;
  }
  const dmStatus = await notifyUserByDm(user, dmMessage, { enabled: notifyUser });

  const ms = minutes === 0 ? null : minutes * 60 * 1000;
  try {
    await member.timeout(ms, reason);
    await replyModSuccess(interaction, {
      title: minutes === 0 ? "Timeout Cleared" : "User Timed Out",
      summary: minutes === 0
        ? `Cleared timeout for **${user.tag}**.`
        : `Timed out **${user.tag}** for **${minutes} minute(s)**.`,
      fields: [
        { name: "User", value: `${user.tag} (${user.id})` },
        { name: "DM Notify", value: dmStatus, inline: true },
        { name: "Reason", value: reason }
      ]
    });
    await dispatchModerationLog(interaction.guild, {
      action: "timeout",
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: minutes === 0 ? `Cleared timeout for ${user.tag}.` : `Timed out ${user.tag} for ${minutes} minute(s).`,
      commandName: "timeout",
      channelId: interaction.channelId,
      details: {
        minutes: String(minutes),
        dmNotify: dmStatus
      }
    });
  } catch (err) {
    const summary = err?.message || "Unable to apply timeout.";
    await replyModError(interaction, {
      title: "Timeout Failed",
      summary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "timeout",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary,
      commandName: "timeout",
      channelId: interaction.channelId,
      details: { minutes: String(minutes) }
    });
  }
}

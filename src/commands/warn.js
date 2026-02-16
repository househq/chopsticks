import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { addWarning } from "../utils/moderation.js";
import { canModerateTarget, fetchTargetMember, moderationGuardMessage } from "../moderation/guards.js";
import { reasonOrDefault, replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ModerateMembers],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Warn a user")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  const reason = reasonOrDefault(interaction.options.getString("reason"));
  const targetMember = await fetchTargetMember(interaction.guild, user.id);
  const gate = canModerateTarget(interaction, targetMember);
  if (!gate.ok) {
    const failSummary = moderationGuardMessage(gate.reason);
    await replyModError(interaction, {
      title: "Warn Blocked",
      summary: failSummary
    });
    await dispatchModerationLog(interaction.guild, {
      action: "warn",
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason,
      summary: failSummary,
      commandName: "warn",
      channelId: interaction.channelId
    });
    return;
  }
  const list = await addWarning(interaction.guildId, user.id, interaction.user.id, reason);
  await replyModSuccess(interaction, {
    title: "User Warned",
    summary: `Warning recorded for **${user.tag}**.`,
    fields: [
      { name: "User", value: `${user.tag} (${user.id})` },
      { name: "Total Warnings", value: String(list.length), inline: true },
      { name: "Reason", value: reason }
    ]
  });
  await dispatchModerationLog(interaction.guild, {
    action: "warn",
    ok: true,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag,
    targetId: user.id,
    targetTag: user.tag,
    reason,
    summary: `Warning added for ${user.tag}.`,
    commandName: "warn",
    channelId: interaction.channelId,
    details: { totalWarnings: String(list.length) }
  });
}

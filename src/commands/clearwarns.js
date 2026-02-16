import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { clearWarnings } from "../utils/moderation.js";
import { replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ModerateMembers],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("clearwarns")
  .setDescription("Clear warnings for a user")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true));

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  await clearWarnings(interaction.guildId, user.id);
  await replyModSuccess(interaction, {
    title: "Warnings Cleared",
    summary: `Cleared all warnings for **${user.tag}**.`,
    fields: [{ name: "User", value: `${user.tag} (${user.id})` }]
  });
  await dispatchModerationLog(interaction.guild, {
    action: "clearwarns",
    ok: true,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag,
    targetId: user.id,
    targetTag: user.tag,
    reason: "Warnings reset by moderator.",
    summary: `Warnings cleared for ${user.tag}.`,
    commandName: "clearwarns",
    channelId: interaction.channelId
  });
}

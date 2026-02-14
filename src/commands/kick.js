import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { replySuccess, replyError } from "../utils/discordOutput.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.KickMembers]
};

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") || "No reason";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await replyError(interaction, "User not found.");
    return;
  }
  
  try {
    await member.kick(reason);
    await replySuccess(interaction, `Kicked **${user.tag}**\nReason: ${reason}`, false); // Public log
  } catch (err) {
    await replyError(interaction, `Failed to kick user: ${err.message}`);
  }
}

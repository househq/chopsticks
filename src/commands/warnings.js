import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { listWarnings } from "../utils/moderation.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ModerateMembers]
};

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("List warnings for a user")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true));

export async function execute(interaction) {
  const user = interaction.options.getUser("user", true);
  const list = await listWarnings(interaction.guildId, user.id);
  if (list.length === 0) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "No warnings." });
    return;
  }
  const lines = list.slice(0, 10).map((w, i) => {
    const when = w.at ? `<t:${Math.floor(w.at / 1000)}:R>` : "unknown";
    return `${i + 1}. ${when} by <@${w.by}> - ${w.reason}`;
  });
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: lines.join("\n")
  });
}

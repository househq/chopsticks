import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { replyEmbed } from "../utils/discordOutput.js";
import { sanitizeString } from "../utils/validation.js";

export const meta = {
  category: "utility",
  guildOnly: true,
  deployGlobal: false,
};

export const data = new SlashCommandBuilder()
  .setName("echo")
  .setDescription("Echo text")
  .addStringOption(o => o.setName("text").setDescription("Text").setRequired(true));

export async function execute(interaction) {
  const text = sanitizeString(interaction.options.getString("text", true)).slice(0, 2000);
  await replyEmbed(interaction, "Echo", text, true);
}

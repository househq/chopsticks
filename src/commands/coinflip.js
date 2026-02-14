import { SlashCommandBuilder, MessageFlags } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Flip a coin");

export async function execute(interaction) {
  const side = Math.random() < 0.5 ? "Heads" : "Tails";
  await interaction.reply({ flags: MessageFlags.Ephemeral, content: `Result: ${side}` });
}

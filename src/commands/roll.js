import { SlashCommandBuilder, MessageFlags } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("Roll a die")
  .addIntegerOption(o =>
    o.setName("sides").setDescription("Number of sides").setMinValue(2).setMaxValue(100).setRequired(false)
  );

export async function execute(interaction) {
  const sides = interaction.options.getInteger("sides") || 6;
  const roll = Math.floor(Math.random() * sides) + 1;
  await interaction.reply({ flags: MessageFlags.Ephemeral, content: `Roll: ${roll} (d${sides})` });
}

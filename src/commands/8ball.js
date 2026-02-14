import { SlashCommandBuilder } from "discord.js";
import { replyEmbed, Colors } from "../utils/discordOutput.js";

const answers = [
  "Yes.",
  "No.",
  "Maybe.",
  "Ask again later.",
  "Definitely.",
  "Unlikely.",
  "Absolutely.",
  "I doubt it.",
  "Signs point to yes.",
  "Very doubtful."
];

export const data = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription("Ask the magic 8-ball")
  .addStringOption(o => o.setName("question").setDescription("Question").setRequired(true));

export async function execute(interaction) {
  const pick = answers[Math.floor(Math.random() * answers.length)];
  const q = interaction.options.getString("question", true);
  
  await replyEmbed(interaction, "Magic 8-Ball", `**Q:** ${q}\n**A:** ${pick}`, true);
}

import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create a poll")
  .addStringOption(o => o.setName("question").setDescription("Question").setRequired(true))
  .addStringOption(o =>
    o.setName("options").setDescription("Comma-separated options (2-10)").setRequired(true)
  );

const emoji = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

export async function execute(interaction) {
  const q = interaction.options.getString("question", true);
  const opts = interaction.options.getString("options", true).split(",").map(s => s.trim()).filter(Boolean);
  if (opts.length < 2 || opts.length > 10) {
    await interaction.reply({ content: "Provide 2-10 options.", ephemeral: true });
    return;
  }
  const lines = opts.map((o, i) => `${i + 1}. ${o}`).join("\n");
  await interaction.reply({ content: `**${q}**\n${lines}` });
  const msg = await interaction.fetchReply();
  for (let i = 0; i < opts.length; i++) {
    await msg.react(emoji[i]).catch(() => {});
  }
}

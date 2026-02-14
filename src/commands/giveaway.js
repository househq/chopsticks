import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { schedule } from "../utils/scheduler.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageGuild]
};

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Simple giveaway")
  .addSubcommand(s =>
    s
      .setName("start")
      .setDescription("Start a giveaway")
      .addIntegerOption(o => o.setName("minutes").setDescription("Duration").setRequired(true).setMinValue(1).setMaxValue(10080))
      .addIntegerOption(o => o.setName("winners").setDescription("Winners").setRequired(true).setMinValue(1).setMaxValue(10))
      .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
  )
  .addSubcommand(s =>
    s
      .setName("end")
      .setDescription("End a giveaway")
      .addStringOption(o => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true))
  );

async function pickWinners(msg, count) {
  const reaction = msg.reactions.cache.get("🎉");
  if (!reaction) return [];
  const users = await reaction.users.fetch();
  const pool = users.filter(u => !u.bot).map(u => u.id);
  const winners = [];
  while (pool.length && winners.length < count) {
    const i = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(i, 1)[0]);
  }
  return winners;
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "start") {
    const minutes = interaction.options.getInteger("minutes", true);
    const winnersCount = interaction.options.getInteger("winners", true);
    const prize = interaction.options.getString("prize", true);
    await interaction.reply({
      content: `GIVEAWAY\nPrize: **${prize}**\nReact with the giveaway reaction to enter.\nEnds in ${minutes} minutes.`,
      fetchReply: true
    });
    const msg = await interaction.fetchReply();
    await msg.react("🎉").catch(() => {});
    schedule(`giveaway:${msg.id}`, minutes * 60 * 1000, async () => {
      const m = await interaction.channel.messages.fetch(msg.id).catch(() => null);
      if (!m) return;
      const winners = await pickWinners(m, winnersCount);
      const text = winners.length ? winners.map(id => `<@${id}>`).join(", ") : "No entries.";
      await m.reply(`Winner(s): ${text}`);
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true);
  const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (!msg) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Message not found." });
    return;
  }
  const winners = await pickWinners(msg, 1);
  const text = winners.length ? winners.map(id => `<@${id}>`).join(", ") : "No entries.";
  await interaction.reply({ content: `Winner(s): ${text}` });
}

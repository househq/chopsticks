// src/commands/balance.js
import { SlashCommandBuilder } from "discord.js";
import { makeEmbed, Colors } from "../utils/discordOutput.js";
import { getWallet } from "../economy/wallet.js";
import { botLogger } from "../utils/modernLogger.js";

export const meta = {
  category: "economy",
  guildOnly: true,
};

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("View your credit balance and bank")
  .addUserOption(o => o.setName("user").setDescription("View another user's balance").setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser("user") || interaction.user;
  
  try {
    const wallet = await getWallet(targetUser.id);
    
    const fields = [
      { name: "💰 Wallet", value: `${wallet.balance.toLocaleString()} Credits`, inline: true },
      { name: "🏦 Bank", value: `${wallet.bank.toLocaleString()} / ${wallet.bank_capacity.toLocaleString()}`, inline: true },
      { name: "💎 Net Worth", value: `${(wallet.balance + wallet.bank).toLocaleString()} Credits`, inline: true },
    ];
    
    if (targetUser.id === interaction.user.id) {
      fields.push(
        { name: "📈 Total Earned", value: wallet.total_earned.toLocaleString(), inline: true },
        { name: "📉 Total Spent", value: wallet.total_spent.toLocaleString(), inline: true }
      );
    }
    
    const embed = makeEmbed(
      `${targetUser.username}'s Balance`,
      `Financial overview for ${targetUser.username}`,
      fields,
      null,
      null,
      Colors.SUCCESS
    );
    
    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    botLogger.error({ err: err }, "[balance] Error:");
    await interaction.reply({
      embeds: [makeEmbed("Error", "Failed to fetch balance.", [], null, null, Colors.ERROR)],
      ephemeral: true
    });
  }
}

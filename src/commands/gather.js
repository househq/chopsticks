import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getCooldown, setCooldown, formatCooldown } from "../economy/cooldowns.js";
import { getInventory, hasItem, removeItem, addItem } from "../economy/inventory.js";
import { performGather, addToCollection } from "../economy/collections.js";
import { Colors, replyError } from "../utils/discordOutput.js";
import itemsData from "../economy/items.json" with { type: "json" };

const GATHER_COOLDOWN = 5 * 60 * 1000; // 5 minutes

export default {
  data: new SlashCommandBuilder()
    .setName("gather")
    .setDescription("Gather rare items from the digital void (5min cooldown)")
    .addStringOption(option =>
      option
        .setName("tool")
        .setDescription("Tool to use (optional, improves yield)")
        .addChoices(
          { name: "🔍 Basic Scanner (+0% bonus)", value: "basic_scanner" },
          { name: "🔬 Advanced Scanner (+15% bonus)", value: "advanced_scanner" },
          { name: "⚛️ Quantum Scanner (+35% bonus)", value: "quantum_scanner" },
          { name: "🪤 Basic Net (+5% bonus)", value: "basic_net" },
          { name: "🕸️ Reinforced Net (+25% bonus)", value: "reinforced_net" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Check cooldown
      const cooldown = await getCooldown(interaction.user.id, "gather");
      if (cooldown) {
        const timeLeft = formatCooldown(cooldown - Date.now());
        return await replyError(
          interaction,
          "Scanner Recharging",
          `Your gathering equipment is recharging. Try again in **${timeLeft}**.`,
          true
        );
      }

      // Check if user has selected tool
      let toolBonus = 0;
      let toolUsed = null;
      const selectedTool = interaction.options.getString("tool");

      if (selectedTool) {
        const hasTool = await hasItem(interaction.user.id, selectedTool);
        if (!hasTool) {
          return await replyError(
            interaction,
            "Tool Not Found",
            `You don't have a **${itemsData.tools[selectedTool].name}**. Use \`/gather\` without a tool or check \`/inventory\`.`,
            true
          );
        }

        toolUsed = itemsData.tools[selectedTool];
        toolBonus = toolUsed.gatherBonus || 0;

        // Reduce tool durability (20% chance to lose 1 durability)
        if (Math.random() < 0.2) {
          // TODO: Implement durability system with metadata
          // For now, just log
          console.log(`Tool ${selectedTool} used, durability decreased`);
        }
      }

      // Perform gather
      const results = performGather(toolBonus, 0); // TODO: Add luck boost from active buffs

      // Add items to inventory AND collection
      for (const result of results) {
        await addItem(interaction.user.id, result.itemId, 1);
        await addToCollection(interaction.user.id, "general", result.itemId, result.rarity);
      }

      // Set cooldown
      await setCooldown(interaction.user.id, "gather", GATHER_COOLDOWN);

      // Build response
      const rarityEmojis = {
        mythic: "✨",
        legendary: "💎",
        epic: "🔮",
        rare: "💠",
        common: "⚪"
      };

      const itemsList = results.map(r => {
        let foundItem = null;
        for (const category in itemsData) {
          if (itemsData[category][r.itemId]) {
            foundItem = itemsData[category][r.itemId];
            break;
          }
        }
        const itemEmoji = foundItem?.emoji || "📦";
        const itemName = foundItem?.name || r.itemId;
        const rarityEmoji = rarityEmojis[r.rarity] || "❓";
        return `${rarityEmoji} ${itemEmoji} **${itemName}** [${r.rarity.toUpperCase()}]`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("⚡ Gathering Complete")
        .setDescription(`You ventured into the digital void and found:\n\n${itemsList}`)
        .setColor(Colors.SUCCESS)
        .addFields(
          { name: "Items Found", value: results.length.toString(), inline: true },
          { name: "Cooldown", value: "5 minutes", inline: true }
        )
        .setFooter({ text: toolUsed ? `Tool used: ${toolUsed.emoji} ${toolUsed.name}` : "No tool used - equip one for better yields!" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Gather command error:", error);
      await replyError(interaction, "Gather Failed", "Something went wrong. Try again later.", true);
    }
  }
};

import { SlashCommandBuilder } from "discord.js";
import { getInventory, removeItem, getItemData } from "../economy/inventory.js";
import { addCredits } from "../economy/wallet.js";
import { replySuccess, replyError, Colors, makeEmbed } from "../utils/discordOutput.js";

export default {
  data: new SlashCommandBuilder()
    .setName("use")
    .setDescription("Use or consume an item from your inventory")
    .addStringOption(option =>
      option
        .setName("item")
        .setDescription("Item ID or name to use")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("quantity")
        .setDescription("Quantity to use (default: 1)")
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const itemQuery = interaction.options.getString("item").toLowerCase();
    const quantity = interaction.options.getInteger("quantity") || 1;

    try {
      // Get user inventory
      const inventory = await getInventory(interaction.user.id);
      
      // Find matching item
      const matchedItem = inventory.find(invItem => {
        const itemData = invItem.itemData;
        return invItem.item_id === itemQuery || itemData.name.toLowerCase().includes(itemQuery);
      });

      if (!matchedItem) {
        return await replyError(
          interaction,
          "Item Not Found",
          `You don't have any item matching "${itemQuery}". Check \`/inventory\` to see what you have.`,
          true
        );
      }

      const itemData = getItemData(matchedItem.item_id);
      if (!itemData) {
        return await replyError(interaction, "Invalid Item", "Item data not found.", true);
      }

      // Check quantity
      if (matchedItem.quantity < quantity) {
        return await replyError(
          interaction,
          "Insufficient Quantity",
          `You only have ${matchedItem.quantity} of ${itemData.name}.`,
          true
        );
      }

      // Handle different item categories
      if (itemData.category === "consumable") {
        await handleConsumable(interaction, matchedItem, itemData, quantity);
      } else if (itemData.category === "collectible") {
        // Sell collectible
        const totalValue = itemData.sellPrice * quantity;
        await removeItem(interaction.user.id, matchedItem.item_id, quantity);
        await addCredits(interaction.user.id, totalValue, "Sold collectible");

        await replySuccess(
          interaction,
          "Item Sold",
          `Sold **${quantity}x ${itemData.emoji} ${itemData.name}** for **${totalValue.toLocaleString()} Credits**!`,
          true
        );
      } else if (itemData.category === "tool") {
        return await replyError(
          interaction,
          "Cannot Use Tool",
          `${itemData.emoji} **${itemData.name}** is a tool. Equip it using \`/gather\` instead.`,
          true
        );
      } else {
        return await replyError(interaction, "Unknown Item Type", "This item cannot be used.", true);
      }
    } catch (error) {
      console.error("Use command error:", error);
      await replyError(interaction, "Error", "Failed to use item. Try again later.", true);
    }
  }
};

async function handleConsumable(interaction, matchedItem, itemData, quantity) {
  // Remove item from inventory
  await removeItem(interaction.user.id, matchedItem.item_id, quantity);

  // Apply effect based on item effect type
  let effectDescription = "";

  switch (itemData.effect) {
    case "cooldown_reduction":
      effectDescription = `Your cooldowns are reduced by ${itemData.effectValue * 100}% for ${formatDuration(itemData.duration)}!`;
      // TODO: Apply buff to user (store in Redis with TTL)
      break;

    case "luck_boost":
      effectDescription = `Your luck increased by ${itemData.effectValue * 100}% for ${formatDuration(itemData.duration)}!`;
      // TODO: Apply buff to user
      break;

    case "companion_restore":
      effectDescription = `Companion stats restored: +${itemData.effectValue.hunger} hunger, +${itemData.effectValue.happiness} happiness!`;
      // TODO: Update companion stats
      break;

    case "xp_multiplier":
      effectDescription = `XP gain multiplied by ${itemData.effectValue}x for ${formatDuration(itemData.duration)}!`;
      // TODO: Apply buff to user
      break;

    case "premium_unlock":
      effectDescription = `Premium features unlocked for ${formatDuration(itemData.duration)}!`;
      // TODO: Grant temporary premium access
      break;

    default:
      effectDescription = "Item consumed.";
  }

  await replySuccess(
    interaction,
    "Item Used",
    `${itemData.emoji} Used **${quantity}x ${itemData.name}**\n\n${effectDescription}`,
    true
  );
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  return "a moment";
}

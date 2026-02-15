function rarityEmoji(rarity) {
  switch (String(rarity || "").toLowerCase()) {
    case "mythic": return "✨";
    case "legendary": return "💎";
    case "epic": return "🔮";
    case "rare": return "💠";
    case "common": return "⚪";
    default: return "🧩";
  }
}

function raritySellPrice(rarity) {
  switch (String(rarity || "").toLowerCase()) {
    case "mythic": return 7500;
    case "legendary": return 2500;
    case "epic": return 900;
    case "rare": return 250;
    case "common": return 60;
    default: return 60;
  }
}

export function isLegacyItemId(itemId) {
  return String(itemId || "").startsWith("px_");
}

export function describeLegacyItem(itemId, rarity = "common") {
  const id = String(itemId || "unknown");
  const short = id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  const emoji = rarityEmoji(rarity);
  const sellPrice = raritySellPrice(rarity);

  return {
    id,
    name: `Lost Relic (${short})`,
    description: "A legacy artifact from an older loot system.",
    category: "collectible",
    rarity: String(rarity || "common").toLowerCase(),
    sellPrice,
    emoji
  };
}


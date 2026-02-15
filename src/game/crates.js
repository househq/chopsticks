// src/game/crates.js
// Loot crates opened via /use and granted on level-ups.

const TIERS = ["common", "rare", "epic", "legendary", "mythic"];

const CRATE_TABLES = {
  common: [
    { id: "data_fragment", w: 60 },
    { id: "energy_drink", w: 20 },
    { id: "companion_treat", w: 20 }
  ],
  rare: [
    { id: "neural_chip", w: 40 },
    { id: "corrupted_file", w: 30 },
    { id: "luck_charm", w: 30 }
  ],
  epic: [
    { id: "encryption_key", w: 40 },
    { id: "hologram_badge", w: 25 },
    { id: "xp_booster", w: 35 }
  ],
  legendary: [
    { id: "quantum_core", w: 55 },
    { id: "ancient_code", w: 45 }
  ],
  mythic: [
    { id: "singularity_shard", w: 100 }
  ]
};

function rollFromTable(table) {
  const t = Array.isArray(table) ? table : [];
  const total = t.reduce((s, e) => s + Number(e.w || 0), 0);
  if (total <= 0) return t[0]?.id || null;
  const r = Math.random() * total;
  let c = 0;
  for (const e of t) {
    c += Number(e.w || 0);
    if (r <= c) return e.id;
  }
  return t[0]?.id || null;
}

export function crateTierFromItemId(itemId) {
  const id = String(itemId || "").toLowerCase();
  if (id === "loot_crate_common") return "common";
  if (id === "loot_crate_rare") return "rare";
  if (id === "loot_crate_epic") return "epic";
  if (id === "loot_crate_legendary") return "legendary";
  if (id === "loot_crate_mythic") return "mythic";
  return null;
}

export function levelRewardCrate(level) {
  const L = Math.max(1, Math.trunc(Number(level) || 1));
  if (L % 50 === 0) return "loot_crate_mythic";
  if (L % 25 === 0) return "loot_crate_legendary";
  if (L % 10 === 0) return "loot_crate_epic";
  if (L % 5 === 0) return "loot_crate_rare";
  return "loot_crate_common";
}

export function openCrateRolls(crateItemId, count = 1) {
  const tier = crateTierFromItemId(crateItemId) || "common";
  const table = CRATE_TABLES[tier] || CRATE_TABLES.common;
  const n = Math.max(1, Math.min(25, Math.trunc(Number(count) || 1)));
  const drops = [];
  for (let i = 0; i < n; i += 1) {
    const itemId = rollFromTable(table);
    if (itemId) drops.push(itemId);
  }
  return { tier, drops };
}


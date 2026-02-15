// src/game/crafting.js
// Crafting system: deterministic recipes that consume inventory and output items.

import { getPool } from "../utils/storage_pg.js";
import { addGameXp } from "./profile.js";

export const RECIPES = [
  {
    id: "energy_drink",
    name: "Energy Drink",
    output: { itemId: "energy_drink", qty: 1 },
    inputs: [
      { itemId: "data_fragment", qty: 4 },
      { itemId: "corrupted_file", qty: 1 }
    ],
    xp: 55
  },
  {
    id: "luck_charm",
    name: "Luck Charm",
    output: { itemId: "luck_charm", qty: 1 },
    inputs: [
      { itemId: "neural_chip", qty: 2 },
      { itemId: "data_fragment", qty: 6 }
    ],
    xp: 80
  },
  {
    id: "xp_booster",
    name: "XP Booster",
    output: { itemId: "xp_booster", qty: 1 },
    inputs: [
      { itemId: "encryption_key", qty: 1 },
      { itemId: "neural_chip", qty: 2 }
    ],
    xp: 120
  },
  {
    id: "advanced_scanner",
    name: "Advanced Scanner",
    output: { itemId: "advanced_scanner", qty: 1 },
    inputs: [
      { itemId: "data_fragment", qty: 35 },
      { itemId: "neural_chip", qty: 5 },
      { itemId: "encryption_key", qty: 1 }
    ],
    xp: 180
  },
  {
    id: "reinforced_net",
    name: "Reinforced Net",
    output: { itemId: "reinforced_net", qty: 1 },
    inputs: [
      { itemId: "data_fragment", qty: 45 },
      { itemId: "corrupted_file", qty: 6 },
      { itemId: "hologram_badge", qty: 1 }
    ],
    xp: 220
  },
  {
    id: "quantum_scanner",
    name: "Quantum Scanner",
    output: { itemId: "quantum_scanner", qty: 1 },
    inputs: [
      { itemId: "quantum_core", qty: 1 },
      { itemId: "ancient_code", qty: 1 },
      { itemId: "encryption_key", qty: 4 }
    ],
    xp: 400
  }
];

const RECIPE_BY_ID = new Map(RECIPES.map(r => [r.id, r]));

export function listRecipes() {
  return RECIPES.slice();
}

export function getRecipe(recipeId) {
  return RECIPE_BY_ID.get(String(recipeId || "").toLowerCase()) || null;
}

export async function craftRecipe(userId, recipeId, times = 1) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, reason: "unknown-recipe" };

  const n = Math.max(1, Math.min(25, Math.trunc(Number(times) || 1)));
  const p = getPool();
  const now = Date.now();

  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Lock and validate ingredient quantities.
    for (const ing of recipe.inputs) {
      const need = ing.qty * n;
      const row = await client.query(
        `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE`,
        [userId, ing.itemId]
      );
      const have = row.rows.length ? Number(row.rows[0].quantity) : 0;
      if (have < need) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "insufficient", itemId: ing.itemId, need, have };
      }
    }

    // Consume ingredients.
    for (const ing of recipe.inputs) {
      const need = ing.qty * n;
      const row = await client.query(
        `UPDATE user_inventory SET quantity = quantity - $1 WHERE user_id = $2 AND item_id = $3 RETURNING quantity`,
        [need, userId, ing.itemId]
      );
      const left = row.rows.length ? Number(row.rows[0].quantity) : 0;
      if (left <= 0) {
        await client.query(`DELETE FROM user_inventory WHERE user_id = $1 AND item_id = $2`, [userId, ing.itemId]);
      }
    }

    // Add output.
    const outQty = recipe.output.qty * n;
    await client.query(
      `INSERT INTO user_inventory (user_id, item_id, quantity, metadata, acquired_at)
       VALUES ($1, $2, $3, '{}'::jsonb, $4)
       ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_inventory.quantity + $3`,
      [userId, recipe.output.itemId, outQty, now]
    );

    await client.query("COMMIT");

    // XP is outside inventory tx, but we surface errors if it fails.
    let xpRes = null;
    try {
      xpRes = await addGameXp(userId, recipe.xp * n, { reason: `craft:${recipe.id}`, multiplier: 1 });
    } catch (err) {
      xpRes = { ok: false, error: err?.message || String(err) };
    }

    return { ok: true, recipe, times: n, outQty, xpRes };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}


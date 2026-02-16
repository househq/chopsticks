// src/game/profile.js
// DB-backed game profile (XP + level).

import { getPool } from "../utils/storage_pg.js";
import { levelFromXp } from "./progression.js";
import { levelRewardCrate } from "./crates.js";
import { syncUserLevelRewardsAcrossGuilds } from "./levelRewards.js";

export async function getGameProfile(userId) {
  const p = getPool();
  const now = Date.now();
  const res = await p.query(
    `INSERT INTO user_game_profiles (user_id, xp, level, created_at, updated_at)
     VALUES ($1, 0, 1, $2, $2)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = $2
     RETURNING user_id, xp, level, created_at, updated_at`,
    [userId, now]
  );
  const row = res.rows[0] || { user_id: userId, xp: 0, level: 1 };
  // Keep level consistent even if older rows were written with different formulas.
  const xp = Math.max(0, Number(row.xp) || 0);
  const computedLevel = levelFromXp(xp);
  if (Number(row.level) !== computedLevel) {
    try {
      await p.query(
        `UPDATE user_game_profiles SET level = $1, updated_at = $2 WHERE user_id = $3`,
        [computedLevel, now, userId]
      );
      row.level = computedLevel;
    } catch {}
  }
  row.xp = xp;
  row.level = computedLevel;
  return row;
}

export async function addGameXp(userId, baseAmount, { reason = "unknown", multiplier = 1 } = {}) {
  const p = getPool();
  const now = Date.now();
  const amt = Math.max(0, Math.trunc(Number(baseAmount) || 0));
  const mult = Number(multiplier);
  const applied = Math.max(0, Math.trunc(amt * (Number.isFinite(mult) ? mult : 1)));
  if (applied <= 0) {
    const cur = await getGameProfile(userId);
    return { ok: true, applied: 0, profile: cur, leveledUp: false, reason };
  }

  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Ensure profile exists and lock it for update.
    const ensure = await client.query(
      `INSERT INTO user_game_profiles (user_id, xp, level, created_at, updated_at)
       VALUES ($1, 0, 1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = $2
       RETURNING user_id, xp, level, created_at, updated_at`,
      [userId, now]
    );
    const before = ensure.rows[0] || { user_id: userId, xp: 0, level: 1 };
    const beforeLevel = Math.max(1, Math.trunc(Number(before.level) || 1));
    const beforeXp = Math.max(0, Math.trunc(Number(before.xp) || 0));

    const nextXp = beforeXp + applied;
    const nextLevel = levelFromXp(nextXp);

    const res = await client.query(
      `UPDATE user_game_profiles
       SET xp = $1, level = $2, updated_at = $3
       WHERE user_id = $4
       RETURNING user_id, xp, level, created_at, updated_at`,
      [nextXp, nextLevel, now, userId]
    );

    const granted = [];

    if (nextLevel > beforeLevel) {
      // Grant one crate per newly achieved level, idempotent via user_level_rewards.
      for (let lvl = beforeLevel + 1; lvl <= nextLevel; lvl += 1) {
        const ins = await client.query(
          `INSERT INTO user_level_rewards (user_id, level, created_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, level) DO NOTHING
           RETURNING level`,
          [userId, lvl, now]
        );
        if (ins.rows.length === 0) continue;
        const crateId = levelRewardCrate(lvl);
        granted.push({ level: lvl, crateId });
        await client.query(
          `INSERT INTO user_inventory (user_id, item_id, quantity, metadata, acquired_at)
           VALUES ($1, $2, 1, '{}'::jsonb, $3)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_inventory.quantity + 1`,
          [userId, crateId, now]
        );
      }
    }

    await client.query("COMMIT");
    const after = res.rows[0] || { user_id: userId, xp: nextXp, level: nextLevel };
    const result = {
      ok: true,
      applied,
      leveledUp: nextLevel > beforeLevel,
      fromLevel: beforeLevel,
      toLevel: nextLevel,
      granted,
      profile: { ...after, xp: nextXp, level: nextLevel },
      reason
    };
    if (result.leveledUp) {
      // Best-effort sync: update configured guild level reward roles on level-up.
      void syncUserLevelRewardsAcrossGuilds(userId, nextLevel).catch(() => {});
    }
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

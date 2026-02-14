// src/economy/wallet.js
// Wallet management for user economy

import { getPool } from "../utils/storage_pg.js";

export async function getWallet(userId) {
  const pool = getPool();
  const now = Date.now();
  
  const result = await pool.query(
    `INSERT INTO user_wallets (user_id, balance, bank, bank_capacity, total_earned, total_spent, created_at, updated_at)
     VALUES ($1, 0, 0, 10000, 0, 0, $2, $2)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = $2
     RETURNING *`,
    [userId, now]
  );
  
  return result.rows[0];
}

export async function addCredits(userId, amount, reason = "unknown") {
  if (amount <= 0) throw new Error("Amount must be positive");
  
  const pool = getPool();
  const now = Date.now();
  
  await pool.query("BEGIN");
  
  try {
    // Update wallet
    const result = await pool.query(
      `UPDATE user_wallets 
       SET balance = balance + $1, total_earned = total_earned + $1, updated_at = $2
       WHERE user_id = $3
       RETURNING *`,
      [amount, now, userId]
    );
    
    if (result.rows.length === 0) {
      // Create wallet if doesn't exist
      await pool.query(
        `INSERT INTO user_wallets (user_id, balance, bank, bank_capacity, total_earned, total_spent, created_at, updated_at)
         VALUES ($1, $2, 0, 10000, $2, 0, $3, $3)`,
        [userId, amount, now]
      );
    }
    
    // Log transaction
    await pool.query(
      `INSERT INTO transaction_log (from_user, to_user, amount, reason, metadata, timestamp)
       VALUES (NULL, $1, $2, $3, '{}', $4)`,
      [userId, amount, reason, now]
    );
    
    await pool.query("COMMIT");
    return { ok: true, newBalance: result.rows[0]?.balance ?? amount };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export async function removeCredits(userId, amount, reason = "unknown") {
  if (amount <= 0) throw new Error("Amount must be positive");
  
  const pool = getPool();
  const now = Date.now();
  
  await pool.query("BEGIN");
  
  try {
    const wallet = await getWallet(userId);
    if (wallet.balance < amount) {
      await pool.query("ROLLBACK");
      return { ok: false, reason: "insufficient" };
    }
    
    const result = await pool.query(
      `UPDATE user_wallets 
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = $2
       WHERE user_id = $3
       RETURNING *`,
      [amount, now, userId]
    );
    
    await pool.query(
      `INSERT INTO transaction_log (from_user, to_user, amount, reason, metadata, timestamp)
       VALUES ($1, NULL, $2, $3, '{}', $4)`,
      [userId, amount, reason, now]
    );
    
    await pool.query("COMMIT");
    return { ok: true, newBalance: result.rows[0].balance };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export async function transferCredits(fromUserId, toUserId, amount, reason = "transfer") {
  if (amount <= 0) throw new Error("Amount must be positive");
  if (fromUserId === toUserId) throw new Error("Cannot transfer to self");
  
  const pool = getPool();
  const now = Date.now();
  
  await pool.query("BEGIN");
  
  try {
    const fromWallet = await getWallet(fromUserId);
    if (fromWallet.balance < amount) {
      await pool.query("ROLLBACK");
      return { ok: false, reason: "insufficient" };
    }
    
    // Deduct from sender
    await pool.query(
      `UPDATE user_wallets 
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = $2
       WHERE user_id = $3`,
      [amount, now, fromUserId]
    );
    
    // Add to receiver
    await pool.query(
      `INSERT INTO user_wallets (user_id, balance, bank, bank_capacity, total_earned, total_spent, created_at, updated_at)
       VALUES ($1, $2, 0, 10000, $2, 0, $3, $3)
       ON CONFLICT (user_id) DO UPDATE 
       SET balance = user_wallets.balance + $2, total_earned = user_wallets.total_earned + $2, updated_at = $3`,
      [toUserId, amount, now]
    );
    
    // Log transaction
    await pool.query(
      `INSERT INTO transaction_log (from_user, to_user, amount, reason, metadata, timestamp)
       VALUES ($1, $2, $3, $4, '{}', $5)`,
      [fromUserId, toUserId, amount, reason, now]
    );
    
    await pool.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export async function depositToBank(userId, amount) {
  if (amount <= 0) throw new Error("Amount must be positive");
  
  const pool = getPool();
  const now = Date.now();
  
  await pool.query("BEGIN");
  
  try {
    const wallet = await getWallet(userId);
    
    if (wallet.balance < amount) {
      await pool.query("ROLLBACK");
      return { ok: false, reason: "insufficient" };
    }
    
    const newBank = wallet.bank + amount;
    if (newBank > wallet.bank_capacity) {
      await pool.query("ROLLBACK");
      return { ok: false, reason: "capacity" };
    }
    
    await pool.query(
      `UPDATE user_wallets 
       SET balance = balance - $1, bank = bank + $1, updated_at = $2
       WHERE user_id = $3`,
      [amount, now, userId]
    );
    
    await pool.query("COMMIT");
    return { ok: true, newBank };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export async function withdrawFromBank(userId, amount) {
  if (amount <= 0) throw new Error("Amount must be positive");
  
  const pool = getPool();
  const now = Date.now();
  
  await pool.query("BEGIN");
  
  try {
    const wallet = await getWallet(userId);
    
    if (wallet.bank < amount) {
      await pool.query("ROLLBACK");
      return { ok: false, reason: "insufficient" };
    }
    
    await pool.query(
      `UPDATE user_wallets 
       SET balance = balance + $1, bank = bank - $1, updated_at = $2
       WHERE user_id = $3`,
      [amount, now, userId]
    );
    
    await pool.query("COMMIT");
    return { ok: true, newBalance: wallet.balance + amount };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

-- Chopsticks Engagement System Database Schema
CREATE TABLE IF NOT EXISTS user_wallets (user_id TEXT PRIMARY KEY, balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0), bank BIGINT NOT NULL DEFAULT 0 CHECK (bank >= 0), bank_capacity BIGINT NOT NULL DEFAULT 10000, total_earned BIGINT NOT NULL DEFAULT 0, total_spent BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_wallets_balance ON user_wallets(balance DESC);

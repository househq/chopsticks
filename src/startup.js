/**
 * Unified startup manager for Chopsticks
 * Handles database initialization, configuration validation, and service startup
 * Ensures all services start in correct order with proper error handling
 */

import "dotenv/config";
import { logger } from "./utils/logger.js";

// ===================== CONFIGURATION VALIDATION =====================
function validateConfig() {
  const errors = [];

  // Storage driver
  if (process.env.STORAGE_DRIVER !== 'postgres') {
    errors.push("STORAGE_DRIVER must be 'postgres'");
  }

  // Database URL
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    errors.push("POSTGRES_URL or DATABASE_URL must be set");
  }

  // Discord token
  if (!process.env.DISCORD_TOKEN) {
    errors.push("DISCORD_TOKEN must be set");
  }

  // Agent token encryption key
  if (!process.env.AGENT_TOKEN_KEY) {
    errors.push("AGENT_TOKEN_KEY must be set (generate with: openssl rand -hex 32)");
  } else if (process.env.AGENT_TOKEN_KEY.length !== 64) {
    errors.push(`AGENT_TOKEN_KEY must be exactly 64 hex characters, got ${process.env.AGENT_TOKEN_KEY.length}`);
  }

  if (errors.length > 0) {
    logger.error("Configuration validation failed:");
    errors.forEach(e => logger.error(`  ❌ ${e}`));
    return false;
  }

  logger.info("✅ Configuration validated");
  return true;
}

// ===================== DATABASE INITIALIZATION =====================
async function initializeDatabase() {
  try {
    logger.info("🗄️ Initializing database schema...");
    const { ensureSchema } = await import("./utils/storage.js");
    await ensureSchema();
    logger.info("✅ Database schema initialized");
    return true;
  } catch (err) {
    logger.error("❌ Database initialization failed:", err?.message ?? err);
    return false;
  }
}

// ===================== SERVICE HEALTH CHECKS =====================
async function checkDatabaseHealth() {
  try {
    logger.info("🔍 Checking database health...");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
    });
    
    const result = await pool.query("SELECT NOW()");
    await pool.end();
    
    logger.info("✅ Database connection healthy");
    return true;
  } catch (err) {
    logger.error("❌ Database health check failed:", err?.message ?? err);
    return false;
  }
}

async function checkLavalinkHealth() {
  try {
    logger.info("🔍 Checking Lavalink connection...");
    const { request } = await import("undici");
    const lavalinkUrl = process.env.LAVALINK_URL || "http://lavalink:2333";
    const lavalinkPassword = process.env.LAVALINK_PASSWORD || "youshallnotpass";
    
    const res = await request(`${lavalinkUrl}/version`, {
      headers: {
        "Authorization": lavalinkPassword
      },
      throwOnError: false,
      signal: AbortSignal.timeout(5000)
    });
    
    if (res.statusCode === 200) {
      logger.info("✅ Lavalink connection healthy");
      return true;
    } else {
      logger.warn(`⚠️ Lavalink returned status ${res.statusCode}`);
      return false;
    }
  } catch (err) {
    logger.warn("⚠️ Lavalink health check failed (will retry):", err?.message ?? err);
    return false; // Non-fatal, Lavalink can be unavailable at startup
  }
}

// ===================== STARTUP ORCHESTRATION =====================
export async function startup(serviceName) {
  logger.info(`\n${"=".repeat(60)}`);
  logger.info(`🚀 Starting Chopsticks ${serviceName}`);
  logger.info(`${"=".repeat(60)}\n`);

  // Step 1: Validate configuration
  if (!validateConfig()) {
    logger.error("FATAL: Configuration validation failed");
    process.exit(1);
  }

  // Step 2: Check database health
  if (!await checkDatabaseHealth()) {
    logger.error("FATAL: Database not available");
    logger.info("Waiting 10 seconds before retry...");
    await new Promise(r => setTimeout(r, 10000));
    
    if (!await checkDatabaseHealth()) {
      logger.error("FATAL: Database still not available after retry");
      process.exit(1);
    }
  }

  // Step 3: Initialize database schema
  if (!await initializeDatabase()) {
    logger.error("FATAL: Database schema initialization failed");
    process.exit(1);
  }

  // Step 4: Check optional services
  if (serviceName === "bot" || serviceName === "agents") {
    const lavalinkOk = await checkLavalinkHealth();
    if (!lavalinkOk) {
      logger.warn("⚠️ Lavalink not available yet. It will be retried during runtime.");
    }
  }

  logger.info(`✅ Startup initialization complete for ${serviceName}\n`);
  return true;
}

// ===================== SHUTDOWN HANDLER =====================
export function setupGracefulShutdown(cleanup) {
  const shutdown = async (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);
    
    try {
      if (cleanup && typeof cleanup === 'function') {
        await cleanup();
      }
    } catch (err) {
      logger.error("Error during cleanup:", err?.message ?? err);
    }
    
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ===================== RETRY WITH BACKOFF =====================
export async function retryWithBackoff(fn, maxRetries = 5, initialDelayMs = 1000) {
  let lastErr;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
      
      logger.warn(
        `Attempt ${attempt}/${maxRetries} failed: ${err?.message ?? err}. ` +
        `Retrying in ${Math.round(delayMs / 1000)}s...`
      );
      
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  logger.error(`All ${maxRetries} attempts failed`);
  throw lastErr;
}

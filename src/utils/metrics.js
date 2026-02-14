import client from "prom-client";
import { botLogger } from "./modernLogger.js";

// Initialize Prometheus metrics registry
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register, prefix: "chopsticks_" });

// Custom metrics for Chopsticks bot

// === Bot Metrics ===
export const commandCounter = new client.Counter({
  name: "chopsticks_commands_total",
  help: "Total number of commands executed",
  labelNames: ["command", "status"], // status: success | error | rate_limited
  registers: [register],
});

export const commandDuration = new client.Histogram({
  name: "chopsticks_command_duration_seconds",
  help: "Command execution duration in seconds",
  labelNames: ["command"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// === Economy Metrics ===
export const creditsTransferred = new client.Counter({
  name: "chopsticks_economy_credits_transferred_total",
  help: "Total credits transferred between users",
  registers: [register],
});

export const transactionCounter = new client.Counter({
  name: "chopsticks_economy_transactions_total",
  help: "Total economy transactions",
  labelNames: ["type"], // type: daily | work | pay | gather | purchase
  registers: [register],
});

export const userWalletGauge = new client.Gauge({
  name: "chopsticks_economy_user_wallets_total",
  help: "Total number of user wallets created",
  registers: [register],
});

// === Music Metrics ===
export const musicPlayCounter = new client.Counter({
  name: "chopsticks_music_tracks_played_total",
  help: "Total music tracks played",
  registers: [register],
});

export const activeVoiceConnections = new client.Gauge({
  name: "chopsticks_music_voice_connections_active",
  help: "Number of active voice connections",
  registers: [register],
});

export const queueSize = new client.Histogram({
  name: "chopsticks_music_queue_size",
  help: "Size of music queue",
  buckets: [1, 5, 10, 20, 50, 100],
  registers: [register],
});

// === Agent Pool Metrics ===
export const agentPoolSize = new client.Gauge({
  name: "chopsticks_agent_pool_size_total",
  help: "Total number of agents in pool",
  registers: [register],
});

export const agentPoolActive = new client.Gauge({
  name: "chopsticks_agent_pool_active",
  help: "Number of active agents currently deployed",
  registers: [register],
});

export const agentDeployCounter = new client.Counter({
  name: "chopsticks_agent_deployments_total",
  help: "Total agent deployments",
  labelNames: ["success"], // success: true | false
  registers: [register],
});

// === Security Metrics ===
export const rateLimitHits = new client.Counter({
  name: "chopsticks_rate_limit_hits_total",
  help: "Number of rate limit violations",
  labelNames: ["type"], // type: command | api | sensitive
  registers: [register],
});

export const authAttempts = new client.Counter({
  name: "chopsticks_auth_attempts_total",
  help: "Authentication attempts",
  labelNames: ["status"], // status: success | failure
  registers: [register],
});

// === Database Metrics ===
export const dbQueryDuration = new client.Histogram({
  name: "chopsticks_db_query_duration_seconds",
  help: "Database query execution time",
  labelNames: ["operation"], // operation: select | insert | update | delete
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbConnectionPoolGauge = new client.Gauge({
  name: "chopsticks_db_connection_pool_size",
  help: "Database connection pool size",
  registers: [register],
});

// === Discord API Metrics ===
export const discordApiCalls = new client.Counter({
  name: "chopsticks_discord_api_calls_total",
  help: "Total Discord API calls made",
  labelNames: ["endpoint", "status"],
  registers: [register],
});

export const discordRateLimits = new client.Counter({
  name: "chopsticks_discord_rate_limits_total",
  help: "Number of Discord rate limits hit",
  labelNames: ["endpoint"],
  registers: [register],
});

// === Helper functions ===

// Track command execution
export function trackCommand(commandName, duration, status = "success") {
  commandCounter.inc({ command: commandName, status });
  commandDuration.observe({ command: commandName }, duration / 1000);
}

// Track economy transaction
export function trackTransaction(type, amount) {
  transactionCounter.inc({ type });
  if (amount) {
    creditsTransferred.inc(amount);
  }
}

// Track rate limit hit
export function trackRateLimit(type) {
  rateLimitHits.inc({ type });
}

// Track database query
export function trackDbQuery(operation, duration) {
  dbQueryDuration.observe({ operation }, duration / 1000);
}

// Metrics endpoint for Prometheus scraping
export async function metricsHandler(req, res) {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    botLogger.error({ err }, "Failed to generate metrics");
    res.status(500).end();
  }
}

// Health check endpoint
export function healthHandler(req, res) {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "unknown",
  });
}

export { register };
export default register;

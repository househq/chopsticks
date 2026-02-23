import { ShardingManager } from "discord.js";
import "dotenv/config";
import { logger } from "./utils/logger.js";

function parseShards(input) {
  const v = String(input ?? "").trim().toLowerCase();
  if (!v || v === "auto") return "auto";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "auto";
  return Math.trunc(n);
}

const totalShards = parseShards(process.env.DISCORD_SHARDS ?? process.env.TOTAL_SHARDS);
const token = process.env.DISCORD_TOKEN;

if (!token) {
  logger.error("DISCORD_TOKEN is not set — cannot start shard manager");
  process.exit(1);
}

logger.info({ totalShards }, "[shard] starting ShardingManager");

const manager = new ShardingManager("./src/index.js", {
  token,
  totalShards,
  respawn: true,
  respawnDelay: 5_000,
  shardArgs: [],
  execArgv: [],
});

manager.on("shardCreate", shard => {
  logger.info({ shardId: shard.id, totalShards: manager.totalShards }, "[shard] created");

  shard.on("spawn",   () => logger.info({ shardId: shard.id }, "[shard] spawned"));
  shard.on("ready",   () => logger.info({ shardId: shard.id }, "[shard] ready"));
  shard.on("disconnect", () => logger.warn({ shardId: shard.id }, "[shard] disconnected"));
  shard.on("reconnecting",() => logger.info({ shardId: shard.id }, "[shard] reconnecting"));
  shard.on("death", (process) => {
    const code = process?.exitCode ?? "unknown";
    logger.error({ shardId: shard.id, exitCode: code }, "[shard] died — will respawn");
  });
  shard.on("error", err => {
    logger.error({ shardId: shard.id, err }, "[shard] error");
  });
});

// Forward unhandled errors so the process doesn't silently die
process.on("uncaughtException", err => {
  logger.error({ err }, "[shard-manager] uncaughtException");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[shard-manager] unhandledRejection");
});

await manager.spawn({ delay: 5_500, timeout: 30_000 });
logger.info({ totalShards: manager.totalShards }, "[shard] all shards spawned");

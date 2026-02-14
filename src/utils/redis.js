import { createClient } from "redis";

let redisClient = null;

export async function getRedisClient() {
  if (redisClient) {
    if (!redisClient.isOpen) await redisClient.connect().catch(() => {});
    return redisClient;
  }

  const url = process.env.REDIS_URL || "redis://redis:6379";
  redisClient = createClient({ url });

  redisClient.on("error", (err) => {
    // Suppress spammy connection errors
    if (err.code === "ECONNREFUSED") return;
    console.error("[redis-client] error:", err.message);
  });

  await redisClient.connect();
  return redisClient;
}

export async function setCache(key, value, ttlSeconds = 600) {
  const client = await getRedisClient();
  if (!client?.isOpen) {
    console.error(`[redis:set] client not open for key=${key}`);
    return false;
  }
  try {
    const data = JSON.stringify(value);
    await client.set(key, data, { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.error(`[redis:set] error for key=${key}:`, err.message);
    return false;
  }
}

export async function getCache(key) {
  const client = await getRedisClient();
  if (!client?.isOpen) {
    console.error(`[redis:get] client not open for key=${key}`);
    return null;
  }
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`[redis:get] error for key=${key}:`, err.message);
    return null;
  }
}

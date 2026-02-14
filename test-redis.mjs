import { createClient } from "redis";

(async () => {
  const url = process.env.REDIS_URL || "redis://chopsticks-redis:6379";
  console.log("Connecting to", url);
  const client = createClient({ url });
  
  client.on("error", err => console.error("Redis Error:", err));
  
  try {
    await client.connect();
    console.log("Connected!");
    await client.set("test_key", "hello world", { EX: 10 });
    const val = await client.get("test_key");
    console.log("Read back:", val);
    await client.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
})();

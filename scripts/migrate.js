import "dotenv/config";
import { ensureSchema, closeStoragePg } from "../src/utils/storage_pg.js";

try {
  await ensureSchema();
  console.log("✅ Postgres schema ensured.");
} catch (err) {
  console.error("❌ Migration failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  // ensureSchema opens pg + optional redis clients; close so this script exits.
  await closeStoragePg().catch(() => {});
}

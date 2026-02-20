#!/usr/bin/env node
// scripts/check-env.js
// Standalone environment audit for CI and ops rotations.
// Usage: node scripts/check-env.js
// Exit 0 = all checks pass; Exit 1 = errors found.

import "dotenv/config";

const KNOWN_DEFAULTS = new Set([
  "youshallnotpass", "changeme", "secret", "password", "admin", "test", "example", "default",
]);
function isWeak(v) { return v && (KNOWN_DEFAULTS.has(String(v).toLowerCase()) || String(v).length < 12); }
function isHex(v, len) { return v && new RegExp(`^[0-9a-fA-F]{${len}}$`).test(v); }

const checks = [
  // [label, fn -> {ok, warn, msg}]
  ["DISCORD_TOKEN",             () => process.env.DISCORD_TOKEN ? {ok:true} : {ok:false, msg:"missing"}],
  ["POSTGRES_URL / DATABASE_URL",() => (process.env.POSTGRES_URL||process.env.DATABASE_URL) ? {ok:true} : {ok:false, msg:"missing"}],
  ["STORAGE_DRIVER=postgres",   () => process.env.STORAGE_DRIVER==="postgres" ? {ok:true} : {ok:false, msg:`got '${process.env.STORAGE_DRIVER}'`}],
  ["AGENT_TOKEN_KEY (64 hex)",  () => isHex(process.env.AGENT_TOKEN_KEY, 64) ? {ok:true} : {ok:false, msg:"missing or wrong length (need 64 hex chars — run: openssl rand -hex 32)"}],
  ["DASHBOARD_SESSION_SECRET",  () => {
    const v = process.env.DASHBOARD_SESSION_SECRET;
    if (!v) return {ok:false, msg:"missing"};
    if (v.length < 32) return {ok:false, msg:`too short (${v.length} < 32)`};
    if (isWeak(v)) return {ok:false, msg:"known default value — rotate"};
    return {ok:true};
  }],
  ["REDIS_URL",                 () => process.env.REDIS_URL ? {ok:true} : {ok:false, msg:"missing"}],
  ["REDIS_PASSWORD",            () => process.env.REDIS_PASSWORD ? {ok:true} : {warn:true, msg:"not set — acceptable only on isolated networks"}],
  ["LAVALINK_PASSWORD",         () => {
    const v = process.env.LAVALINK_PASSWORD;
    if (!v) return {warn:true, msg:"not set"};
    if (isWeak(v)) return {warn:true, msg:"known default ('youshallnotpass') — rotate in production"};
    return {ok:true};
  }],
  ["DASHBOARD_ADMIN_TOKEN",     () => {
    const v = process.env.DASHBOARD_ADMIN_TOKEN;
    if (!v) return {warn:true, msg:"not set — dashboard admin endpoints unprotected"};
    if (isWeak(v)) return {ok:false, msg:"known default value — rotate"};
    return {ok:true};
  }],
  ["FUNHUB_INTERNAL_API_KEY",   () => process.env.FUNHUB_INTERNAL_API_KEY ? {ok:true} : {warn:true, msg:"not set — fun API unprotected"}],
];

let errors = 0;
let warnings = 0;
const rows = [];

for (const [label, fn] of checks) {
  const r = fn();
  if (r.ok) {
    rows.push(`  ✅  ${label}`);
  } else if (r.warn) {
    rows.push(`  ⚠️   ${label}: ${r.msg}`);
    warnings++;
  } else {
    rows.push(`  ❌  ${label}: ${r.msg}`);
    errors++;
  }
}

console.log("\n=== Chopsticks Environment Audit ===\n");
rows.forEach(r => console.log(r));
console.log(`\n${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  console.error("FAILED — fix errors before deploying.");
  process.exit(1);
} else if (warnings > 0) {
  console.warn("PASSED with warnings — review before production deploy.");
  process.exit(0);
} else {
  console.log("PASSED — all checks green.");
  process.exit(0);
}

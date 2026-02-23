#!/usr/bin/env node
/**
 * tools/loadtest.js — Autocannon load test for Chopsticks health + internal endpoints
 *
 * Usage:
 *   DASHBOARD_URL=http://localhost:3000 node tools/loadtest.js
 *
 * The dashboard must be running before executing this script.
 * Tests the unauthenticated /health and /api/internal/status endpoints
 * (the only ones accessible without a JWT) to establish baseline latency.
 *
 * Results are printed to stdout. A non-zero exit code is set if p99 > 500ms.
 */

import autocannon from "autocannon";

const BASE = process.env.DASHBOARD_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const DURATION = parseInt(process.env.LOADTEST_DURATION ?? "10", 10);
const CONNECTIONS = parseInt(process.env.LOADTEST_CONNECTIONS ?? "10", 10);

const TARGETS = [
  { title: "GET /health", path: "/health" },
  { title: "GET /api/internal/status", path: "/api/internal/status" },
];

const P99_LIMIT_MS = 500;

async function run(title, path) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      title,
      url: `${BASE}${path}`,
      connections: CONNECTIONS,
      duration: DURATION,
      headers: { accept: "application/json" },
    });

    autocannon.track(instance, { renderProgressBar: true, renderLatencyTable: true });

    instance.on("done", resolve);
    instance.on("error", reject);
  });
}

let exitCode = 0;

for (const { title, path } of TARGETS) {
  console.log(`\n─── ${title} ───`);
  const result = await run(title, path).catch(err => {
    console.error(`  FAILED: ${err.message}`);
    exitCode = 1;
    return null;
  });

  if (!result) continue;

  const p99 = result.latency.p99;
  const rps = Math.round(result.requests.average);
  const errors = result.errors + result.timeouts;

  console.log(`  RPS avg: ${rps}   p99: ${p99}ms   errors: ${errors}`);

  if (p99 > P99_LIMIT_MS) {
    console.error(`  ⚠️  p99 ${p99}ms exceeds ${P99_LIMIT_MS}ms threshold`);
    exitCode = 1;
  } else {
    console.log(`  ✅ p99 within acceptable range`);
  }
}

process.exit(exitCode);

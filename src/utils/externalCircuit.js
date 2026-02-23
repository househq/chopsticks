/**
 * src/utils/externalCircuit.js
 *
 * Circuit-breaker factory for external HTTP API calls.
 *
 * At 200k DAU, an upstream API outage (GitHub, Open-Meteo, AniList, etc.)
 * can back up thousands of Discord interactions awaiting a response.
 * A circuit breaker detects repeated failures and "opens" the circuit,
 * returning a fast fallback error immediately until the upstream recovers.
 *
 * Usage:
 *   const breaker = getBreaker("weather", weatherFetch, { timeout: 4000 });
 *   const result  = await breaker.fire(args);
 *
 * Breakers are singletons keyed by name — one per external service.
 */

import CircuitBreaker from "opossum";
import { logger } from "./logger.js";

/** Default options tuned for Discord's 3-second interaction window */
const DEFAULTS = {
  timeout: 4000,          // abort the call after 4 s
  errorThresholdPercentage: 50, // open after 50% failure rate
  resetTimeout: 30_000,   // try again after 30 s
  volumeThreshold: 5,     // minimum calls before tripping
};

const breakers = new Map();

/**
 * Get or create a named circuit breaker.
 * @param {string} name - Unique service name (used in logs + metrics)
 * @param {Function} fn  - The async function to protect
 * @param {object} [opts] - Override DEFAULTS
 * @returns {CircuitBreaker}
 */
export function getBreaker(name, fn, opts = {}) {
  if (breakers.has(name)) return breakers.get(name);

  const options = { ...DEFAULTS, ...opts, name };
  const breaker = new CircuitBreaker(fn, options);

  breaker.on("open",    () => logger.warn({ service: name }, "[circuit] opened — fast-failing requests"));
  breaker.on("halfOpen",() => logger.info({ service: name }, "[circuit] half-open — testing upstream"));
  breaker.on("close",   () => logger.info({ service: name }, "[circuit] closed — upstream recovered"));
  breaker.on("timeout", () => logger.warn({ service: name }, "[circuit] timeout"));
  breaker.on("reject",  () => logger.debug({ service: name }, "[circuit] rejected (open)"));

  breakers.set(name, breaker);
  return breaker;
}

/**
 * Convenience: fire a one-off protected call without reusing the breaker.
 * If the breaker is open, throws immediately so callers can show a degraded reply.
 */
export async function protectedFetch(name, fn, args, opts = {}) {
  const breaker = getBreaker(name, fn, opts);
  return breaker.fire(...(Array.isArray(args) ? args : [args]));
}

/** Return stats for all active breakers — useful in /botinfo or health endpoint */
export function breakerStats() {
  const out = {};
  for (const [name, b] of breakers) {
    out[name] = {
      state: b.opened ? "open" : b.halfOpen ? "half-open" : "closed",
      stats: b.stats,
    };
  }
  return out;
}

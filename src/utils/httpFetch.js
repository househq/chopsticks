/**
 * src/utils/httpFetch.js
 *
 * Drop-in replacement for `undici.request` / `undici.fetch` with:
 *   - Named circuit breaker per service (auto-created via getBreaker)
 *   - Timeout enforcement (default 4 s — within Discord's 3 s reply window)
 *   - Structured error logging
 *
 * Usage (replaces `import { request } from "undici"`):
 *
 *   import { httpRequest } from "../utils/httpFetch.js";
 *   const { statusCode, body } = await httpRequest("github", url, options);
 *
 * When the circuit for "github" is open, this throws immediately so the
 * command's existing catch block can show a degraded embed in < 1 ms.
 */

import { request as undiciRequest, fetch as undiciFetch } from "undici";
import { getBreaker } from "./externalCircuit.js";

/**
 * Protected `undici.request` — same signature, adds circuit breaking.
 * @param {string} service - Named breaker (e.g. "weather", "github")
 * @param {string} url
 * @param {object} [options]
 */
export function httpRequest(service, url, options = {}) {
  const breaker = getBreaker(service, (u, o) => undiciRequest(u, o), { timeout: 4500 });
  return breaker.fire(url, options);
}

/**
 * Protected `undici.fetch` — same signature, adds circuit breaking.
 * @param {string} service
 * @param {string|URL} url
 * @param {RequestInit} [init]
 */
export function httpFetch(service, url, init = {}) {
  const breaker = getBreaker(service, (u, i) => undiciFetch(u, i), { timeout: 4500 });
  return breaker.fire(url, init);
}

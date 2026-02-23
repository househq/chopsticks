/**
 * src/utils/interactionTimeout.js
 *
 * Interaction timeout guard for 200k DAU reliability.
 *
 * Discord's interaction response window is 3 seconds.  If a deferred
 * interaction's execute() hangs (slow DB query, upstream API stall),
 * Discord silently fails and the user sees a "This interaction failed" message.
 *
 * This utility wraps a deferred-interaction execute in a race against a
 * 2.5 second deadline.  On timeout it:
 *   1. Edits the reply with a graceful "taking longer than expected" message
 *   2. Logs the timeout at warn level
 *   3. Continues letting the original promise run (it may finish late and
 *      succeed on its own — the editReply idempotent call is fine)
 *
 * Usage (in a command's execute after deferReply):
 *
 *   await withTimeout(interaction, async () => {
 *     // ... slow work ...
 *   }, { label: "weather" });
 */

import { botLogger } from "./modernLogger.js";

const DEFAULT_TIMEOUT_MS = 2500;

const TIMEOUT_EMBED = {
  embeds: [{
    color: 0xED4245,
    title: "⏱️ Taking longer than expected",
    description: "The bot is under heavy load. Please try again in a moment.",
    footer: { text: "If this persists, the upstream service may be unavailable." },
  }],
};

/**
 * Run `fn` and race it against a timeout.
 * If the timeout fires first, editReply with a friendly error embed.
 * @param {Interaction} interaction - Must already be deferred
 * @param {Function} fn  - Async function to run
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=2500]
 * @param {string} [opts.label="command"]
 */
export async function withTimeout(interaction, fn, { timeoutMs = DEFAULT_TIMEOUT_MS, label = "command" } = {}) {
  let timerHandle = null;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timerHandle = setTimeout(() => {
      reject(new _TimeoutError(`[interactionTimeout] ${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } catch (err) {
    if (err instanceof _TimeoutError) {
      botLogger.warn({ label, timeoutMs }, err.message);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(TIMEOUT_EMBED).catch(() => {});
        }
      } catch {}
      // Don't rethrow — we've already replied with a graceful message
      return;
    }
    throw err;
  } finally {
    clearTimeout(timerHandle);
  }
}

class _TimeoutError extends Error {}

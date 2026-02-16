import { EmbedBuilder } from "discord.js";
import { Colors } from "./discordOutput.js";
import { auditLog } from "./audit.js";
import { loadGuildData } from "./storage.js";

export const MOD_LOG_ACTIONS = Object.freeze([
  "ban",
  "unban",
  "kick",
  "timeout",
  "warn",
  "clearwarns",
  "purge",
  "slowmode",
  "lock",
  "unlock",
  "nick",
  "softban",
  "role",
  "ticket"
]);

function defaultEventMap() {
  const out = {};
  for (const action of MOD_LOG_ACTIONS) out[action] = true;
  return out;
}

function normalizeAction(input) {
  const value = String(input || "").trim().toLowerCase();
  return MOD_LOG_ACTIONS.includes(value) ? value : null;
}

function safeText(value, max = 1024) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text || "-";
  if (max <= 3) return text.slice(0, Math.max(0, max));
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

export function normalizeModLogConfig(raw) {
  const cfg = raw && typeof raw === "object" ? { ...raw } : {};
  const events = defaultEventMap();
  if (cfg.events && typeof cfg.events === "object") {
    for (const action of MOD_LOG_ACTIONS) {
      if (typeof cfg.events[action] === "boolean") events[action] = cfg.events[action];
    }
  }

  return {
    enabled: Boolean(cfg.enabled),
    channelId: typeof cfg.channelId === "string" && cfg.channelId.trim() ? cfg.channelId : null,
    includeFailures: typeof cfg.includeFailures === "boolean" ? cfg.includeFailures : true,
    events
  };
}

export function isModLogActionEnabled(config, action, { ok = true } = {}) {
  const cfg = normalizeModLogConfig(config);
  if (!cfg.enabled || !cfg.channelId) return false;
  if (!ok && !cfg.includeFailures) return false;

  const normalizedAction = normalizeAction(action);
  if (!normalizedAction) return false;
  return cfg.events[normalizedAction] !== false;
}

export function buildModLogEmbed(entry = {}) {
  const ok = entry.ok !== false;
  const action = normalizeAction(entry.action) || "unknown";
  const actorTag = safeText(entry.actorTag || "Unknown", 128);
  const actorId = safeText(entry.actorId || "unknown", 64);
  const target = entry.targetTag || entry.targetId
    ? `${safeText(entry.targetTag || entry.targetId, 128)} (${safeText(entry.targetId || "unknown", 64)})`
    : "-";

  const embed = new EmbedBuilder()
    .setTitle(`Moderation ${ok ? "Action" : "Failure"}`)
    .setColor(ok ? Colors.SUCCESS : Colors.WARNING)
    .setDescription(safeText(entry.summary || "Moderation event recorded.", 700))
    .addFields(
      { name: "Action", value: `\`${action}\``, inline: true },
      { name: "Result", value: ok ? "success" : "failed", inline: true },
      { name: "Actor", value: `${actorTag} (${actorId})`, inline: false },
      { name: "Target", value: target, inline: false },
      { name: "Reason", value: safeText(entry.reason || "No reason provided.", 300), inline: false }
    )
    .setTimestamp();

  const context = [];
  if (entry.channelId) context.push(`<#${entry.channelId}>`);
  if (entry.commandName) context.push(`/${safeText(entry.commandName, 64)}`);
  if (context.length) {
    embed.addFields({ name: "Context", value: context.join(" • "), inline: false });
  }

  const details = entry.details && typeof entry.details === "object" ? entry.details : null;
  if (details) {
    const pairs = [];
    for (const [key, value] of Object.entries(details)) {
      if (pairs.length >= 5) break;
      pairs.push(`${safeText(key, 32)}: ${safeText(value, 120)}`);
    }
    if (pairs.length) {
      embed.addFields({ name: "Details", value: pairs.join("\n"), inline: false });
    }
  }

  embed.setFooter({ text: "Chopsticks Moderation Logs" });
  return embed;
}

async function resolveLogChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  const fromCache = guild.channels?.cache?.get?.(channelId) || null;
  if (fromCache) return fromCache;
  return await guild.channels.fetch(channelId).catch(() => null);
}

export async function dispatchModerationLog(guild, entry = {}) {
  if (!guild?.id) return { ok: false, reason: "no-guild" };

  const data = await loadGuildData(guild.id);
  const cfg = normalizeModLogConfig(data?.modLogs);
  const action = normalizeAction(entry.action);
  if (!action) return { ok: false, reason: "unknown-action" };

  const allowed = isModLogActionEnabled(cfg, action, { ok: entry.ok !== false });
  if (!allowed) return { ok: false, reason: "disabled-or-filtered" };

  const channel = await resolveLogChannel(guild, cfg.channelId);
  if (!channel?.isTextBased?.() || typeof channel.send !== "function") {
    return { ok: false, reason: "invalid-channel" };
  }

  const embed = buildModLogEmbed({ ...entry, action });
  const sent = await channel.send({ embeds: [embed] }).then(() => true).catch(() => false);
  if (!sent) return { ok: false, reason: "send-failed" };

  await auditLog({
    guildId: guild.id,
    userId: String(entry.actorId || "system"),
    action: `mod.${action}.${entry.ok === false ? "fail" : "ok"}`,
    details: {
      targetId: entry.targetId || null,
      reason: entry.reason || null,
      commandName: entry.commandName || null,
      channelId: entry.channelId || null
    }
  });

  return { ok: true, channelId: cfg.channelId, action };
}

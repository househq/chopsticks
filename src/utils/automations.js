import { renderScriptDefinition } from "../scripting/renderer.js";
import {
  listGuildEventScripts,
  insertScriptAudit,
  logScriptingError
} from "../scripting/store.js";

const EVENT_SCRIPT_CACHE_TTL_MS = 15_000;
const eventScriptCache = new Map();

function parseEventTriggerValue(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return { eventKey: null, channelId: null };
  const [eventKeyPart, channelPart] = raw.split("@");
  const eventKey = eventKeyPart || null;
  const channelId = /^\d{16,21}$/.test(String(channelPart || "")) ? String(channelPart) : null;
  return { eventKey, channelId };
}

function buildAutomationContext({ guild, channel, user, member, message }) {
  const resolvedUser = user || member?.user || message?.author || null;
  return {
    user: {
      id: resolvedUser?.id || "",
      username: resolvedUser?.username || resolvedUser?.globalName || "user",
      name: resolvedUser?.displayName || resolvedUser?.username || resolvedUser?.globalName || "user"
    },
    guild: {
      id: guild?.id || "",
      name: guild?.name || "guild"
    },
    channel: {
      id: channel?.id || "",
      name: channel?.name || "channel"
    },
    event: {
      memberId: member?.id || null,
      messageId: message?.id || null
    }
  };
}

async function fetchGuildEventScriptsCached(guildId) {
  const now = Date.now();
  const cacheHit = eventScriptCache.get(guildId);
  if (cacheHit && cacheHit.expiresAt > now) return cacheHit.items;

  const items = await listGuildEventScripts(guildId, { limit: 150 });
  eventScriptCache.set(guildId, { items, expiresAt: now + EVENT_SCRIPT_CACHE_TTL_MS });
  return items;
}

async function resolveTextChannel(guild, channelId, fallbackChannel) {
  if (channelId) {
    const cached = guild.channels.cache.get(channelId);
    if (cached?.isTextBased?.() && cached?.send) return cached;
    try {
      const fetched = await guild.channels.fetch(channelId);
      if (fetched?.isTextBased?.() && fetched?.send) return fetched;
    } catch {}
  }

  if (fallbackChannel?.isTextBased?.() && fallbackChannel?.send) return fallbackChannel;
  if (guild.systemChannel?.isTextBased?.() && guild.systemChannel?.send) return guild.systemChannel;

  for (const ch of guild.channels.cache.values()) {
    if (ch?.isTextBased?.() && ch?.send) return ch;
  }
  return null;
}

export async function runGuildEventAutomations({
  guild,
  eventKey,
  channel = null,
  user = null,
  member = null,
  message = null
}) {
  const gid = String(guild?.id || "").trim();
  const ev = String(eventKey || "").trim().toLowerCase();
  if (!gid || !ev) return { ok: false, ran: 0 };

  let scripts = [];
  try {
    scripts = await fetchGuildEventScriptsCached(gid);
  } catch (error) {
    logScriptingError({ op: "event:list", guildId: gid, eventKey: ev }, error);
    return { ok: false, ran: 0 };
  }

  const matches = scripts.filter(script => {
    const parsed = parseEventTriggerValue(script.trigger_value);
    return parsed.eventKey === ev;
  });

  let ran = 0;
  for (const script of matches) {
    const parsed = parseEventTriggerValue(script.trigger_value);
    try {
      const targetChannel = await resolveTextChannel(guild, parsed.channelId, channel || message?.channel || null);
      if (!targetChannel) continue;

      const rendered = renderScriptDefinition(script.definition, buildAutomationContext({
        guild,
        channel: targetChannel,
        user,
        member,
        message
      }));
      if (!rendered?.payload || (!rendered.payload.content && !rendered.payload.embeds?.length)) continue;

      await targetChannel.send(rendered.payload);
      ran += 1;

      await insertScriptAudit({
        guildId: gid,
        scriptId: script.script_id,
        actorUserId: "system",
        action: "event_run",
        details: {
          eventKey: ev,
          channelId: targetChannel.id,
          userId: user?.id || member?.id || message?.author?.id || null
        }
      });
    } catch (error) {
      logScriptingError(
        { op: "event:run", guildId: gid, scriptId: script.script_id, eventKey: ev },
        error
      );
    }
  }

  return { ok: true, ran };
}

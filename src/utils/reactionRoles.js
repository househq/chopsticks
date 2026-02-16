function asString(v) {
  return String(v || "").trim();
}

export function normalizeEmojiInput(input) {
  const raw = asString(input);
  if (!raw) return null;

  const custom = raw.match(/^<a?:\w+:(\d{16,21})>$/);
  if (custom) return `custom:${custom[1]}`;

  if (/^\d{16,21}$/.test(raw)) return `custom:${raw}`;
  return `unicode:${raw}`;
}

export function emojiKeyFromReaction(reaction) {
  const id = asString(reaction?.emoji?.id);
  if (id) return `custom:${id}`;
  const name = asString(reaction?.emoji?.name);
  if (!name) return null;
  return `unicode:${name}`;
}

export function reactionRoleBindingKey(channelId, messageId, emojiKey) {
  const c = asString(channelId);
  const m = asString(messageId);
  const e = asString(emojiKey);
  if (!c || !m || !e) return null;
  return `${c}:${m}:${e}`;
}

export function normalizeReactionRoleConfig(guildData) {
  const out = guildData && typeof guildData === "object" ? guildData : {};
  if (!out.reactionRoles || typeof out.reactionRoles !== "object" || Array.isArray(out.reactionRoles)) {
    out.reactionRoles = {};
  }
  if (!out.reactionRoles.bindings || typeof out.reactionRoles.bindings !== "object" || Array.isArray(out.reactionRoles.bindings)) {
    out.reactionRoles.bindings = {};
  }
  return out;
}

export function listReactionRoleBindings(guildData) {
  const data = normalizeReactionRoleConfig(guildData);
  return Object.entries(data.reactionRoles.bindings || {}).map(([key, value]) => ({
    key,
    channelId: String(value?.channelId || ""),
    messageId: String(value?.messageId || ""),
    emojiKey: String(value?.emojiKey || ""),
    roleId: String(value?.roleId || ""),
    createdBy: String(value?.createdBy || ""),
    createdAt: Number(value?.createdAt || 0)
  }));
}

export function formatEmojiLabel(emojiKey) {
  const raw = asString(emojiKey);
  if (!raw) return "unknown";
  if (raw.startsWith("custom:")) {
    const id = raw.slice("custom:".length);
    return `<:rr:${id}> (\`${id}\`)`;
  }
  if (raw.startsWith("unicode:")) {
    return raw.slice("unicode:".length);
  }
  return raw;
}

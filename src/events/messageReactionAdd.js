import { loadGuildData, saveGuildData } from "../utils/storage.js";
import {
  normalizeReactionRoleConfig,
  emojiKeyFromReaction,
  reactionRoleBindingKey
} from "../utils/reactionRoles.js";
import {
  normalizeStarboardConfig,
  reactionMatchesStarboard,
  buildStarboardEmbed
} from "../utils/starboard.js";

async function applyReactionRole(reaction, user, mode) {
  if (!user || user.bot) return;

  try {
    if (reaction?.partial) await reaction.fetch();
  } catch (error) {
    console.warn("[reactionroles:add] failed to fetch partial reaction:", error?.message || error);
    return;
  }

  const guild = reaction?.message?.guild;
  if (!guild) return;

  const emojiKey = emojiKeyFromReaction(reaction);
  if (!emojiKey) return;

  const guildData = normalizeReactionRoleConfig(await loadGuildData(guild.id));
  const key = reactionRoleBindingKey(reaction.message.channelId, reaction.message.id, emojiKey);
  const binding = guildData?.reactionRoles?.bindings?.[key];
  if (!binding?.roleId) return;

  let member = reaction.message.member;
  if (!member || member.id !== user.id) {
    try {
      member = await guild.members.fetch(user.id);
    } catch (error) {
      console.warn("[reactionroles:add] could not fetch member:", error?.message || error);
      return;
    }
  }

  try {
    if (mode === "add") {
      if (!member.roles.cache.has(binding.roleId)) {
        await member.roles.add(binding.roleId, "Reaction role add");
      }
      return;
    }
    if (mode === "remove") {
      if (member.roles.cache.has(binding.roleId)) {
        await member.roles.remove(binding.roleId, "Reaction role remove");
      }
    }
  } catch (error) {
    console.warn(`[reactionroles:${mode}] role update failed:`, error?.message || error);
  }
}

async function handleStarboard(reaction, user) {
  if (!user || user.bot) return;
  try {
    if (reaction?.partial) await reaction.fetch();
  } catch {
    return;
  }
  if (!reaction?.message?.guild) return;
  const message = reaction.message;
  const guild = message.guild;
  const guildData = normalizeStarboardConfig(await loadGuildData(guild.id));
  const cfg = guildData.starboard;

  if (!cfg.enabled || !cfg.channelId) return;
  if (String(message.channelId) === String(cfg.channelId)) return;
  if (!reactionMatchesStarboard(cfg.emoji, reaction)) return;
  if (!cfg.selfStar && String(user?.id) === String(message.author?.id)) return;
  if (cfg.ignoreBots && message.author?.bot) return;

  const count = Math.max(0, Math.trunc(Number(reaction.count) || 0));
  if (count < cfg.threshold) return;

  let starboardChannel = guild.channels.cache.get(cfg.channelId);
  if (!starboardChannel) {
    try {
      starboardChannel = await guild.channels.fetch(cfg.channelId);
    } catch {
      return;
    }
  }
  if (!starboardChannel?.isTextBased?.() || !starboardChannel?.send) return;

  const sourceId = String(message.id);
  const existingId = String(cfg.posts?.[sourceId] || "").trim();
  const starEmoji = String(cfg.emoji || "⭐");
  const payload = { embeds: [buildStarboardEmbed(message, count, starEmoji)] };

  try {
    if (existingId) {
      const existingMessage = await starboardChannel.messages.fetch(existingId).catch(() => null);
      if (existingMessage) {
        await existingMessage.edit(payload);
        return;
      }
    }

    const posted = await starboardChannel.send(payload);
    cfg.posts[sourceId] = posted.id;
    await saveGuildData(guild.id, guildData);
  } catch (error) {
    console.warn("[starboard:add] failed:", error?.message || error);
  }
}

export default {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    await applyReactionRole(reaction, user, "add");
    await handleStarboard(reaction, user);
  }
};

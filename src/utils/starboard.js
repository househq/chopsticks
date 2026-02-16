import { EmbedBuilder } from "discord.js";
import { Colors } from "./discordOutput.js";
import { normalizeEmojiInput, emojiKeyFromReaction } from "./reactionRoles.js";

function truncate(text, max = 1500) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 3))}...`;
}

export function normalizeStarboardConfig(guildData) {
  const data = guildData && typeof guildData === "object" ? guildData : {};
  if (!data.starboard || typeof data.starboard !== "object" || Array.isArray(data.starboard)) {
    data.starboard = {};
  }
  const s = data.starboard;
  if (typeof s.enabled !== "boolean") s.enabled = false;
  if (typeof s.channelId !== "string") s.channelId = null;
  if (typeof s.emoji !== "string" || !s.emoji.trim()) s.emoji = "⭐";
  const threshold = Number(s.threshold);
  s.threshold = Number.isFinite(threshold) ? Math.min(20, Math.max(1, Math.trunc(threshold))) : 3;
  if (typeof s.selfStar !== "boolean") s.selfStar = false;
  if (typeof s.ignoreBots !== "boolean") s.ignoreBots = true;
  if (!s.posts || typeof s.posts !== "object" || Array.isArray(s.posts)) s.posts = {};
  return data;
}

export function starboardEmojiKey(configEmoji) {
  return normalizeEmojiInput(configEmoji) || "unicode:⭐";
}

export function reactionMatchesStarboard(configEmoji, reaction) {
  const configured = starboardEmojiKey(configEmoji);
  const reactionKey = emojiKeyFromReaction(reaction);
  if (!reactionKey) return false;
  return configured === reactionKey;
}

export function buildStarboardEmbed(message, count, emoji = "⭐") {
  const author = message?.author;
  const member = message?.member;
  const display = member?.displayName || author?.username || "Unknown";
  const avatar = author?.displayAvatarURL?.({ size: 128 }) || null;
  const description = truncate(message?.content || "", 1800) || "*No text content*";

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Starboard`)
    .setColor(Colors.WARNING)
    .setDescription(description)
    .addFields(
      { name: "Author", value: author ? `<@${author.id}>` : "Unknown", inline: true },
      { name: "Stars", value: String(Math.max(0, Math.trunc(Number(count) || 0))), inline: true },
      { name: "Source", value: `[Jump to message](${message?.url || ""})`, inline: true }
    )
    .setTimestamp(message?.createdAt ? new Date(message.createdAt) : new Date());

  if (avatar) embed.setAuthor({ name: display, iconURL: avatar });

  const image = message?.attachments?.find?.(a => a?.contentType?.startsWith?.("image/")) || null;
  if (image?.url) embed.setImage(image.url);
  return embed;
}

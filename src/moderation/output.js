import { AttachmentBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { Colors } from "../utils/discordOutput.js";
import { renderEmbedCardPng } from "../render/svgCard.js";
import { botLogger } from "../utils/modernLogger.js";

export function sanitizeText(text, max = 1024) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, Math.max(0, max));
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

export function buildModEmbed({
  title,
  summary,
  color = Colors.INFO,
  fields = [],
  actor = null,
  footer = "Chopsticks Moderation"
} = {}) {
  const embed = new EmbedBuilder()
    .setTitle(sanitizeText(title || "Moderation"))
    .setDescription(sanitizeText(summary || "Action completed."))
    .setColor(color)
    .setTimestamp();

  const normalizedFields = [];
  for (const field of Array.isArray(fields) ? fields : []) {
    if (!field || !field.name) continue;
    normalizedFields.push({
      name: sanitizeText(field.name, 256),
      value: sanitizeText(field.value ?? "-", 1024),
      inline: Boolean(field.inline)
    });
  }
  if (normalizedFields.length) embed.addFields(normalizedFields.slice(0, 25));

  const footerText = actor ? `${footer} • by ${actor}` : footer;
  embed.setFooter({ text: sanitizeText(footerText, 2048) });
  return embed;
}

function withFlags(payload, ephemeral = true) {
  return {
    ...payload,
    flags: ephemeral ? MessageFlags.Ephemeral : undefined
  };
}

function svgCardsEnabled() {
  if (process.env.NODE_ENV === "test") return false;
  const raw = String(process.env.SVG_CARDS ?? "true").toLowerCase().trim();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

async function maybeAttachSvgCard(payload) {
  if (!svgCardsEnabled()) return payload;
  if (!payload || typeof payload !== "object") return payload;
  if (payload.files && Array.isArray(payload.files) && payload.files.length) return payload;
  const embeds = Array.isArray(payload.embeds) ? payload.embeds : [];
  if (embeds.length !== 1) return payload;

  let embedObj = embeds[0];
  try { if (embedObj?.toJSON) embedObj = embedObj.toJSON(); } catch {}

  try {
    const eb = EmbedBuilder.from(embedObj);
    if (eb?.data?.image?.url) return payload;
    const png = await renderEmbedCardPng(eb.data, { width: 960, height: 540 });
    const fileName = "cs-mod.png";
    eb.setImage(`attachment://${fileName}`);
    return { ...payload, embeds: [eb], files: [new AttachmentBuilder(png, { name: fileName })] };
  } catch (err) {
    botLogger.warn({ err }, "[svg-cards:mod] render failed");
    return payload;
  }
}

export async function replyModEmbed(interaction, payload, { ephemeral = true } = {}) {
  const bodyPayload = await maybeAttachSvgCard(payload);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(bodyPayload);
    return;
  }
  const body = withFlags(bodyPayload, ephemeral);
  await interaction.reply(body);
}

export async function replyModSuccess(interaction, {
  title = "Moderation Action Complete",
  summary = "Completed successfully.",
  fields = []
} = {}, { ephemeral = true } = {}) {
  const embed = buildModEmbed({
    title,
    summary,
    color: Colors.SUCCESS,
    fields,
    actor: interaction?.user?.tag || interaction?.user?.username || null
  });
  await replyModEmbed(interaction, { embeds: [embed] }, { ephemeral });
}

export async function replyModError(interaction, {
  title = "Moderation Action Failed",
  summary = "Request could not be completed.",
  fields = []
} = {}, { ephemeral = true } = {}) {
  const embed = buildModEmbed({
    title,
    summary,
    color: Colors.ERROR,
    fields,
    actor: interaction?.user?.tag || interaction?.user?.username || null
  });
  await replyModEmbed(interaction, { embeds: [embed] }, { ephemeral });
}

export function reasonOrDefault(reason) {
  const text = String(reason || "").trim();
  return text || "No reason provided.";
}

export async function notifyUserByDm(user, message, { enabled = false } = {}) {
  if (!enabled) return "not-requested";
  return user.send(message).then(() => "sent").catch(() => "failed");
}

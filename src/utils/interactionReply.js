import { AttachmentBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { renderEmbedCardPng } from "../render/svgCard.js";
import { Colors } from "./discordOutput.js";

export function withEphemeralFlags(payload, ephemeral = true) {
  return {
    ...payload,
    flags: ephemeral ? MessageFlags.Ephemeral : payload?.flags
  };
}

function svgCardsEnabled() {
  if (process.env.NODE_ENV === "test") return false;
  const raw = String(process.env.SVG_CARDS ?? "true").toLowerCase().trim();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function embedHasImage(embedLike) {
  const e = embedLike && typeof embedLike === "object" ? embedLike : null;
  const url = e?.data?.image?.url ?? e?.image?.url ?? null;
  return Boolean(url);
}

function embedFirstEnabled() {
  const raw = String(process.env.EMBED_FIRST_OUTPUTS ?? "true").toLowerCase().trim();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function shouldKeepPlainContent(text) {
  const t = String(text || "");
  if (!t.trim()) return true;
  if (t.length > 3900) return true; // safer to keep plain near embed description max
  if (t.includes("```")) return true; // preserve code formatting
  if (/<@!?&?\d+>|<#\d+>|@everyone|@here/.test(t)) return true; // preserve mention semantics
  return false;
}

function classifyContentColor(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(error|failed|failure|cannot|denied|invalid|forbidden|missing)\b/.test(t)) return Colors.ERROR;
  if (/\b(success|done|completed|updated|saved|enabled|started)\b/.test(t)) return Colors.SUCCESS;
  if (/\b(warn|warning|careful|caution|limit)\b/.test(t)) return Colors.WARNING;
  return Colors.INFO;
}

function normalizePayloadObject(payload) {
  if (payload && typeof payload === "object") return { ...payload };
  if (typeof payload === "string") return { content: payload };
  return {};
}

export function normalizePayloadForUi(payload, { forceEmbedFirst = false } = {}) {
  const base = normalizePayloadObject(payload);
  if (!forceEmbedFirst && !embedFirstEnabled()) return base;
  if (base.poll) return base;
  if (Array.isArray(base.embeds) && base.embeds.length) return base;
  if (Array.isArray(base.files) && base.files.length) return base;
  if (typeof base.content !== "string") return base;
  if (shouldKeepPlainContent(base.content)) return base;

  const content = String(base.content || "").trim();
  if (!content) return base;

  const embed = new EmbedBuilder()
    .setColor(classifyContentColor(content))
    .setDescription(content);

  delete base.content;
  base.embeds = [embed];
  return base;
}

export async function maybeAttachSvgCard(payload, { forceSvg = false } = {}) {
  if (!forceSvg && !svgCardsEnabled()) return payload;
  if (!payload || typeof payload !== "object") return payload;
  if (payload.files && Array.isArray(payload.files) && payload.files.length) return payload;
  const embeds = Array.isArray(payload.embeds) ? payload.embeds : [];
  if (embeds.length !== 1) return payload;

  let embedObj = embeds[0];
  try {
    if (embedObj?.toJSON) embedObj = embedObj.toJSON();
  } catch {}

  try {
    const eb = EmbedBuilder.from(embedObj);
    if (embedHasImage(eb)) return payload;

    const png = await renderEmbedCardPng(eb.data, { width: 960, height: 540 });
    const fileName = "cs-card.png";
    eb.setImage(`attachment://${fileName}`);

    return {
      ...payload,
      embeds: [eb],
      files: [new AttachmentBuilder(png, { name: fileName })]
    };
  } catch {
    return payload;
  }
}

export async function prepareUiPayload(payload, { forceEmbedFirst = false, forceSvg = false } = {}) {
  const normalized = normalizePayloadForUi(payload, { forceEmbedFirst });
  return await maybeAttachSvgCard({ ...(normalized || {}) }, { forceSvg });
}

export function buildErrorEmbed(description, title = "Error") {
  return new EmbedBuilder()
    .setTitle(String(title || "Error"))
    .setColor(Colors.ERROR)
    .setDescription(String(description || "An error occurred."));
}

export async function replyInteraction(interaction, payload, { ephemeral = true } = {}) {
  const base = await prepareUiPayload(payload);
  if (interaction?.deferred) {
    return interaction.editReply(base);
  }
  const body = withEphemeralFlags(base, ephemeral);
  if (interaction?.replied) {
    return interaction.followUp(body);
  }
  return interaction.reply(body);
}

export async function replyInteractionIfFresh(interaction, payload, { ephemeral = true } = {}) {
  if (interaction?.replied || interaction?.deferred) return false;
  const base = await prepareUiPayload(payload);
  await interaction.reply(withEphemeralFlags(base, ephemeral));
  return true;
}

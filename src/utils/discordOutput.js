import { AttachmentBuilder, EmbedBuilder, MessageFlags } from "discord.js";

// Corporate Colors
export const Colors = {
  PRIMARY: 0x5865F2, // Blurple
  SUCCESS: 0x57F287, // Green
  ERROR: 0xED4245,   // Red
  WARNING: 0xFEE75C, // Yellow
  INFO: 0x3498DB     // Blue
};

export function buildEmbed(title, description, color = Colors.PRIMARY) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description ?? "")
    .setColor(color);
}

function normalizeEphemeral(ephemeral = true) {
  return ephemeral ? MessageFlags.Ephemeral : undefined;
}

async function sendInteractionResponse(interaction, payload, ephemeral = true) {
  const base = { ...payload };
  const flags = normalizeEphemeral(ephemeral);

  if (interaction.deferred) {
    return interaction.editReply(base);
  }
  if (interaction.replied) {
    return interaction.followUp({ ...base, flags });
  }
  return interaction.reply({ ...base, flags });
}

/**
 * Creates a standardized EmbedBuilder instance with common options.
 */
export function makeEmbed(title, description, fields = [], url = null, thumbnail_url = null, color = Colors.PRIMARY, footer = null) {
  const e = new EmbedBuilder().setTitle(title).setDescription(description ?? "").setColor(color);
  if (Array.isArray(fields) && fields.length) e.addFields(fields);
  if (url) e.setURL(url);
  if (thumbnail_url) e.setThumbnail(thumbnail_url);
  if (footer) e.setFooter(footer);
  return e;
}

export function replyEmbed(interaction, title, description, ephemeral = true) {
  return sendInteractionResponse(interaction, {
    embeds: [buildEmbed(title, description)]
  }, ephemeral);
}

export function replySuccess(interaction, titleOrDescription, descriptionOrEphemeral = true, maybeEphemeral = true) {
  let title = "Success";
  let description = String(titleOrDescription ?? "");
  let ephemeral = descriptionOrEphemeral;

  if (typeof descriptionOrEphemeral === "string") {
    title = String(titleOrDescription ?? "Success");
    description = descriptionOrEphemeral;
    ephemeral = maybeEphemeral;
  }

  return sendInteractionResponse(interaction, {
    embeds: [buildEmbed(title, description, Colors.SUCCESS)]
  }, Boolean(ephemeral));
}

export function replyError(interaction, titleOrDescription, descriptionOrEphemeral = true, maybeEphemeral = true) {
  let title = "Error";
  let description = String(titleOrDescription ?? "");
  let ephemeral = descriptionOrEphemeral;

  if (typeof descriptionOrEphemeral === "string") {
    title = String(titleOrDescription ?? "Error");
    description = descriptionOrEphemeral;
    ephemeral = maybeEphemeral;
  }

  return sendInteractionResponse(interaction, {
    embeds: [buildEmbed(title, description, Colors.ERROR)]
  }, Boolean(ephemeral));
}

export function replyEmbedWithJson(interaction, title, description, data, filename = "data.json") {
  const payload = JSON.stringify(data ?? {}, null, 2);
  const file = new AttachmentBuilder(Buffer.from(payload, "utf8"), { name: filename });
  return sendInteractionResponse(interaction, {
    embeds: [buildEmbed(title, description)],
    files: [file]
  }, true);
}

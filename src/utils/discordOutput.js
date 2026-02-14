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
  return interaction.reply({
    embeds: [buildEmbed(title, description)],
    flags: ephemeral ? MessageFlags.Ephemeral : undefined
  });
}

export function replySuccess(interaction, description, ephemeral = true) {
  return interaction.reply({
    embeds: [buildEmbed("Success", description, Colors.SUCCESS)],
    flags: ephemeral ? MessageFlags.Ephemeral : undefined
  });
}

export function replyError(interaction, description, ephemeral = true) {
  return interaction.reply({
    embeds: [buildEmbed("Error", description, Colors.ERROR)],
    flags: ephemeral ? MessageFlags.Ephemeral : undefined
  });
}

export function replyEmbedWithJson(interaction, title, description, data, filename = "data.json") {
  const payload = JSON.stringify(data ?? {}, null, 2);
  const file = new AttachmentBuilder(Buffer.from(payload, "utf8"), { name: filename });
  return interaction.reply({
    embeds: [buildEmbed(title, description)],
    files: [file],
    flags: MessageFlags.Ephemeral
  });
}

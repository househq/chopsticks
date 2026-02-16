import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} from "discord.js";
import { Colors } from "./discordOutput.js";

export const TICKET_UI_PREFIX = "ticketui";

export const TICKET_TYPES = Object.freeze([
  { key: "support", label: "General Support", description: "Questions or setup help" },
  { key: "billing", label: "Billing", description: "Payments, subscriptions, refunds" },
  { key: "report", label: "Report", description: "Report abuse, bugs, or incidents" },
  { key: "appeal", label: "Appeal", description: "Appeals and moderation reviews" },
  { key: "other", label: "Other", description: "Anything else" }
]);

const TYPE_MAP = new Map(TICKET_TYPES.map(t => [t.key, t]));

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function uiId(action) {
  return `${TICKET_UI_PREFIX}:${action}`;
}

export function parseUiId(customId) {
  const raw = String(customId || "");
  const parts = raw.split(":");
  if (parts.length < 2 || parts[0] !== TICKET_UI_PREFIX) return null;
  return { action: parts[1], value: parts[2] || null };
}

export function normalizeTicketsConfig(rawData) {
  const data = isObject(rawData) ? { ...rawData } : {};
  if (!isObject(data.tickets)) data.tickets = {};
  const cfg = data.tickets;

  if (typeof cfg.enabled !== "boolean") cfg.enabled = false;
  if (typeof cfg.panelChannelId !== "string") cfg.panelChannelId = null;
  if (typeof cfg.panelMessageId !== "string") cfg.panelMessageId = null;
  if (typeof cfg.categoryId !== "string") cfg.categoryId = null;
  if (typeof cfg.logChannelId !== "string") cfg.logChannelId = null;
  if (typeof cfg.supportRoleId !== "string") cfg.supportRoleId = null;
  if (typeof cfg.transcriptOnClose !== "boolean") cfg.transcriptOnClose = true;

  const counter = Number(cfg.counter);
  cfg.counter = Number.isFinite(counter) ? Math.max(0, Math.trunc(counter)) : 0;

  data.tickets = cfg;
  return data;
}

export function buildTicketTopic({ ownerId, status = "open", createdAt = Date.now(), type = "support" } = {}) {
  const safeOwner = String(ownerId || "").trim();
  const safeStatus = String(status || "open").toLowerCase() === "closed" ? "closed" : "open";
  const created = Number.isFinite(Number(createdAt)) ? Math.trunc(Number(createdAt)) : Date.now();
  const safeType = TYPE_MAP.has(String(type || "").toLowerCase()) ? String(type).toLowerCase() : "support";
  return `cs_ticket|owner=${safeOwner}|status=${safeStatus}|created=${created}|type=${safeType}`;
}

export function parseTicketTopic(topic) {
  const raw = String(topic || "").trim();
  if (!raw.startsWith("cs_ticket|")) return null;

  const out = { ownerId: null, status: "open", createdAt: null, type: "support" };
  const parts = raw.split("|").slice(1);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (!value) continue;

    if (key === "owner" && /^\d{16,21}$/.test(value)) out.ownerId = value;
    else if (key === "status") out.status = value === "closed" ? "closed" : "open";
    else if (key === "created") {
      const n = Number(value);
      out.createdAt = Number.isFinite(n) ? Math.trunc(n) : null;
    } else if (key === "type" && TYPE_MAP.has(value.toLowerCase())) {
      out.type = value.toLowerCase();
    }
  }

  return out.ownerId ? out : null;
}

export function isTicketChannel(channel) {
  return Boolean(parseTicketTopic(channel?.topic));
}

export function ticketTypeLabel(typeKey) {
  return TYPE_MAP.get(String(typeKey || "").toLowerCase())?.label || "General Support";
}

export function formatTicketChannelName(counter, typeKey = "support") {
  const n = Math.max(1, Math.trunc(Number(counter) || 1));
  const suffix = String(n).padStart(4, "0");
  const type = TYPE_MAP.has(String(typeKey || "").toLowerCase()) ? String(typeKey).toLowerCase() : "support";
  return `ticket-${type}-${suffix}`.slice(0, 90);
}

export function panelComponents() {
  const openButton = new ButtonBuilder()
    .setCustomId(uiId("open"))
    .setLabel("Open Ticket")
    .setStyle(ButtonStyle.Primary);

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId(uiId("type"))
    .setPlaceholder("Choose ticket type and open")
    .addOptions(TICKET_TYPES.map(type => ({
      label: type.label,
      value: type.key,
      description: type.description
    })));

  return [
    new ActionRowBuilder().addComponents(openButton),
    new ActionRowBuilder().addComponents(typeSelect)
  ];
}

export function closeTicketButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(uiId("close"))
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );
}

export function buildPanelEmbed(config) {
  const cfg = normalizeTicketsConfig({ tickets: config }).tickets;
  return new EmbedBuilder()
    .setTitle("Support Tickets")
    .setColor(Colors.INFO)
    .setDescription(
      "Use the controls below to open a support ticket. " +
      "A private channel will be created for you and support staff."
    )
    .addFields(
      {
        name: "Ticket Category",
        value: cfg.categoryId ? `<#${cfg.categoryId}>` : "not configured",
        inline: true
      },
      {
        name: "Support Role",
        value: cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : "not configured",
        inline: true
      },
      {
        name: "Transcript",
        value: cfg.transcriptOnClose ? "enabled" : "disabled",
        inline: true
      }
    )
    .setFooter({ text: "Chopsticks Tickets" })
    .setTimestamp();
}

export function buildTicketWelcomeEmbed({ ownerId, typeKey, createdByTag = null } = {}) {
  const typeLabel = ticketTypeLabel(typeKey);
  return new EmbedBuilder()
    .setTitle("Ticket Opened")
    .setColor(Colors.SUCCESS)
    .setDescription(
      `Owner: <@${ownerId}>\n` +
      `Type: **${typeLabel}**\n` +
      "Use the Close Ticket button when this issue is resolved."
    )
    .setFooter({ text: createdByTag ? `Opened by ${createdByTag}` : "Chopsticks Tickets" })
    .setTimestamp();
}

export function buildTicketStatusEmbed(config, openCount = 0) {
  const cfg = normalizeTicketsConfig({ tickets: config }).tickets;
  return new EmbedBuilder()
    .setTitle("Tickets Status")
    .setColor(cfg.enabled ? Colors.SUCCESS : Colors.WARNING)
    .setDescription(cfg.enabled ? "Tickets are enabled." : "Tickets are disabled.")
    .addFields(
      {
        name: "Panel Channel",
        value: cfg.panelChannelId ? `<#${cfg.panelChannelId}>` : "not configured",
        inline: true
      },
      {
        name: "Category",
        value: cfg.categoryId ? `<#${cfg.categoryId}>` : "not configured",
        inline: true
      },
      {
        name: "Log Channel",
        value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "not configured",
        inline: true
      },
      {
        name: "Support Role",
        value: cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : "not configured",
        inline: true
      },
      {
        name: "Transcript on Close",
        value: cfg.transcriptOnClose ? "yes" : "no",
        inline: true
      },
      {
        name: "Open Tickets",
        value: String(openCount),
        inline: true
      }
    )
    .setTimestamp();
}

export function buildTicketLogEmbed({ title, summary, color = Colors.INFO, fields = [] } = {}) {
  const embed = new EmbedBuilder()
    .setTitle(String(title || "Ticket Event"))
    .setDescription(String(summary || ""))
    .setColor(color)
    .setTimestamp();

  const normalized = [];
  for (const field of Array.isArray(fields) ? fields : []) {
    if (!field?.name) continue;
    normalized.push({
      name: String(field.name).slice(0, 256),
      value: String(field.value ?? "-").slice(0, 1024),
      inline: Boolean(field.inline)
    });
  }
  if (normalized.length) embed.addFields(normalized.slice(0, 25));

  embed.setFooter({ text: "Chopsticks Tickets" });
  return embed;
}

export function buildTicketPermissionOverwrites({ guild, ownerId, supportRoleId }) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (supportRoleId) {
    overwrites.push({
      id: supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  return overwrites;
}

export function canManageTickets(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

export function canCloseTicket({ interaction, ownerId, supportRoleId = null } = {}) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  if (interaction.user?.id && ownerId && String(interaction.user.id) === String(ownerId)) return true;
  if (!supportRoleId) return false;

  const roleCache = interaction.member?.roles?.cache;
  if (roleCache?.has?.(supportRoleId)) return true;
  const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];
  return roleIds.includes?.(supportRoleId) || false;
}

export function ensureTicketCategory(category) {
  return category && category.type === ChannelType.GuildCategory;
}

export async function countOpenTicketsInCategory(guild, categoryId) {
  if (!guild || !categoryId) return 0;
  const channels = guild.channels?.cache;
  if (!channels) return 0;
  let count = 0;
  for (const ch of channels.values()) {
    if (ch.parentId !== categoryId || ch.type !== ChannelType.GuildText) continue;
    const topic = parseTicketTopic(ch.topic);
    if (topic?.status === "open") count += 1;
  }
  return count;
}

export async function findOpenTicketForOwner(guild, categoryId, ownerId) {
  if (!guild || !categoryId || !ownerId) return null;
  const channels = guild.channels?.cache;
  if (!channels) return null;

  for (const ch of channels.values()) {
    if (ch.parentId !== categoryId || ch.type !== ChannelType.GuildText) continue;
    const topic = parseTicketTopic(ch.topic);
    if (!topic) continue;
    if (topic.status === "open" && String(topic.ownerId) === String(ownerId)) return ch;
  }
  return null;
}

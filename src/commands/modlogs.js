import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { Colors } from "../utils/discordOutput.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";
import { MOD_LOG_ACTIONS, normalizeModLogConfig, dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  deployGlobal: false,
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageGuild],
  category: "mod"
};

function actionChoices() {
  return MOD_LOG_ACTIONS.map(action => ({ name: action, value: action }));
}

export const data = new SlashCommandBuilder()
  .setName("modlogs")
  .setDescription("Configure moderation action logs")
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription("Enable moderation logs and set destination channel")
      .addChannelOption(o =>
        o
          .setName("channel")
          .setDescription("Text channel for moderation logs")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addBooleanOption(o =>
        o
          .setName("include_failures")
          .setDescription("Include failed moderation attempts in logs")
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("event")
      .setDescription("Enable or disable a moderation action event")
      .addStringOption(o =>
        o
          .setName("action")
          .setDescription("Moderation action")
          .setRequired(true)
          .addChoices(...actionChoices())
      )
      .addBooleanOption(o =>
        o
          .setName("enabled")
          .setDescription("Whether this action should be logged")
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("status")
      .setDescription("Show current moderation log configuration")
  )
  .addSubcommand(sub =>
    sub
      .setName("disable")
      .setDescription("Disable moderation logs")
  )
  .addSubcommand(sub =>
    sub
      .setName("test")
      .setDescription("Send a test moderation log entry")
      .addStringOption(o =>
        o
          .setName("action")
          .setDescription("Action to simulate")
          .setRequired(false)
          .addChoices(...actionChoices())
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function buildStatusEmbed(cfg) {
  const enabledEvents = MOD_LOG_ACTIONS.filter(action => cfg.events[action] !== false);
  const disabledEvents = MOD_LOG_ACTIONS.filter(action => cfg.events[action] === false);

  return new EmbedBuilder()
    .setTitle("Moderation Log Status")
    .setColor(cfg.enabled ? Colors.SUCCESS : Colors.WARNING)
    .setDescription(cfg.enabled
      ? "Moderation logs are enabled."
      : "Moderation logs are disabled.")
    .addFields(
      {
        name: "Destination",
        value: cfg.channelId ? `<#${cfg.channelId}>` : "not configured",
        inline: true
      },
      {
        name: "Include Failures",
        value: cfg.includeFailures ? "yes" : "no",
        inline: true
      },
      {
        name: "Enabled Events",
        value: enabledEvents.length ? enabledEvents.map(a => `\`${a}\``).join(", ") : "none",
        inline: false
      },
      {
        name: "Disabled Events",
        value: disabledEvents.length ? disabledEvents.map(a => `\`${a}\``).join(", ") : "none",
        inline: false
      }
    )
    .setFooter({ text: "Use /modlogs event to tune event filters." })
    .setTimestamp();
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId;
  const guildData = await loadGuildData(guildId);
  const cfg = normalizeModLogConfig(guildData.modLogs);

  if (sub === "setup") {
    const channel = interaction.options.getChannel("channel", true);
    const includeFailures = interaction.options.getBoolean("include_failures");
    cfg.enabled = true;
    cfg.channelId = channel.id;
    if (includeFailures !== null) cfg.includeFailures = includeFailures;
    guildData.modLogs = cfg;
    await saveGuildData(guildId, guildData);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Moderation Logs Enabled")
          .setColor(Colors.SUCCESS)
          .setDescription(`Routing moderation logs to <#${channel.id}>.`)
          .addFields(
            { name: "Include Failures", value: cfg.includeFailures ? "yes" : "no", inline: true },
            { name: "Enabled Events", value: String(MOD_LOG_ACTIONS.length), inline: true }
          )
          .setTimestamp()
      ],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (sub === "event") {
    const action = interaction.options.getString("action", true);
    const enabled = interaction.options.getBoolean("enabled", true);
    cfg.events[action] = enabled;
    guildData.modLogs = cfg;
    await saveGuildData(guildId, guildData);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Mod Log Event Updated")
          .setColor(enabled ? Colors.SUCCESS : Colors.WARNING)
          .setDescription(`Event \`${action}\` is now **${enabled ? "enabled" : "disabled"}**.`)
          .setFooter({ text: "Use /modlogs status to review all filters." })
          .setTimestamp()
      ],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (sub === "disable") {
    cfg.enabled = false;
    guildData.modLogs = cfg;
    await saveGuildData(guildId, guildData);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Moderation Logs Disabled")
          .setColor(Colors.WARNING)
          .setDescription("Moderation log routing is now disabled.")
          .setTimestamp()
      ],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (sub === "test") {
    const action = interaction.options.getString("action") || "warn";
    const dispatch = await dispatchModerationLog(interaction.guild, {
      action,
      ok: true,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: interaction.user.id,
      targetTag: interaction.user.tag,
      reason: "Manual test entry",
      summary: `Test moderation log for action '${action}'.`,
      commandName: "modlogs",
      channelId: interaction.channelId,
      details: {
        mode: "test"
      }
    });

    const ok = dispatch.ok;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(ok ? "Mod Log Test Sent" : "Mod Log Test Failed")
          .setColor(ok ? Colors.SUCCESS : Colors.ERROR)
          .setDescription(ok
            ? `Posted test log to <#${dispatch.channelId}>.`
            : `Could not dispatch test log (${dispatch.reason || "unknown"}).`)
          .setTimestamp()
      ],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({ embeds: [buildStatusEmbed(cfg)], flags: MessageFlags.Ephemeral });
}

export default { data, execute, meta };

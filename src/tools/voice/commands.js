// src/tools/voice/commands.js

import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits
} from "discord.js";

import {
  addLobby,
  removeLobby,
  resetVoice,
  getStatus,
  setLobbyEnabled
} from "./controller.js";

import { setLobbyLimits, getLobbyLimits } from "./limits.js";
import { loadGuildData } from "../../utils/storage.js";
import { ensureVoiceState } from "./state.js";

export const voiceCommand = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Join-to-create voice configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a join-to-create lobby")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Lobby voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName("category")
            .setDescription("Category for spawned channels")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName("template")
            .setDescription("Channel name template ({user})")
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove a lobby")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Lobby voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("enable")
        .setDescription("Enable a lobby")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Lobby voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable a lobby")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Lobby voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("limits")
        .setDescription("Configure lobby limits")
        .addChannelOption(opt =>
          opt
            .setName("channel")
            .setDescription("Lobby voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName("max_channels")
            .setDescription("Maximum spawned channels (0 = unlimited)")
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName("cleanup_mode")
            .setDescription("Cleanup behavior when lobby removed")
            .addChoices(
              { name: "Immediate (delete all)", value: "immediate" },
              { name: "Wait until empty", value: "wait-until-empty" }
            )
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName("validate_category")
            .setDescription("Validate category permissions on enable")
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("Show voice system state")
    )

    .addSubcommand(sub =>
      sub
        .setName("reset")
        .setDescription("Reset all voice configuration")
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    try {
      /* ---------- ADD ---------- */

      if (sub === "add") {
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");
        const template =
          interaction.options.getString("template") ?? "{user}'s room";

        const data = loadGuildData(guildId);
        ensureVoiceState(data);

        if (data.voice.tempChannels[channel.id]) {
          await interaction.reply({
            content:
              "Cannot add lobby\n" +
              "Selected channel is an auto-created temporary voice channel",
            flags: 64
          });
          return;
        }

        const result = await addLobby(
          guildId,
          channel.id,
          category.id,
          template,
          guild
        );

        let content;

        switch (result.reason) {
          case undefined:
            content =
              "Voice lobby created\n" +
              `Lobby: ${channel}\n` +
              `Category: ${category}\n` +
              `Template: \`${template}\`\n` +
              `Status: disabled (use /voice enable to activate)`;
            break;

          case "exists":
            content = "Lobby already exists\n" + `Lobby: ${channel}`;
            break;

          case "temp-channel":
            content =
              "Cannot add lobby\n" +
              "Selected channel is a spawned temporary voice channel";
            break;

          case "category-bound":
            content =
              "Cannot add lobby\n" +
              "Category already managed by another lobby";
            break;

          case "spawned-channel":
            content =
              "Cannot add lobby\n" +
              "Selected channel was spawned by a lobby";
            break;

          case "category-not-found":
            content =
              "Cannot add lobby\n" +
              "Category does not exist or is not a category channel";
            break;

          case "missing-manage-channels":
            content =
              "Cannot add lobby\n" +
              "Bot lacks Manage Channels permission in category";
            break;

          case "missing-view-channel":
            content =
              "Cannot add lobby\n" +
              "Bot lacks View Channel permission in category";
            break;

          case "bot-member-unavailable":
          case "permissions-unavailable":
          case "validation-error":
            content =
              "Cannot add lobby\n" +
              "Failed to validate category permissions\n" +
              "Check bot permissions and try again";
            break;

          default:
            content = "Failed to add lobby\n" + `Lobby: ${channel}`;
        }

        await interaction.reply({ content, flags: 64 });
        return;
      }

      /* ---------- REMOVE ---------- */

      if (sub === "remove") {
        const channel = interaction.options.getChannel("channel");
        const result = await removeLobby(guildId, channel.id, guild);

        let content;
        if (result.ok) {
          content =
            `Lobby removed\n` +
            `Lobby: ${channel}\n` +
            `Cleanup mode: ${result.cleanupMode}\n` +
            `Affected channels: ${result.deletedCount}`;
        } else {
          content = `No lobby exists\nLobby: ${channel}`;
        }

        await interaction.reply({ content, flags: 64 });
        return;
      }

      /* ---------- ENABLE / DISABLE ---------- */

      if (sub === "enable" || sub === "disable") {
        const channel = interaction.options.getChannel("channel");
        const enabled = sub === "enable";

        const result = await setLobbyEnabled(guildId, channel.id, enabled);

        let content;

        if (result.ok && result.noop) {
          content =
            "No change applied\n" +
            `Lobby already ${enabled ? "enabled" : "disabled"}`;
        } else if (result.ok) {
          content =
            "Lobby state updated\n" +
            `Lobby: ${channel}\n` +
            `Status: ${enabled ? "enabled" : "disabled"}`;
        } else if (result.reason === "missing") {
          content = "No lobby exists\n" + `Lobby: ${channel}`;
        } else if (result.reason === "category-conflict") {
          content =
            "Cannot enable lobby\n" +
            "Another enabled lobby already manages this category";
        } else {
          content = "Failed to update lobby\n" + `Lobby: ${channel}`;
        }

        await interaction.reply({ content, flags: 64 });
        return;
      }

      /* ---------- LIMITS ---------- */

      if (sub === "limits") {
        const channel = interaction.options.getChannel("channel");
        const maxChannels = interaction.options.getInteger("max_channels");
        const cleanupMode = interaction.options.getString("cleanup_mode");
        const validateCategory = interaction.options.getBoolean(
          "validate_category"
        );

        if (
          maxChannels === null &&
          cleanupMode === null &&
          validateCategory === null
        ) {
          const current = getLobbyLimits(guildId, channel.id);

          if (!current.ok) {
            await interaction.reply({
              content: "No lobby exists\n" + `Lobby: ${channel}`,
              flags: 64
            });
            return;
          }

          const limits = current.limits;
          const content =
            "Current lobby limits\n" +
            `Lobby: ${channel}\n` +
            `Max channels: ${limits.maxChannels ?? "unlimited"}\n` +
            `Cleanup mode: ${limits.cleanupMode}\n` +
            `Validate category: ${limits.validateCategory}`;

          await interaction.reply({ content, flags: 64 });
          return;
        }

        const options = {};
        if (maxChannels !== null) {
          options.maxChannels = maxChannels === 0 ? null : maxChannels;
        }
        if (cleanupMode !== null) {
          options.cleanupMode = cleanupMode;
        }
        if (validateCategory !== null) {
          options.validateCategory = validateCategory;
        }

        const result = await setLobbyLimits(guildId, channel.id, options);

        let content;

        if (result.ok && result.noop) {
          content = "No changes applied\n" + `Lobby: ${channel}`;
        } else if (result.ok) {
          content =
            "Lobby limits updated\n" +
            `Lobby: ${channel}\n` +
            (options.maxChannels !== undefined
              ? `Max channels: ${options.maxChannels ?? "unlimited"}\n`
              : "") +
            (options.cleanupMode !== undefined
              ? `Cleanup mode: ${options.cleanupMode}\n`
              : "") +
            (options.validateCategory !== undefined
              ? `Validate category: ${options.validateCategory}\n`
              : "");
        } else if (result.reason === "missing") {
          content = "No lobby exists\n" + `Lobby: ${channel}`;
        } else if (result.reason === "invalid-max-channels") {
          content =
            "Invalid max_channels value\n" + "Must be 0 (unlimited) or 1-100";
        } else if (result.reason === "invalid-cleanup-mode") {
          content =
            "Invalid cleanup_mode value\n" +
            "Must be 'immediate' or 'wait-until-empty'";
        } else if (result.reason === "invalid-validate-category") {
          content =
            "Invalid validate_category value\n" + "Must be true or false";
        } else {
          content = "Failed to update limits\n" + `Lobby: ${channel}`;
        }

        await interaction.reply({ content, flags: 64 });
        return;
      }

      /* ---------- STATUS ---------- */

      if (sub === "status") {
        const status = await getStatus(guildId);
        await interaction.reply({
          content: "```json\n" + JSON.stringify(status, null, 2) + "\n```",
          flags: 64
        });
        return;
      }

      /* ---------- RESET ---------- */

      if (sub === "reset") {
        await resetVoice(guildId);
        await interaction.reply({
          content:
            "Voice system reset\n" +
            "All lobbies cleared\n" +
            "All temp channel records removed",
          flags: 64
        });
        return;
      }
    } catch (err) {
      console.error("voice command error:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "Voice command failed\n" + "Internal error logged",
          flags: 64
        });
      }
    }
  }
};
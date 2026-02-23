import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";
import { Colors } from "../utils/discordOutput.js";
import { sanitizeString } from "../utils/validation.js";

export const meta = {
  category: "admin",
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageGuild]
};

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Welcome message settings")
  .addSubcommand(s =>
    s
      .setName("set")
      .setDescription("Set welcome channel")
      .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true))
  )
  .addSubcommand(s =>
    s
      .setName("message")
      .setDescription("Set welcome message")
      .addStringOption(o => o.setName("text").setDescription("Message with {user}").setRequired(true))
  )
  .addSubcommand(s => s.setName("preview").setDescription("Preview current welcome configuration"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable welcome"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function buildWelcomeEmbed(title, description, color = Colors.INFO) {
  return {
    embeds: [
      {
        title,
        description,
        color,
        timestamp: new Date().toISOString()
      }
    ],
    flags: MessageFlags.Ephemeral
  };
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const data = await loadGuildData(interaction.guildId);
  data.welcome ??= { enabled: false, channelId: null, message: "Welcome {user}!" };

  if (sub === "set") {
    const channel = interaction.options.getChannel("channel", true);
    data.welcome.channelId = channel.id;
    data.welcome.enabled = true;
    await saveGuildData(interaction.guildId, data);
    await interaction.reply(
      buildWelcomeEmbed("Welcome Channel Updated", `Welcome messages will post in <#${channel.id}>.`, Colors.SUCCESS)
    );
    return;
  }

  if (sub === "message") {
    const text = sanitizeString(interaction.options.getString("text", true));
    data.welcome.message = text;
    data.welcome.enabled = true;
    await saveGuildData(interaction.guildId, data);
    await interaction.reply(
      buildWelcomeEmbed(
        "Welcome Message Updated",
        `Template saved.\n\nPreview:\n${text.slice(0, 900)}`,
        Colors.SUCCESS
      )
    );
    return;
  }

  if (sub === "preview") {
    const channelLine = data.welcome.channelId ? `<#${data.welcome.channelId}>` : "Not set";
    await interaction.reply(
      buildWelcomeEmbed(
        "Welcome Configuration",
        `Status: **${data.welcome.enabled ? "Enabled" : "Disabled"}**\n` +
        `Channel: ${channelLine}\n` +
        `Template:\n${String(data.welcome.message || "Welcome {user}!").slice(0, 900)}\n\n` +
        "Placeholders: `{user}`",
        Colors.INFO
      )
    );
    return;
  }

  if (sub === "disable") {
    data.welcome.enabled = false;
    await saveGuildData(interaction.guildId, data);
    await interaction.reply(buildWelcomeEmbed("Welcome Disabled", "Welcome messages are now disabled.", Colors.WARNING));
  }
}

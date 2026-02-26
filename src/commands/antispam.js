import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";
import { Colors, replyEmbed, replySuccess, replyError } from "../utils/discordOutput.js";

export const meta = {
  deployGlobal: false,
  category: "safety",
  userPerms: ["ManageGuild"],
  guildOnly: true
};

const VALID_ACTIONS = ["mute", "kick", "ban"];

/**
 * Validate antispam configuration parameters.
 * @returns {string|null} error message, or null if valid
 */
export function validateAntispam(threshold, action, window) {
  if (!Number.isInteger(threshold) || threshold < 3 || threshold > 20) {
    return "Threshold must be an integer between 3 and 20.";
  }
  if (!VALID_ACTIONS.includes(action)) {
    return `Action must be one of: ${VALID_ACTIONS.join(", ")}.`;
  }
  if (!Number.isInteger(window) || window < 5 || window > 60) {
    return "Window must be an integer between 5 and 60 seconds.";
  }
  return null;
}

export const data = new SlashCommandBuilder()
  .setName("antispam")
  .setDescription("Configure automatic spam protection for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName("set")
      .setDescription("Enable and configure antispam protection")
      .addIntegerOption(o =>
        o.setName("threshold").setDescription("Messages in window before action (3–20)").setRequired(true).setMinValue(3).setMaxValue(20)
      )
      .addStringOption(o =>
        o.setName("action").setDescription("Action to take on the spammer").setRequired(true).addChoices(
          { name: "Mute", value: "mute" },
          { name: "Kick", value: "kick" },
          { name: "Ban", value: "ban" }
        )
      )
      .addIntegerOption(o =>
        o.setName("window").setDescription("Time window in seconds (5–60)").setRequired(true).setMinValue(5).setMaxValue(60)
      )
  )
  .addSubcommand(sub =>
    sub.setName("disable").setDescription("Disable antispam protection")
  )
  .addSubcommand(sub =>
    sub.setName("status").setDescription("Show current antispam configuration")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "set") {
    const threshold = interaction.options.getInteger("threshold", true);
    const action = interaction.options.getString("action", true);
    const window = interaction.options.getInteger("window", true);

    const err = validateAntispam(threshold, action, window);
    if (err) return replyError(interaction, err);

    const guildData = await loadGuildData(interaction.guildId);
    guildData.antispam = { threshold, action, window, enabled: true };
    await saveGuildData(interaction.guildId, guildData);

    return replySuccess(
      interaction,
      "✅ Antispam Enabled",
      `Threshold: **${threshold}** messages / **${window}s** → action: **${action}**`
    );
  }

  if (sub === "disable") {
    const guildData = await loadGuildData(interaction.guildId);
    if (!guildData.antispam) guildData.antispam = {};
    guildData.antispam.enabled = false;
    await saveGuildData(interaction.guildId, guildData);
    return replySuccess(interaction, "✅ Antispam disabled.");
  }

  if (sub === "status") {
    const guildData = await loadGuildData(interaction.guildId);
    const cfg = guildData.antispam;
    if (!cfg || !cfg.enabled) {
      return replyEmbed(interaction, "🛡️ Antispam Status", "**Disabled** — use `/antispam set` to enable.", true, Colors.Neutral);
    }
    return replyEmbed(
      interaction,
      "🛡️ Antispam Status",
      `**Enabled**\nThreshold: **${cfg.threshold}** messages\nWindow: **${cfg.window}s**\nAction: **${cfg.action}**`,
      false,
      Colors.Info
    );
  }
}

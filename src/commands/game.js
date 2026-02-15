import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";
import { Colors, replyEmbed, replyError } from "../utils/discordOutput.js";

const THEMES = [
  { name: "Neo (Default)", value: "neo" },
  { name: "Ember", value: "ember" },
  { name: "Arcane", value: "arcane" }
];

function themeLabel(theme) {
  const t = String(theme || "neo").toLowerCase();
  const hit = THEMES.find(x => x.value === t);
  return hit ? hit.name : "Neo (Default)";
}

export default {
  data: new SlashCommandBuilder()
    .setName("game")
    .setDescription("Game settings and utilities")
    .addSubcommand(sub =>
      sub
        .setName("theme")
        .setDescription("View or set the server theme for game outputs")
        .addStringOption(o =>
          o
            .setName("name")
            .setDescription("Theme name (leave empty to view)")
            .setRequired(false)
            .addChoices(...THEMES)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub !== "theme") {
      await replyError(interaction, "Unknown Action", "This game action is not available.", true);
      return;
    }

    const requested = interaction.options.getString("name", false);

    // View (works in DMs too).
    if (!requested) {
      if (!interaction.inGuild()) {
        await replyEmbed(
          interaction,
          "Game Theme",
          `Default theme: **${themeLabel("neo")}** (\`neo\`)`,
          Colors.PRIMARY,
          true
        );
        return;
      }

      const data = await loadGuildData(interaction.guildId);
      const current = data?.game?.theme || "neo";
      await replyEmbed(
        interaction,
        "Game Theme",
        `Server theme: **${themeLabel(current)}** (\`${String(current)}\`)\n\nSet: \`/game theme name:<theme>\``,
        Colors.PRIMARY,
        true
      );
      return;
    }

    // Set (guild only, requires Manage Guild).
    if (!interaction.inGuild()) {
      await replyError(interaction, "Guild Only", "You can only set the game theme inside a server.", true);
      return;
    }

    const canManage = interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)
      || interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator);

    if (!canManage) {
      await replyError(interaction, "Missing Permissions", "You need **Manage Server** to set the game theme.", true);
      return;
    }

    const next = String(requested).toLowerCase();
    if (!["neo", "ember", "arcane"].includes(next)) {
      await replyError(interaction, "Invalid Theme", "Choose one of: `neo`, `ember`, `arcane`.", true);
      return;
    }

    const data = await loadGuildData(interaction.guildId);
    const updated = { ...data, game: { ...(data?.game || {}), theme: next } };
    await saveGuildData(interaction.guildId, updated);

    await replyEmbed(
      interaction,
      "Game Theme Updated",
      `Server theme is now **${themeLabel(next)}** (\`${next}\`).\n\nTry: \`/gather\``,
      Colors.SUCCESS,
      true
    );
  }
};


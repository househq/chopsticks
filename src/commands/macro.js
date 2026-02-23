import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";

export const meta = {
  guildOnly: true,
  deployGlobal: false,
  userPerms: [PermissionFlagsBits.ManageGuild],
  category: "admin"
};

export const data = new SlashCommandBuilder()
  .setName("macro")
  .setDescription("Macro commands")
  .addSubcommand(s =>
    s
      .setName("set")
      .setDescription("Create/update a macro")
      .addStringOption(o => o.setName("name").setDescription("Name").setRequired(true))
      .addStringOption(o =>
        o.setName("steps").setDescription("Steps, e.g. ping | help | serverinfo").setRequired(true)
      )
  )
  .addSubcommand(s =>
    s
      .setName("delete")
      .setDescription("Delete a macro")
      .addStringOption(o => o.setName("name").setDescription("Name").setRequired(true))
  )
  .addSubcommand(s => s.setName("list").setDescription("List macros"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function parseSteps(input) {
  return String(input)
    .split("|")
    .map(s => s.trim())
    .filter(Boolean)
    .map(raw => {
      const parts = raw.split(/\s+/);
      return { name: parts.shift().toLowerCase(), args: parts };
    });
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const data = await loadGuildData(interaction.guildId);
  data.macros ??= {};

  if (sub === "list") {
    const names = Object.keys(data.macros);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: names.length ? names.join(", ") : "No macros."
    });
    return;
  }

  const name = interaction.options.getString("name", true).toLowerCase();

  if (sub === "set") {
    const steps = interaction.options.getString("steps", true);
    if (!/^[a-z0-9_-]{2,32}$/i.test(name)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Invalid name (2-32 chars)." });
      return;
    }
    data.macros[name] = parseSteps(steps);
    await saveGuildData(interaction.guildId, data);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: `Saved macro: ${name}` });
    return;
  }

  if (sub === "delete") {
    delete data.macros[name];
    await saveGuildData(interaction.guildId, data);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: `Deleted macro: ${name}` });
  }
}

import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder } from "discord.js";
import { buildEmbed } from "../utils/discordOutput.js";
import { listCommandLogs } from "../utils/commandlog.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageGuild],
  category: "admin"
};

export const data = new SlashCommandBuilder()
  .setName("logs")
  .setDescription("Command logs")
  .addSubcommand(s =>
    s
      .setName("show")
      .setDescription("Show recent logs")
      .addIntegerOption(o =>
        o.setName("limit").setDescription("Number of entries").setMinValue(1).setMaxValue(50)
      )
  )
  .addSubcommand(s =>
    s
      .setName("export")
      .setDescription("Export logs")
      .addStringOption(o =>
        o
          .setName("format")
          .setDescription("json or csv")
          .setRequired(true)
          .addChoices(
            { name: "json", value: "json" },
            { name: "csv", value: "csv" }
          )
      )
      .addIntegerOption(o =>
        o.setName("limit").setDescription("Number of entries").setMinValue(1).setMaxValue(200)
      )
  )
  ;

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const limit = interaction.options.getInteger("limit") || (sub === "export" ? 100 : 20);
  const list = await listCommandLogs(interaction.guildId, limit);
  if (sub === "export") {
    const format = interaction.options.getString("format", true);
    let payload = "";
    if (format === "csv") {
      payload = "at,source,name,userId,ok\n" + list.map(l =>
        `${l.at},${l.source},${l.name},${l.userId},${l.ok}`
      ).join("\n");
    } else {
      payload = JSON.stringify(list, null, 2);
    }
    const buf = Buffer.from(payload, "utf8");
    const file = new AttachmentBuilder(buf, { name: `logs.${format}` });
    await interaction.reply({ flags: MessageFlags.Ephemeral, files: [file] });
    return;
  }

  const lines = list.map(l => {
    const when = l.at ? `<t:${Math.floor(l.at / 1000)}:R>` : "";
    const ok = l.ok ? "ok" : "fail";
    return `${when} ${l.source} ${l.name} by <@${l.userId}> ${ok}`;
  });
  const embed = buildEmbed(
    "Command logs",
    lines.length ? lines.join("\n").slice(0, 1900) : "No logs."
  );
  await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
}

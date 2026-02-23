import { SlashCommandBuilder, EmbedBuilder, MessageFlags, version as djsVersion } from "discord.js";

export const meta = {
  category: "util",
  guildOnly: true,
};

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Server, bot, and role information")
  .addSubcommand(sub =>
    sub.setName("server").setDescription("Show this server's info")
  )
  .addSubcommand(sub =>
    sub.setName("bot").setDescription("Show Chopsticks bot info and live stats")
  )
  .addSubcommand(sub =>
    sub.setName("role").setDescription("Show role info")
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Guild only." });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "server") {
    const g = interaction.guild;
    const e = new EmbedBuilder()
      .setTitle(g.name)
      .setThumbnail(g.iconURL({ size: 256 }))
      .addFields(
        { name: "ID", value: g.id, inline: true },
        { name: "Members", value: String(g.memberCount), inline: true },
        { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
        { name: "Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true }
      );
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === "bot") {
    const client = interaction.client;
    const uptimeMs = client.uptime ?? 0;
    const days = Math.floor(uptimeMs / 86_400_000);
    const hours = Math.floor((uptimeMs % 86_400_000) / 3_600_000);
    const mins = Math.floor((uptimeMs % 3_600_000) / 60_000);
    const secs = Math.floor((uptimeMs % 60_000) / 1_000);
    const uptime = [days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`, `${secs}s`]
      .filter(Boolean).join(" ");

    const memMB = (process.memoryUsage().rss / 1_048_576).toFixed(1);
    const agentCount = global.agentManager?.liveAgents?.size ?? 0;

    let poolCount = "—";
    try {
      const { listPools } = await import("../utils/storage_pg.js");
      const pools = await listPools();
      poolCount = String(pools?.length ?? 0);
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle("🥢 Chopsticks — Bot Info")
      .setColor(0x5865f2)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: "🏠 Guilds", value: String(client.guilds.cache.size), inline: true },
        { name: "👥 Users (cached)", value: String(client.users.cache.size), inline: true },
        { name: "🤖 Active Agents", value: String(agentCount), inline: true },
        { name: "🌊 Pools", value: poolCount, inline: true },
        { name: "🧠 Memory", value: `${memMB} MB`, inline: true },
        { name: "⏱️ Uptime", value: uptime, inline: true },
        { name: "📦 discord.js", value: `v${djsVersion}`, inline: true },
        { name: "🟩 Node.js", value: process.version, inline: true },
      )
      .setFooter({ text: client.user.tag })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === "role") {
    const role = interaction.options.getRole("role", true);
    const e = new EmbedBuilder()
      .setTitle(role.name)
      .addFields(
        { name: "ID", value: role.id, inline: true },
        { name: "Members", value: String(role.members.size), inline: true },
        { name: "Color", value: role.hexColor, inline: true },
        { name: "Created", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true }
      );
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }
}


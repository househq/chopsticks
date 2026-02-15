import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { loadGuildData } from "../utils/storage.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Browse commands and get command details")
  .addStringOption(o =>
    o
      .setName("command")
      .setDescription("Specific command to inspect (e.g. music)")
      .setRequired(false)
      .setAutocomplete(true)
  )
  .addBooleanOption(o =>
    o
      .setName("all")
      .setDescription("Show all commands with descriptions")
      .setRequired(false)
  );

const OPTION_TYPES = {
  1: "subcommand",
  2: "subcommand-group",
  3: "string",
  4: "integer",
  5: "boolean",
  6: "user",
  7: "channel",
  8: "role",
  9: "mentionable",
  10: "number",
  11: "attachment"
};

function inferCategory(command) {
  const explicit = command?.meta?.category;
  if (explicit) return String(explicit);

  const name = String(command?.data?.name || "");
  const map = {
    mod: new Set(["ban","unban","kick","timeout","purge","slowmode","warn","warnings","clearwarns","lock","unlock","nick","softban","role"]),
    util: new Set(["ping","uptime","help","serverinfo","userinfo","avatar","roleinfo","botinfo","invite","echo"]),
    fun: new Set(["8ball","coinflip","roll","choose"]),
    admin: new Set(["config","prefix","alias","agents"]),
    music: new Set(["music"]),
    voice: new Set(["voice","welcome","autorole"]),
    tools: new Set(["poll","giveaway","remind"]),
    assistant: new Set(["assistant"]),
    pools: new Set(["pools"])
  };

  for (const [category, names] of Object.entries(map)) {
    if (names.has(name)) return category;
  }
  return "general";
}

function commandRecord(command) {
  const json = command?.data?.toJSON?.() ?? command?.data ?? {};
  const name = String(json.name || command?.data?.name || "");
  const description = String(json.description || command?.data?.description || "No description.");
  const options = Array.isArray(json.options) ? json.options : [];
  const subcommands = options.filter(opt => opt.type === 1);
  const args = options.filter(opt => opt.type !== 1 && opt.type !== 2);
  return {
    name,
    description,
    category: inferCategory(command),
    subcommands,
    args
  };
}

function chunkLines(lines, maxLen = 1750) {
  const out = [];
  let cur = "";
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > maxLen && cur) {
      out.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function replyChunkedEphemeral(interaction, lines) {
  const chunks = chunkLines(lines);
  if (!chunks.length) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "No commands found."
    });
    return;
  }

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: "```" + chunks[0] + "```"
  });
  for (let i = 1; i < chunks.length; i += 1) {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: "```" + chunks[i] + "```"
    });
  }
}

function formatDetailedHelp(record, prefix) {
  const lines = [];
  lines.push(`/${record.name}`);
  lines.push(`${record.description}`);
  lines.push(`Category: ${record.category}`);
  lines.push("");

  if (record.subcommands.length) {
    lines.push("Subcommands:");
    for (const sub of record.subcommands.slice(0, 25)) {
      const desc = String(sub.description || "No description.");
      lines.push(`- /${record.name} ${sub.name} :: ${desc}`);
    }
    lines.push("");
  }

  if (record.args.length) {
    lines.push("Arguments:");
    for (const arg of record.args.slice(0, 25)) {
      const required = arg.required ? "required" : "optional";
      const typeName = OPTION_TYPES[arg.type] || "unknown";
      const desc = String(arg.description || "No description.");
      lines.push(`- ${arg.name} (${typeName}, ${required}) :: ${desc}`);
    }
    lines.push("");
  }

  lines.push(`Slash usage: /${record.name}`);
  lines.push(`Prefix usage: ${prefix}${record.name}`);
  lines.push("Tip: /help all:true to see every command.");
  return lines;
}

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused?.name !== "command") {
    await interaction.respond([]);
    return;
  }

  const q = String(focused.value || "").trim().toLowerCase();
  const candidates = Array.from(interaction.client.commands.values())
    .map(commandRecord)
    .filter(r => r.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const hits = (q
    ? candidates.filter(r => r.name.includes(q) || r.description.toLowerCase().includes(q))
    : candidates
  ).slice(0, 25);

  await interaction.respond(
    hits.map(r => ({
      name: `/${r.name} - ${r.description}`.slice(0, 100),
      value: r.name
    }))
  );
}

export async function execute(interaction) {
  const query = String(interaction.options.getString("command", false) || "").trim().toLowerCase();
  const showAll = interaction.options.getBoolean("all", false) === true;
  const records = Array.from(interaction.client.commands.values())
    .map(commandRecord)
    .filter(r => r.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  let prefix = "!";
  if (interaction.inGuild()) {
    try {
      const data = await loadGuildData(interaction.guildId);
      prefix = data?.prefix?.value || "!";
    } catch {}
  }

  if (query) {
    const exact = records.find(r => r.name === query);
    const fallbackMatches = records.filter(r => r.name.includes(query)).slice(0, 5).map(r => `/${r.name}`);
    if (!exact) {
      const lines = [
        `Command not found: ${query}`,
        "",
        fallbackMatches.length
          ? `Closest matches: ${fallbackMatches.join(", ")}`
          : "No close matches found.",
        "Tip: use autocomplete in /help command:<name>."
      ];
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "```" + lines.join("\n") + "```"
      });
      return;
    }

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "```" + formatDetailedHelp(exact, prefix).join("\n").slice(0, 1900) + "```"
    });
    return;
  }

  const header = [
    "Chopsticks Help",
    `Slash: use /command`,
    `Prefix: use ${prefix}command`,
    "Use /help command:<name> for command details.",
    "Use /commands ui for the interactive command center.",
    ""
  ];
  const listLines = records.map(r =>
    showAll ? `/${r.name} :: ${r.description}` : `/${r.name}`
  );
  await replyChunkedEphemeral(interaction, [...header, ...listLines]);
}

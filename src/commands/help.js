import {
  ActionRowBuilder,
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  StringSelectMenuBuilder
} from "discord.js";
import { loadGuildData } from "../utils/storage.js";

const HELP_UI_PREFIX = "helpui";
const MAIN_VALUE = "__main__";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show the Chopsticks help center");

function categoryMap() {
  return {
    mod: new Set(["ban","unban","kick","timeout","purge","slowmode","warn","warnings","clearwarns","lock","unlock","nick","softban","role"]),
    util: new Set(["ping","uptime","help","serverinfo","userinfo","avatar","roleinfo","botinfo","invite","echo"]),
    fun: new Set(["8ball","coinflip","roll","choose"]),
    admin: new Set(["config","prefix","alias","agents","logs","macro","custom"]),
    music: new Set(["music"]),
    voice: new Set(["voice","welcome","autorole"]),
    tools: new Set(["poll","giveaway","remind","commands"]),
    assistant: new Set(["assistant"]),
    economy: new Set(["balance","bank","daily","work","pay","inventory","vault","collection","gather","use"]),
    pools: new Set(["pools"])
  };
}

function inferCategory(command) {
  const explicit = command?.meta?.category;
  if (explicit) return String(explicit);

  const name = String(command?.data?.name || "");
  const map = categoryMap();
  for (const [category, names] of Object.entries(map)) {
    if (names.has(name)) return category;
  }
  return "general";
}

function commandRecord(command) {
  const json = command?.data?.toJSON?.() ?? command?.data ?? {};
  return {
    name: String(json.name || command?.data?.name || ""),
    description: String(json.description || command?.data?.description || "No description."),
    category: inferCategory(command)
  };
}

function parseHelpUiId(customId) {
  const parts = String(customId || "").split(":");
  if (parts.length < 3) return null;
  if (parts[0] !== HELP_UI_PREFIX) return null;
  return {
    kind: parts[1],
    userId: parts[2]
  };
}

function buildCategoryData(client) {
  const records = Array.from(client.commands.values())
    .map(commandRecord)
    .filter(r => r.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const byCategory = new Map();
  for (const rec of records) {
    const key = rec.category || "general";
    const list = byCategory.get(key) || [];
    list.push(rec);
    byCategory.set(key, list);
  }
  const categories = Array.from(byCategory.keys()).sort();
  return { records, byCategory, categories };
}

function summarizeCategories(categories, byCategory, maxLen = 1000) {
  const parts = [];
  for (const category of categories) {
    const count = byCategory.get(category)?.length ?? 0;
    const piece = `\`${category}\` (${count})`;
    const next = parts.length ? `${parts.join("  ")}  ${piece}` : piece;
    if (next.length > maxLen) break;
    parts.push(piece);
  }
  return parts.join("  ");
}

function formatCategoryCommands(list, maxLen = 980) {
  const lines = [];
  let used = 0;

  for (let i = 0; i < list.length; i += 1) {
    const rec = list[i];
    const line = `• \`/${rec.name}\` - ${rec.description}`;
    const next = used === 0 ? line.length : used + 1 + line.length;
    if (next > maxLen) {
      const remaining = list.length - i;
      if (remaining > 0) lines.push(`…and ${remaining} more.`);
      break;
    }
    lines.push(line);
    used = next;
  }

  return lines.length ? lines.join("\n") : "No commands in this category.";
}

function buildMainEmbed({ prefix, commandCount, categories, byCategory }) {
  return new EmbedBuilder()
    .setTitle("Chopsticks Help Center")
    .setColor(0x00a86b)
    .setDescription(
      "Use the dropdown below to choose a help category. The panel updates in place with category-specific guidance."
    )
    .addFields(
      {
        name: "Quick Start",
        value:
          "1. Deploy agents: `/agents deploy desired_total:10`\n" +
          "2. Start music: `/music play query:<song>`\n" +
          "3. Configure VoiceMaster: `/voice setup` and `/voice console`\n" +
          "4. Open command center: `/commands ui`"
      },
      {
        name: "Core Systems",
        value:
          "• Music + Lavalink + pooled agents\n" +
          "• VoiceMaster temp VCs with owner controls\n" +
          "• Assistant voice workflows\n" +
          "• Pools, deployment, and dashboard tooling"
      },
      {
        name: "Usage",
        value:
          `• Slash commands: \`/command\`\n` +
          `• Prefix commands: \`${prefix}command\`\n` +
          "• Use the category dropdown for focused help"
      },
      {
        name: "Categories",
        value: summarizeCategories(categories, byCategory) || "No categories detected."
      }
    )
    .setFooter({ text: `Chopsticks • ${commandCount} command(s)` })
    .setTimestamp();
}

function buildCategoryEmbed({ category, list, prefix }) {
  const title = category === MAIN_VALUE ? "Chopsticks Help Center" : `Help • ${category}`;
  const description = category === MAIN_VALUE
    ? "Choose a category from the dropdown below."
    : `Commands in \`${category}\` category.`;

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x2b2d31)
    .setDescription(description)
    .addFields(
      {
        name: "Commands",
        value: formatCategoryCommands(list)
      },
      {
        name: "How To Use",
        value:
          "Use slash commands directly from Discord's `/` menu.\n" +
          `Prefix fallback: \`${prefix}command\``
      }
    )
    .setTimestamp();
}

function buildHelpComponents({ userId, categories, byCategory, selected = MAIN_VALUE }) {
  const options = [
    {
      label: "Main Help Center",
      value: MAIN_VALUE,
      description: "Overview and quick-start guidance",
      default: selected === MAIN_VALUE
    }
  ];

  for (const category of categories.slice(0, 24)) {
    const count = byCategory.get(category)?.length ?? 0;
    options.push({
      label: category,
      value: category,
      description: `${count} command(s)`,
      default: selected === category
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${HELP_UI_PREFIX}:category:${userId}`)
    .setPlaceholder("Choose a help category")
    .addOptions(options)
    .setMinValues(1)
    .setMaxValues(1);

  return [new ActionRowBuilder().addComponents(select)];
}

async function resolvePrefix(interaction) {
  let prefix = "!";
  if (!interaction.inGuild()) return prefix;
  try {
    const data = await loadGuildData(interaction.guildId);
    prefix = data?.prefix?.value || "!";
  } catch {}
  return prefix;
}

function buildPanelPayload(interaction, selected) {
  const { records, byCategory, categories } = buildCategoryData(interaction.client);
  const prefix = interaction.__helpPrefix || "!";

  const embed = selected === MAIN_VALUE
    ? buildMainEmbed({ prefix, commandCount: records.length, categories, byCategory })
    : buildCategoryEmbed({ category: selected, list: byCategory.get(selected) || [], prefix });

  const components = buildHelpComponents({
    userId: interaction.user.id,
    categories,
    byCategory,
    selected
  });

  return { embeds: [embed], components };
}

export async function execute(interaction) {
  interaction.__helpPrefix = await resolvePrefix(interaction);
  const payload = buildPanelPayload(interaction, MAIN_VALUE);

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    ...payload
  });
}

export async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu?.()) return false;
  const parsed = parseHelpUiId(interaction.customId);
  if (!parsed || parsed.kind !== "category") return false;

  if (parsed.userId !== interaction.user.id) {
    await interaction.reply({ content: "This help panel belongs to another user.", ephemeral: true });
    return true;
  }

  interaction.__helpPrefix = await resolvePrefix(interaction);
  const selected = String(interaction.values?.[0] || MAIN_VALUE);
  const payload = buildPanelPayload(interaction, selected);
  await interaction.update(payload);
  return true;
}

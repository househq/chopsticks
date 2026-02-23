import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { httpRequest } from "../utils/httpFetch.js";
import { botLogger } from "../utils/modernLogger.js";

export const meta = { category: "fun", guildOnly: false };

export const data = new SlashCommandBuilder()
  .setName("anime")
  .setDescription("Search for anime info via AniList (free, no API key)")
  .addStringOption(o =>
    o.setName("title").setDescription("Anime title to search").setRequired(true)
  );

const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME) {
    title { romaji english }
    description(asHtml: false)
    genres
    averageScore
    episodes
    status
    season
    seasonYear
    siteUrl
    coverImage { large }
    studios(isMain: true) { nodes { name } }
    format
  }
}`;

export async function execute(interaction) {
  await interaction.deferReply();
  const title = interaction.options.getString("title", true).trim();

  try {
    const { statusCode, body } = await httpRequest("anilist", ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Chopsticks-Discord-Bot/1.0"
      },
      body: JSON.stringify({ query: QUERY, variables: { search: title } })
    });
    if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`);

    const json = await body.json();
    const media = json?.data?.Media;

    if (!media) {
      return interaction.editReply({ content: `❌ No anime found for **${title}**.` });
    }

    const name = media.title.english ?? media.title.romaji;
    const desc = media.description?.replace(/<[^>]+>/g, "").slice(0, 400) ?? "No description.";
    const studio = media.studios?.nodes?.[0]?.name ?? "Unknown studio";

    const embed = new EmbedBuilder()
      .setTitle(`🎌 ${name}`)
      .setURL(media.siteUrl)
      .setDescription(desc + (media.description?.length > 400 ? "…" : ""))
      .setColor(0x02a9ff)
      .setThumbnail(media.coverImage?.large ?? null)
      .addFields(
        { name: "⭐ Score", value: media.averageScore ? `${media.averageScore}/100` : "N/A", inline: true },
        { name: "📺 Episodes", value: String(media.episodes ?? "?"), inline: true },
        { name: "🏢 Studio", value: studio, inline: true },
        { name: "📅 Season", value: media.season && media.seasonYear ? `${media.season} ${media.seasonYear}` : "Unknown", inline: true },
        { name: "📋 Status", value: media.status ?? "Unknown", inline: true },
        { name: "🏷️ Genres", value: media.genres?.slice(0, 4).join(", ") ?? "N/A", inline: true }
      )
      .setFooter({ text: "Powered by AniList" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    botLogger.warn({ err, title }, "[anime] fetch failed");
    await interaction.editReply({ content: "❌ Couldn't fetch anime data right now. Try again later." });
  }
}

import { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import { createHash } from "node:crypto";

const CONSOLE_TOKEN_TTL = 10 * 60; // 10 minutes

function getDashboardUrl() {
  const explicit = String(process.env.DASHBOARD_BASE_URL || "").replace(/\/+$/g, "");
  if (explicit) return explicit;

  // Mirror the server-side auto-detection so the bot generates the right link
  if (process.env.RAILWAY_STATIC_URL) return `https://${process.env.RAILWAY_STATIC_URL}`;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/g, "");
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  if (process.env.HEROKU_APP_NAME) return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
  if (process.env.KOYEB_PUBLIC_DOMAIN) return `https://${process.env.KOYEB_PUBLIC_DOMAIN}`;
  if (process.env.PUBLIC_URL) return String(process.env.PUBLIC_URL).replace(/\/+$/g, "");

  const port = process.env.DASHBOARD_PORT || 8788;
  return `http://localhost:${port}`;
}

function getJwtSecret() {
  const explicit = String(process.env.DASHBOARD_SECRET || "").trim();
  if (explicit) return explicit;

  const botToken = String(process.env.DISCORD_TOKEN || "").trim();
  if (botToken) {
    return createHash("sha256").update(botToken + "chopsticks-console-v1").digest("hex").slice(0, 32);
  }
  throw new Error("DISCORD_TOKEN is not set — cannot derive console secret.");
}

async function markTokenUsed(tokenId) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return; // no Redis? skip one-time-use enforcement
  const client = createClient({ url: redisUrl });
  await client.connect().catch(() => null);
  await client.set(`console_token:${tokenId}`, "1", { EX: CONSOLE_TOKEN_TTL }).catch(() => null);
  await client.quit().catch(() => null);
}

export const meta = { category: "utility" };

export const data = new SlashCommandBuilder()
  .setName("console")
  .setDescription("Open your server's Chopsticks control panel in a browser")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const baseUrl = getDashboardUrl();

  let secret;
  try {
    secret = getJwtSecret();
  } catch (err) {
    return interaction.reply({
      content: `❌ ${err.message}`,
      ephemeral: true,
    });
  }

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const tokenId = `${userId}-${guildId}-${Date.now()}`;

  const token = jwt.sign(
    {
      jti: tokenId,
      userId,
      guildId,
      username: interaction.user.username,
      avatarHash: interaction.user.avatar,
    },
    secret,
    { expiresIn: `${CONSOLE_TOKEN_TTL}s` }
  );

  await markTokenUsed(tokenId).catch(() => null);

  const consoleUrl = `${baseUrl}/console-auth?token=${encodeURIComponent(token)}`;

  const button = new ButtonBuilder()
    .setLabel("Open Console")
    .setStyle(ButtonStyle.Link)
    .setURL(consoleUrl)
    .setEmoji("🖥️");

  const row = new ActionRowBuilder().addComponents(button);

  return interaction.reply({
    content:
      `### 🖥️ Chopsticks Console\nYour personalized control panel for **${interaction.guild?.name ?? "this server"}** is ready.\n` +
      `> ⏱️ This link expires in **10 minutes** and can only be used once.\n` +
      `> 🔒 Only you can access this session.`,
    components: [row],
    ephemeral: true,
  });
}


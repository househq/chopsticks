// src/commands/ai.js
// /ai — AI chat, image generation, and provider management.
// Supports: chat | image | set-provider | token link | token unlink | help

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { request } from "undici";
import {
  getGuildAiConfig,
  setGuildAiProvider,
  clearUserAiKey,
  resolveAiKey,
  setUserAiKey,
  setGuildAiPersona,
  clearGuildAiPersona,
} from "../utils/aiConfig.js";
import { validateProviderKey } from "../utils/voiceValidation.js";
import { sanitizeString } from "../utils/validation.js";
import { getRedisClient } from "../utils/redis.js";

export const meta = {
  guildOnly: true,
  category: "ai",
  description: "Chat with AI, generate images, and manage your AI provider settings.",
  keywords: ["ai", "chat", "gpt", "claude", "anthropic", "openai", "ollama", "image", "generate", "llm"],
};

// ── Pure validators (exported for tests) ─────────────────────────────────────

export function validateSummarizeCount(n) {
  if (n < 5 || n > 100) return { ok: false, error: "count must be between 5 and 100" };
  return { ok: true };
}

export function validateTranslateText(str) {
  if (str.length > 500) return { ok: false, error: "text must be 500 characters or fewer" };
  return { ok: true };
}

export function validatePersonaDesc(str) {
  if (str.length > 500) return { ok: false, error: "description must be 500 characters or fewer" };
  return { ok: true };
}

// ── Keyword-based moderation fallback ─────────────────────────────────────────

const SPAM_KEYWORDS = ["buy now", "click here", "free money", "limited offer", "earn money fast", "work from home"];
const SPAM_PATTERNS = [/(.)\1{7,}/];

export function moderateWithKeywords(text) {
  const lower = text.toLowerCase();
  const flags = [];
  if (SPAM_KEYWORDS.some(k => lower.includes(k))) flags.push("spam");
  if (SPAM_PATTERNS.some(p => p.test(lower)))     flags.push("spam");
  const dedupedFlags = [...new Set(flags)];
  const score   = dedupedFlags.length > 0 ? 6 : 1;
  const verdict = dedupedFlags.length > 0 ? "warning" : "safe";
  return { score, flags: dedupedFlags, verdict };
}

const PROVIDER_CHOICES = [
  { name: "None — disable AI (default)", value: "none" },
  { name: "Ollama — self-hosted", value: "ollama" },
  { name: "Anthropic / Claude", value: "anthropic" },
  { name: "OpenAI / GPT", value: "openai" },
];

const TOKEN_PROVIDER_CHOICES = [
  { name: "Anthropic / Claude", value: "anthropic" },
  { name: "OpenAI / GPT", value: "openai" },
  { name: "Ollama — set custom URL", value: "ollama" },
];

export const data = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Chat with AI and manage AI provider settings")
  .addSubcommand(sub =>
    sub.setName("chat")
      .setDescription("Send a message to the AI and get a response")
      .addStringOption(o =>
        o.setName("message")
          .setDescription("Your message or prompt (max 2000 chars)")
          .setRequired(true)
          .setMaxLength(2000)
      )
      .addBooleanOption(o =>
        o.setName("public")
          .setDescription("Post the response publicly in the channel (default: private)")
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName("image")
      .setDescription("Generate an image from a text prompt (requires linked OpenAI key)")
      .addStringOption(o =>
        o.setName("prompt")
          .setDescription("Description of the image to generate (max 1000 chars)")
          .setRequired(true)
          .setMaxLength(1000)
      )
  )
  .addSubcommand(sub =>
    sub.setName("set-provider")
      .setDescription("(Admin) Set the guild-wide default AI provider")
      .addStringOption(o =>
        o.setName("provider")
          .setDescription("AI provider to use as guild default")
          .setRequired(true)
          .addChoices(...PROVIDER_CHOICES)
      )
  )
  .addSubcommandGroup(grp =>
    grp.setName("token")
      .setDescription("Manage your personal AI provider keys")
      .addSubcommand(sub =>
        sub.setName("link")
          .setDescription("Link your personal API key for an AI provider")
          .addStringOption(o =>
            o.setName("provider")
              .setDescription("Provider to link a key for")
              .setRequired(true)
              .addChoices(...TOKEN_PROVIDER_CHOICES)
          )
      )
      .addSubcommand(sub =>
        sub.setName("unlink")
          .setDescription("Remove your linked API key for a provider")
          .addStringOption(o =>
            o.setName("provider")
              .setDescription("Provider to unlink")
              .setRequired(true)
              .addChoices(...TOKEN_PROVIDER_CHOICES)
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName("help")
      .setDescription("Show AI features, current provider, and quick setup guide")
  )
  .addSubcommand(sub =>
    sub.setName("stats")
      .setDescription("Show AI usage statistics for this server")
  )
  .addSubcommand(sub =>
    sub.setName("summarize")
      .setDescription("Summarize recent channel messages using AI")
      .addIntegerOption(o =>
        o.setName("count")
          .setDescription("Number of messages to summarize (5-100, default 20)")
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(100)
      )
  )
  .addSubcommand(sub =>
    sub.setName("translate")
      .setDescription("Translate text to another language using AI")
      .addStringOption(o =>
        o.setName("text")
          .setDescription("Text to translate (max 500 chars)")
          .setRequired(true)
          .setMaxLength(500)
      )
      .addStringOption(o =>
        o.setName("language")
          .setDescription('Target language (e.g. "Spanish", "French", "Japanese")')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName("moderate")
      .setDescription("Moderate a message for policy violations (requires Manage Messages)")
      .addStringOption(o =>
        o.setName("message_id")
          .setDescription("ID of the message to moderate")
          .setRequired(false)
      )
      .addStringOption(o =>
        o.setName("text")
          .setDescription("Text to moderate directly")
          .setRequired(false)
      )
  )
  .addSubcommandGroup(grp =>
    grp.setName("persona")
      .setDescription("Manage the guild AI persona (system prompt)")
      .addSubcommand(sub =>
        sub.setName("set")
          .setDescription("Set a guild AI persona prepended to all /ai chat calls")
          .addStringOption(o =>
            o.setName("description")
              .setDescription("Persona description (max 500 chars)")
              .setRequired(true)
              .setMaxLength(500)
          )
      )
      .addSubcommand(sub =>
        sub.setName("clear")
          .setDescription("Clear the guild AI persona")
      )
  );

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
  }

  const group = interaction.options.getSubcommandGroup(false);
  const sub   = interaction.options.getSubcommand();

  if (group === "token") {
    if (sub === "link")   return handleTokenLink(interaction);
    if (sub === "unlink") return handleTokenUnlink(interaction);
    return;
  }

  if (group === "persona") {
    if (sub === "set")   return handlePersonaSet(interaction);
    if (sub === "clear") return handlePersonaClear(interaction);
    return;
  }

  if (sub === "chat")         return handleChat(interaction);
  if (sub === "image")        return handleImage(interaction);
  if (sub === "set-provider") return handleSetProvider(interaction);
  if (sub === "summarize")    return handleSummarize(interaction);
  if (sub === "translate")    return handleTranslate(interaction);
  if (sub === "moderate")     return handleModerate(interaction);
  if (sub === "help")         return handleHelp(interaction);
  if (sub === "stats")        return handleStats(interaction);
}

// ── /ai chat ─────────────────────────────────────────────────────────────────

const CTX_TTL = 1800;
const MAX_CTX_MESSAGES = 10;

async function handleChat(interaction) {
  const isPublic  = interaction.options.getBoolean("public") ?? false;
  const message   = sanitizeString(interaction.options.getString("message", true));
  const guildId   = interaction.guildId;
  const userId    = interaction.user.id;
  const channelId = interaction.channelId;

  let resolved;
  try {
    resolved = await resolveAiKey(guildId, userId);
  } catch {
    resolved = { provider: null, apiKey: null, ollamaUrl: null };
  }

  if (!resolved.provider) {
    return interaction.reply({
      content: "🤖 No AI provider configured. An admin can run `/ai set-provider` or you can link your own key with `/ai token link`.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: !isPublic });

  // Fetch guild config for persona
  let guildConfig = { provider: "none", ollamaUrl: null, persona: null };
  try { guildConfig = await getGuildAiConfig(guildId); } catch { /* ignore */ }

  // Load rolling context from Redis
  const ctxKey = `ai:ctx:${guildId}:${userId}:${channelId}`;
  let context = [];
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      const raw = await redis.get(ctxKey);
      if (raw) context = JSON.parse(raw);
    }
  } catch { /* Redis unavailable — continue without context */ }

  // Append new user message and cap to rolling window
  context.push({ role: "user", content: message });
  if (context.length > MAX_CTX_MESSAGES) context.splice(0, context.length - MAX_CTX_MESSAGES);

  // Build system prompt from persona + conversation history
  const history = context.slice(0, -1);
  const personaPrefix = guildConfig.persona ? `${guildConfig.persona}\n\n` : "";
  const historyStr = history.length > 0
    ? "Conversation history:\n" + history.map(m => `${m.role}: ${m.content}`).join("\n")
    : "";
  const system = personaPrefix + historyStr;

  let reply;
  try {
    reply = await callAiLlm({
      prompt: message,
      system,
      provider:  resolved.provider,
      apiKey:    resolved.apiKey,
      ollamaUrl: resolved.ollamaUrl,
    });
  } catch (err) {
    await interaction.editReply({ content: `❌ AI request failed: \`${err?.message?.slice(0, 100)}\`` });
    return;
  }

  // Append assistant response and persist context
  context.push({ role: "assistant", content: reply });
  if (context.length > MAX_CTX_MESSAGES) context.splice(0, context.length - MAX_CTX_MESSAGES);
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) await redis.setEx(ctxKey, CTX_TTL, JSON.stringify(context));
  } catch { /* ignore */ }

  const display = reply.length > 2000 ? reply.slice(0, 1997) + "…" : reply;
  await interaction.editReply({ content: display });
}

// ── LLM caller ────────────────────────────────────────────────────────────────

async function callAiLlm({ prompt, system = "", provider, apiKey, ollamaUrl }) {
  const raw = String(process.env.TEXT_LLM_URL || process.env.VOICE_ASSIST_LLM_URL || "").trim();
  if (!raw) throw new Error("llm-not-configured");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);
  try {
    const body = {
      prompt,
      ...(system    && { system }),
      provider,
      ...(apiKey    && { apiKey }),
      ...(ollamaUrl && { ollamaUrl }),
    };
    const url = raw.endsWith("/generate") ? raw : `${raw}/generate`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`llm-failed:${res.status}`);
    const data = await res.json().catch(() => null);
    const text = String(data?.text || data?.response || "").trim();
    if (!text) throw new Error("llm-empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}

// ── /ai image ─────────────────────────────────────────────────────────────────

async function handleImage(interaction) {
  const prompt  = sanitizeString(interaction.options.getString("prompt", true));
  const guildId = interaction.guildId;
  const userId  = interaction.user.id;

  let resolved;
  try {
    resolved = await resolveAiKey(guildId, userId);
  } catch {
    resolved = { provider: null, apiKey: null, ollamaUrl: null };
  }

  // Image generation requires an OpenAI key with a valid apiKey (not just guild provider)
  const imageApiKey = resolved.provider === "openai" ? resolved.apiKey : null;
  if (!imageApiKey) {
    return interaction.reply({
      content: "🎨 Image generation requires an OpenAI key. Link yours with `/ai token link openai`.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: false });

  let imageUrl;
  try {
    const r = await request("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${imageApiKey}`,
      },
      body: JSON.stringify({ prompt, model: "dall-e-3", n: 1, size: "1024x1024" }),
      bodyTimeout:   30_000,
      headersTimeout: 30_000,
    });
    const body = await r.body.json().catch(() => null);
    if (r.statusCode !== 200 || !body?.data?.[0]?.url) {
      throw new Error(`openai-image:${r.statusCode}:${body?.error?.message?.slice(0, 100) ?? ""}`);
    }
    imageUrl = body.data[0].url;
  } catch (err) {
    await interaction.editReply({ content: `❌ Image generation failed: \`${err?.message?.slice(0, 100)}\`` });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🎨 Generated Image")
    .setDescription(prompt.length > 200 ? prompt.slice(0, 197) + "…" : prompt)
    .setImage(imageUrl)
    .setColor(0x00b4d8)
    .setFooter({ text: "Powered by OpenAI DALL-E" });

  await interaction.editReply({ embeds: [embed] });
}

// ── /ai set-provider ──────────────────────────────────────────────────────────

async function handleSetProvider(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "❌ You need the **Manage Server** permission.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const provider = interaction.options.getString("provider", true);
  await setGuildAiProvider(interaction.guildId, provider);

  await interaction.editReply({ content: `✅ AI provider set to \`${provider}\`.` });
}

// ── /ai summarize ─────────────────────────────────────────────────────────────

async function handleSummarize(interaction) {
  const count   = interaction.options.getInteger("count") ?? 20;
  const guildId = interaction.guildId;
  const userId  = interaction.user.id;

  const v = validateSummarizeCount(count);
  if (!v.ok) {
    return interaction.reply({ content: `❌ ${v.error}`, ephemeral: true });
  }

  let resolved;
  try {
    resolved = await resolveAiKey(guildId, userId);
  } catch {
    resolved = { provider: null, apiKey: null, ollamaUrl: null };
  }

  if (!resolved.provider) {
    return interaction.reply({
      content: "No AI provider configured. Use /ai set-provider.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  let messagesStr;
  try {
    const fetched = await interaction.channel.messages.fetch({ limit: count });
    messagesStr = fetched
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(m => `${m.author.username}: ${m.content}`)
      .filter(s => s.trim().length > 0)
      .join("\n");
  } catch (err) {
    await interaction.editReply({ content: `❌ Failed to fetch messages: \`${err?.message?.slice(0, 100)}\`` });
    return;
  }

  if (!messagesStr) {
    await interaction.editReply({ content: "❌ No messages to summarize." });
    return;
  }

  let summary;
  try {
    summary = await callAiLlm({
      prompt:    `Summarize this conversation concisely in 3-5 bullet points:\n\n${messagesStr}`,
      provider:  resolved.provider,
      apiKey:    resolved.apiKey,
      ollamaUrl: resolved.ollamaUrl,
    });
  } catch (err) {
    await interaction.editReply({ content: `❌ AI request failed: \`${err?.message?.slice(0, 100)}\`` });
    return;
  }

  const display = summary.length > 4096 ? summary.slice(0, 4093) + "…" : summary;
  const embed = new EmbedBuilder()
    .setTitle("📋 Conversation Summary")
    .setDescription(display)
    .setColor(0x5865f2)
    .setFooter({ text: `Last ${count} messages` });

  await interaction.editReply({ embeds: [embed] });
}

// ── /ai translate ─────────────────────────────────────────────────────────────

async function handleTranslate(interaction) {
  const text     = sanitizeString(interaction.options.getString("text", true));
  const language = interaction.options.getString("language", true);
  const guildId  = interaction.guildId;
  const userId   = interaction.user.id;

  const v = validateTranslateText(text);
  if (!v.ok) {
    return interaction.reply({ content: `❌ ${v.error}`, ephemeral: true });
  }

  let resolved;
  try {
    resolved = await resolveAiKey(guildId, userId);
  } catch {
    resolved = { provider: null, apiKey: null, ollamaUrl: null };
  }

  if (!resolved.provider) {
    return interaction.reply({ content: "No AI provider configured.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  let translation;
  try {
    translation = await callAiLlm({
      prompt:    `Translate the following text to ${language}. Return ONLY the translation, no explanation:\n\n${text}`,
      provider:  resolved.provider,
      apiKey:    resolved.apiKey,
      ollamaUrl: resolved.ollamaUrl,
    });
  } catch (err) {
    await interaction.editReply({ content: `❌ AI request failed: \`${err?.message?.slice(0, 100)}\`` });
    return;
  }

  const cap = s => s.length > 1024 ? s.slice(0, 1021) + "…" : s;
  const embed = new EmbedBuilder()
    .setTitle(`🌍 Translation to ${language}`)
    .addFields(
      { name: "Original",    value: cap(text),        inline: false },
      { name: "Translation", value: cap(translation), inline: false },
    )
    .setColor(0x00b4d8);

  await interaction.editReply({ embeds: [embed] });
}

// ── /ai moderate ──────────────────────────────────────────────────────────────

async function handleModerate(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ content: "❌ You need the **Manage Messages** permission.", ephemeral: true });
  }

  const messageId  = interaction.options.getString("message_id");
  const directText = interaction.options.getString("text");

  if (!messageId && !directText) {
    return interaction.reply({ content: "❌ Provide a `message_id` or `text` to moderate.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  let textToAnalyze = directText ?? "";
  if (messageId) {
    try {
      const msg = await interaction.channel.messages.fetch(messageId);
      textToAnalyze = msg.content || directText || "";
    } catch {
      await interaction.editReply({ content: "❌ Message not found." });
      return;
    }
  }

  if (!textToAnalyze) {
    await interaction.editReply({ content: "❌ No text to analyze." });
    return;
  }

  const guildId = interaction.guildId;
  const userId  = interaction.user.id;
  let resolved;
  try {
    resolved = await resolveAiKey(guildId, userId);
  } catch {
    resolved = { provider: null, apiKey: null, ollamaUrl: null };
  }

  let result = null;
  if (resolved.provider) {
    try {
      const raw = await callAiLlm({
        prompt: `Analyze this message for policy violations (spam, hate speech, harassment, NSFW). Respond in JSON: { score: 0-10, flags: [], verdict: 'safe|warning|remove' }:\n\n${textToAnalyze}`,
        provider:  resolved.provider,
        apiKey:    resolved.apiKey,
        ollamaUrl: resolved.ollamaUrl,
      });
      const match = raw?.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
    } catch { /* fall through to keyword check */ }
  }

  if (!result) result = moderateWithKeywords(textToAnalyze);

  const verdictColors = { safe: 0x00b97d, warning: 0xffa500, remove: 0xe04436 };
  const verdictEmoji  = { safe: "✅", warning: "⚠️", remove: "🚫" };
  const verdict = result.verdict ?? "safe";

  const embed = new EmbedBuilder()
    .setTitle(`${verdictEmoji[verdict] ?? "🔍"} Moderation Result`)
    .addFields(
      { name: "Verdict", value: verdict.toUpperCase(), inline: true },
      { name: "Score",   value: String(result.score ?? 0), inline: true },
      { name: "Flags",   value: result.flags?.length ? result.flags.join(", ") : "none", inline: true },
      { name: "Text",    value: textToAnalyze.length > 500 ? textToAnalyze.slice(0, 497) + "…" : textToAnalyze, inline: false },
    )
    .setColor(verdictColors[verdict] ?? 0x5865f2);

  await interaction.editReply({ embeds: [embed] });
}

// ── /ai persona set / clear ───────────────────────────────────────────────────

async function handlePersonaSet(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "❌ You need the **Manage Server** permission.", ephemeral: true });
  }

  const description = sanitizeString(interaction.options.getString("description", true));
  const v = validatePersonaDesc(description);
  if (!v.ok) {
    return interaction.reply({ content: `❌ ${v.error}`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  await setGuildAiPersona(interaction.guildId, description);

  const embed = new EmbedBuilder()
    .setTitle("✅ AI Persona Set")
    .setDescription(description)
    .setColor(0x5865f2)
    .setFooter({ text: "This persona is prepended to all /ai chat calls in this server." });

  await interaction.editReply({ embeds: [embed] });
}

async function handlePersonaClear(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "❌ You need the **Manage Server** permission.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  await clearGuildAiPersona(interaction.guildId);
  await interaction.editReply({ content: "✅ AI persona cleared." });
}

// ── /ai token link ────────────────────────────────────────────────────────────

async function handleTokenLink(interaction) {
  const provider  = interaction.options.getString("provider", true);
  const isOllama  = provider === "ollama";
  const provName  = provider[0].toUpperCase() + provider.slice(1);

  const modal = new ModalBuilder()
    .setCustomId(`ai_link_${interaction.guildId}_${interaction.user.id}_${provider}`)
    .setTitle(isOllama ? "Set Ollama URL" : `Link ${provName} API Key`);

  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(isOllama ? "Ollama URL (e.g. http://localhost:11434)" : "API Key")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(isOllama ? "http://your-server:11434" : "sk-...")
    .setRequired(true)
    .setMinLength(isOllama ? 7 : 10)
    .setMaxLength(isOllama ? 200 : 250);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── /ai token unlink ──────────────────────────────────────────────────────────

async function handleTokenUnlink(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const provider = interaction.options.getString("provider", true);

  try {
    await clearUserAiKey(interaction.guildId, interaction.user.id, provider);
  } catch (err) {
    await interaction.editReply({ content: `❌ Failed to remove key: \`${err?.message}\`` });
    return;
  }

  await interaction.editReply({ content: `✅ ${provider} key unlinked.` });
}

// ── /ai help ──────────────────────────────────────────────────────────────────

async function handleHelp(interaction) {
  await interaction.deferReply({ ephemeral: true });

  let cfg      = { provider: "none", ollamaUrl: null };
  let resolved = { provider: null, apiKey: null, ollamaUrl: null };

  try { cfg      = await getGuildAiConfig(interaction.guildId); } catch { /* ignore */ }
  try { resolved = await resolveAiKey(interaction.guildId, interaction.user.id); } catch { /* ignore */ }

  const hasUserKey = resolved.provider !== null && resolved.apiKey !== null;

  const embed = new EmbedBuilder()
    .setTitle("🤖 AI Features")
    .setColor(0x5865f2)
    .addFields(
      {
        name:   "Guild Provider",
        value:  cfg.provider === "none" ? "❌ Not configured" : `✅ \`${cfg.provider}\``,
        inline: true,
      },
      {
        name:   "Your Linked Key",
        value:  hasUserKey ? `✅ \`${resolved.provider}\`` : "❌ None",
        inline: true,
      },
      {
        name:  "Commands",
        value: [
          "`/ai chat [message]` — Chat with the AI",
          "`/ai image [prompt]` — Generate an image (OpenAI only)",
          "`/ai token link` — Link your personal API key",
          "`/ai token unlink` — Remove your linked key",
          "`/ai set-provider` — (Admin) Set guild default provider",
          "`/ai help` — Show this help message",
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "Your API key is encrypted and never shared." });

  await interaction.editReply({ embeds: [embed] });
}

// ── /ai stats ─────────────────────────────────────────────────────────────────
import { getPool } from "../utils/storage_pg.js";

async function handleStats(interaction) {
  await interaction.deferReply({ ephemeral: false });
  const guildId = interaction.guildId;

  let guildConfig = { provider: "none" };
  try { guildConfig = await getGuildAiConfig(guildId); } catch {}

  // Count unique users who have linked API keys in this guild
  let linkedUsersCount = 0;
  try {
    const res = await getPool().query("SELECT data FROM guild_settings WHERE guild_id=$1", [guildId]);
    const data = res.rows[0]?.data ?? {};
    const tokens = data.ai_tokens ?? {};
    linkedUsersCount = Object.keys(tokens).length;
  } catch {}

  const embed = new EmbedBuilder()
    .setTitle("📊 AI Usage Stats")
    .setColor(0x5865F2)
    .addFields(
      { name: "Guild Provider", value: guildConfig.provider || "none", inline: true },
      { name: "Guild Model", value: guildConfig.model || "default", inline: true },
      { name: "Users with Linked Keys", value: String(linkedUsersCount), inline: true },
      { name: "Persona Active", value: guildConfig.persona ? "✅ Yes" : "❌ No", inline: true },
    )
    .setFooter({ text: "Use /ai set-provider to configure AI for this server" });

  await interaction.editReply({ embeds: [embed] });
}

// ── AI modal handler (for /ai token link modal submissions) ───────────────────

export async function handleAiModal(interaction) {
  if (!interaction.customId?.startsWith("ai_link_")) return false;

  // customId: ai_link_{guildId}_{userId}_{provider}
  // Discord snowflakes are numeric — no underscores — so positional parsing is safe.
  const parts = interaction.customId.split("_");
  if (parts.length < 5) return false;

  const provider = parts[4];
  const userId   = parts[3];
  const guildId  = parts[2];

  await interaction.deferReply({ ephemeral: true });

  const value = interaction.fields.getTextInputValue("value")?.trim();
  if (!value) {
    await interaction.editReply({ content: "❌ No value provided." });
    return true;
  }

  const isOllama = provider === "ollama";

  const check = await validateProviderKey(
    provider,
    isOllama ? null : value,
    isOllama ? value : null
  );

  if (!check.ok) {
    const errMap = {
      invalid_api_key:    "❌ Invalid API key — double-check it and try again.",
      api_key_required:   "❌ API key is required.",
      ollama_unreachable: "❌ Ollama URL unreachable — ensure the server is running and accessible.",
    };
    const msg = errMap[check.error] ?? `❌ Validation failed: \`${check.error}\``;
    await interaction.editReply({ content: msg });
    return true;
  }

  try {
    await setUserAiKey(guildId, userId, provider, value);
  } catch (err) {
    await interaction.editReply({ content: `❌ Failed to save: \`${err?.message}\`` });
    return true;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00b97d)
        .setTitle("✅ Key Linked Successfully")
        .setDescription(
          isOllama
            ? "Your Ollama URL was validated and saved. Use `/ai chat` to start chatting."
            : `Your **${provider}** API key was validated and securely stored.\nUse \`/ai chat\` to start chatting.`
        ),
    ],
  });
  return true;
}

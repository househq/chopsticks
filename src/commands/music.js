// src/commands/music.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  ChannelType
} from "discord.js";
import {
  ensureSessionAgent,
  getSessionAgent,
  releaseSession,
  sendAgentCommand,
  formatMusicError
} from "../music/service.js";
import { getMusicConfig, setDefaultMusicMode, updateMusicSettings } from "../music/config.js";
import { loadGuildData, saveGuildData } from "../utils/storage.js";
import { auditLog } from "../utils/audit.js";
import { handleInteractionError, handleSafeError, ErrorCategory } from "../utils/errorHandler.js";
import { getCache, setCache } from "../utils/redis.js";
import { checkRateLimit } from "../utils/ratelimit.js";
import { makeEmbed } from "../utils/discordOutput.js";
import { openAdvisorUiHandoff } from "./agents.js";

export const meta = {
  guildOnly: true,
  userPerms: [],
  category: "music"
};

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Voice-channel music (agent-backed, one session per voice channel)")
  .addSubcommand(s =>
    s
      .setName("play")
      .setDescription("Play or queue a track in your current voice channel")
      .addStringOption(o => o.setName("query").setDescription("Search or URL").setRequired(true))
  )
  .addSubcommand(s => s.setName("skip").setDescription("Skip current track"))
  .addSubcommand(s => s.setName("pause").setDescription("Pause playback"))
  .addSubcommand(s => s.setName("resume").setDescription("Resume playback"))
  .addSubcommand(s => s.setName("stop").setDescription("Stop playback"))
  .addSubcommand(s => s.setName("now").setDescription("Show current track"))
  .addSubcommand(s => s.setName("queue").setDescription("Show the queue for this voice channel"))
  .addSubcommand(s =>
    s
      .setName("remove")
      .setDescription("Remove a track from the queue")
      .addIntegerOption(o => o.setName("index").setDescription("1-based index").setRequired(true).setMinValue(1))
  )
  .addSubcommand(s =>
    s
      .setName("move")
      .setDescription("Move a track to a new position")
      .addIntegerOption(o => o.setName("from").setDescription("1-based index").setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName("to").setDescription("1-based index").setRequired(true).setMinValue(1))
  )
  .addSubcommand(s =>
    s
      .setName("swap")
      .setDescription("Swap two tracks in the queue")
      .addIntegerOption(o => o.setName("a").setDescription("1-based index").setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName("b").setDescription("1-based index").setRequired(true).setMinValue(1))
  )
  .addSubcommand(s => s.setName("shuffle").setDescription("Shuffle the queue"))
  .addSubcommand(s => s.setName("clear").setDescription("Clear the queue"))
  .addSubcommand(s =>
    s
      .setName("settings")
      .setDescription("View or update music settings (Manage Server)")
      .addStringOption(o =>
        o
          .setName("control_mode")
          .setDescription("Who can control the queue")
          .addChoices(
            { name: "owner", value: "owner" },
            { name: "voice", value: "voice" }
          )
      )
      .addStringOption(o =>
        o
          .setName("default_mode")
          .setDescription("Default session mode")
          .addChoices(
            { name: "open", value: "open" },
            { name: "dj", value: "dj" }
          )
      )
      .addIntegerOption(o =>
        o.setName("default_volume").setDescription("Default volume (0-150)").setMinValue(0).setMaxValue(150)
      )
      .addIntegerOption(o =>
        o.setName("max_queue").setDescription("Max queue length").setMinValue(1).setMaxValue(10000)
      )
      .addIntegerOption(o =>
        o.setName("max_track_minutes").setDescription("Max track length (minutes)").setMinValue(1).setMaxValue(1440)
      )
      .addIntegerOption(o =>
        o.setName("max_queue_minutes").setDescription("Max total queue length (minutes)").setMinValue(1).setMaxValue(1440)
      )
      .addStringOption(o =>
        o.setName("search_providers").setDescription("Comma list (e.g., scsearch,ytmsearch,ytsearch)")
      )
      .addStringOption(o =>
        o.setName("fallback_providers").setDescription("Comma list for playback fallback (e.g., scsearch)")
      )
  )
  .addSubcommand(s =>
    s
      .setName("mode")
      .setDescription("Set session mode (open or DJ)")
      .addStringOption(o =>
        o
          .setName("mode")
          .setDescription("open = anyone can control, dj = owner-only")
          .setRequired(true)
          .addChoices(
            { name: "open", value: "open" },
            { name: "dj", value: "dj" }
          )
      )
  )
  .addSubcommand(s =>
    s
      .setName("default")
      .setDescription("Set default mode for this server (requires Manage Server)")
      .addStringOption(o =>
        o
          .setName("mode")
          .setDescription("Default mode for new sessions")
          .setRequired(true)
          .addChoices(
            { name: "open", value: "open" },
            { name: "dj", value: "dj" }
          )
      )
  )
  .addSubcommand(s =>
    s
      .setName("volume")
      .setDescription("Set volume (0-150)")
      .addIntegerOption(o =>
        o.setName("level").setDescription("0-150").setRequired(true).setMinValue(0).setMaxValue(150)
      )
  )
  .addSubcommand(s => s.setName("status").setDescription("Show session status"));
  // Note: additional subcommand groups appended below.

// "Audio Drops" (opt-in): show a play panel when users upload audio files in configured channels.
data.addSubcommandGroup(g =>
  g
    .setName("drops")
    .setDescription("Configure audio attachment drop-to-play panels (Manage Server)")
    .addSubcommand(s =>
      s
        .setName("enable")
        .setDescription("Enable audio drops in a text channel (default: this channel)")
        .addChannelOption(o =>
          o
            .setName("channel")
            .setDescription("Text channel to enable")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand(s =>
      s
        .setName("disable")
        .setDescription("Disable audio drops in a text channel (default: this channel)")
        .addChannelOption(o =>
          o
            .setName("channel")
            .setDescription("Text channel to disable")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addBooleanOption(o =>
          o
            .setName("all")
            .setDescription("Disable audio drops in all channels")
            .setRequired(false)
        )
    )
    .addSubcommand(s => s.setName("status").setDescription("Show audio drops status for this server"))
);

function requireVoice(interaction) {
  const member = interaction.member;
  const vc = member?.voice?.channel ?? null;
  if (!vc) return { ok: false, vc: null };
  return { ok: true, vc };
}

async function resolveMemberVoiceId(interaction) {
  const direct = interaction.member?.voice?.channelId ?? null;
  if (direct) return direct;
  const guild = interaction.guild;
  if (!guild) return null;
  try {
    const member = await guild.members.fetch(interaction.user.id);
    return member?.voice?.channelId ?? null;
  } catch {
    return null;
  }
}

function buildRequester(user) {
  return {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar
  };
}

async function safeDefer(interaction, ephemeral = true) {
  try {
    const options = ephemeral ? { flags: MessageFlags.Ephemeral } : {};
    await interaction.deferReply(options);
    return { ok: true };
  } catch (err) {
    const code = err?.code;
    if (code === 10062) return { ok: false, reason: "unknown-interaction" };
    throw err;
  }
}

function safeDeferEphemeral(interaction) {
  return safeDefer(interaction, true);
}

// makeEmbed removed - using imported version

function buildTrackEmbed(action, track) {
  const title = action === "playing" ? "Now Playing" : "Queued";
  const fields = [];
  if (track?.author) fields.push({ name: "Artist", value: track.author, inline: true });
  const dur = track?.duration ?? track?.length;
  if (dur) fields.push({ name: "Duration", value: formatDuration(dur), inline: true });
  // Null-safe requester handling
  const requester = track?.requester;
  if (requester && (requester.username || requester.displayName || requester.tag)) {
    const name = requester.username || requester.displayName || requester.tag;
    fields.push({ name: "Requested by", value: name, inline: true });
  }
  return makeEmbed(
    title,
    track?.title ?? "Unknown title",
    fields,
    track?.uri ?? null,
    track?.thumbnail ?? null
  );
}

const QUEUE_PAGE_SIZE = 10;
const QUEUE_COLOR = 0x5865F2;
const SEARCH_TTL_MS = 10 * 60_000;
const SEARCH_TTL_SEC = 10 * 60;
const AUDIO_DROP_TTL_SEC = 15 * 60;
const AUDIO_DROP_MAX_MB = Math.max(1, Math.trunc(Number(process.env.MUSIC_DROP_MAX_MB ?? 25)));
const AUDIO_DROP_MAX_BYTES = AUDIO_DROP_MAX_MB * 1024 * 1024;
const AUDIO_DROP_ALLOWED_EXT = new Set(["mp3", "wav", "ogg", "m4a", "flac", "opus", "webm", "mp4"]);
// Note: searchCache is now backed by Redis for persistence across restarts
// const searchCache = new Map(); (Legacy in-memory cache removed)

// Anti-spam: Track button interactions to prevent double-processing
const buttonProcessing = new Map(); // interactionId -> timestamp
const BUTTON_DEBOUNCE_MS = 2000; // 2 seconds

// Per-user cooldowns for buttons
const userButtonCooldowns = new Map(); // userId:buttonType -> timestamp
const BUTTON_COOLDOWN_MS = 1000; // 1 second between same button presses

// Cleanup old entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  // Clean button processing tracker
  for (const [id, timestamp] of buttonProcessing.entries()) {
    if (now - timestamp > BUTTON_DEBOUNCE_MS) {
      buttonProcessing.delete(id);
    }
  }
  // Clean user cooldowns
  for (const [key, timestamp] of userButtonCooldowns.entries()) {
    if (now - timestamp > BUTTON_COOLDOWN_MS * 2) {
      userButtonCooldowns.delete(key);
    }
  }
}, 30_000).unref?.();

// Periodic cleanup for search cache is handled by Redis TTL now

function randomKey() {
  // Use crypto random for better collision resistance
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 11);
  const random2 = Math.random().toString(36).slice(2, 11);
  return `${timestamp}${random}${random2}`;
}

function humanBytes(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let n = b;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const fixed = i === 0 ? String(Math.trunc(n)) : n.toFixed(n >= 10 ? 1 : 2);
  return `${fixed} ${units[i]}`;
}

function getExt(name) {
  const s = String(name ?? "").toLowerCase();
  const idx = s.lastIndexOf(".");
  if (idx < 0) return "";
  return s.slice(idx + 1);
}

function isSupportedAudioAttachment(att) {
  if (!att) return { ok: false, reason: "missing" };
  const ct = String(att.contentType ?? "").toLowerCase();
  const name = String(att.name ?? "");
  const ext = getExt(name);
  const isAudioCt = ct.startsWith("audio/");
  const isAllowedExt = ext && AUDIO_DROP_ALLOWED_EXT.has(ext);
  if (!isAudioCt && !isAllowedExt) return { ok: false, reason: "unsupported" };
  const size = Number(att.size ?? 0);
  if (Number.isFinite(size) && size > AUDIO_DROP_MAX_BYTES) return { ok: false, reason: "too-large" };
  const url = String(att.url ?? "");
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "bad-url" };
  return { ok: true };
}

async function setAudioDropCache(entry) {
  const key = randomKey();
  const ok = await setCache(`audiodrop:${key}`, { ...entry, createdAt: Date.now() }, AUDIO_DROP_TTL_SEC);
  if (!ok) console.warn("[music:drops] Redis cache failed; audio drop panel may not work.");
  return key;
}

async function getAudioDropCache(key) {
  if (!key) return null;
  return getCache(`audiodrop:${key}`);
}

async function setAudioDropSelection(key, userId, index) {
  const idx = Math.max(0, Math.trunc(Number(index) || 0));
  return setCache(`audiodropSel:${key}:${userId}`, { idx }, AUDIO_DROP_TTL_SEC);
}

async function getAudioDropSelection(key, userId) {
  const v = await getCache(`audiodropSel:${key}:${userId}`);
  const idx = Math.max(0, Math.trunc(Number(v?.idx) || 0));
  return idx;
}

function buildAudioDropPanel(message, dropKey, uploaderId, attachments) {
  const expiresAt = Math.floor((Date.now() + AUDIO_DROP_TTL_SEC * 1000) / 1000);
  const lines = attachments.slice(0, 8).map((a, i) => {
    const label = a.name ? a.name : `Attachment ${i + 1}`;
    const size = Number.isFinite(a.size) ? ` (${humanBytes(a.size)})` : "";
    return `• ${label}${size}`;
  });
  const fields = [
    { name: "Uploaded by", value: `<@${uploaderId}>`, inline: true },
    { name: "Files", value: lines.length ? lines.join("\n") : "(none)", inline: false },
    { name: "Expires", value: `<t:${expiresAt}:R>`, inline: true }
  ];

  const embed = makeEmbed(
    "Audio Drop",
    "Use the buttons below to play an uploaded audio file in voice.",
    fields,
    null,
    null,
    QUEUE_COLOR
  );

  const base = `audiodrop:${dropKey}:${uploaderId}`;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${base}:play_my_vc`).setLabel("Play In My VC").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${base}:choose_file`).setLabel("Choose File").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${base}:pick_vc`).setLabel("Pick VC").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${base}:deploy_ui`).setLabel("Deploy Agents").setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${base}:dismiss`).setLabel("Dismiss").setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2] };
}

export async function maybeHandleAudioDropMessage(message, guildData) {
  try {
    if (!message?.guildId) return;
    if (!message?.channelId) return;
    const enabled = guildData?.music?.drops?.channelIds;
    if (!Array.isArray(enabled) || enabled.length === 0) return;
    if (!enabled.includes(message.channelId)) return;
    if (!message.attachments?.size) return;

    // Throttle panels to avoid spam in busy drop channels.
    const rl = await checkRateLimit(`musicdrops:${message.guildId}:${message.channelId}:${message.author.id}`, 2, 15);
    if (!rl.ok) return;

    const atts = Array.from(message.attachments.values());
    const supported = [];
    let sawAudioLike = false;
    let sawTooLarge = false;
    for (const a of atts) {
      const ct = String(a?.contentType ?? "").toLowerCase();
      const ext = getExt(a?.name ?? "");
      if (ct.startsWith("audio/") || (ext && AUDIO_DROP_ALLOWED_EXT.has(ext))) sawAudioLike = true;

      const ok = isSupportedAudioAttachment(a);
      if (!ok.ok) {
        if (ok.reason === "too-large") sawTooLarge = true;
        continue;
      }
      supported.push({
        url: a.url,
        name: String(a.name ?? ""),
        size: Number(a.size ?? 0),
        contentType: String(a.contentType ?? "")
      });
      if (supported.length >= 12) break;
    }
    if (!supported.length) {
      if (sawAudioLike && sawTooLarge) {
        await message.reply({
          embeds: [makeEmbed("Audio Drop", `That file is too large to play here.\nMax upload size: **${AUDIO_DROP_MAX_MB} MB**.`, [], null, null, 0xFF0000)]
        }).catch(() => {});
      }
      return;
    }

    const dropKey = await setAudioDropCache({
      guildId: message.guildId,
      textChannelId: message.channelId,
      messageId: message.id,
      uploaderId: message.author.id,
      attachments: supported
    });

    const payload = buildAudioDropPanel(message, dropKey, message.author.id, supported);
    await message.reply(payload).catch(() => {});
  } catch (err) {
    console.error("[music:drops] message handler failed:", err?.stack ?? err?.message ?? err);
  }
}

async function setSearchCache(entry) {
  const key = randomKey();
  // Store in Redis with TTL
  const ok = await setCache(`search:${key}`, { ...entry, createdAt: Date.now() }, SEARCH_TTL_SEC);
  if (!ok) {
    console.warn("[music] Redis cache failed, search selection may not persist.");
  }
  return key;
}

async function getSearchCache(key) {
  const entry = await getCache(`search:${key}`);
  if (!entry) return null;
  // TTL is handled by Redis, so if we got it, it's valid
  return entry;
}

function truncate(text, max) {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  if (max <= 3) return s.slice(0, Math.max(0, max));
  return s.slice(0, Math.max(0, max - 3)) + "...";
}

function buildSearchMenu(tracks, cacheKey) {
  const options = tracks.slice(0, 25).map((t, idx) => {
    const title = truncate(t?.title ?? "Unknown title", 100);
    const author = truncate(t?.author ?? "", 100);
    const dur = t?.duration ?? t?.length;
    const duration = dur ? ` | ${formatDuration(dur)}` : "";
    return {
      label: title,
      value: String(idx),
      description: truncate(`${author}${duration}`, 100)
    };
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`musicsearch:${cacheKey}`)
    .setPlaceholder("Choose a track to play")
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

function formatDuration(ms) {
  const total = Number(ms);
  if (!Number.isFinite(total) || total <= 0) return "0:00";
  const s = Math.floor(total / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function buildQueueEmbed(result, page, pageSize, actionNote) {
  const current = result?.current ?? null;
  const tracks = Array.isArray(result?.tracks) ? result.tracks : [];
  const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const end = Math.min(tracks.length, start + pageSize);
  const fields = [];

  if (current?.title) {
    let line = `[${current.title}](${current.uri})`;
    if (current.author) line += ` - ${current.author}`;
    const curDur = current?.duration ?? current?.length;
    if (curDur) line += ` | ${formatDuration(curDur)}`;
    if (current.requester?.username) line += ` | requested by ${current.requester.username}`;
    fields.push({ name: "Now Playing", value: line, inline: false });
  } else {
    fields.push({ name: "Now Playing", value: "Nothing playing in this channel.", inline: false });
  }

  if (tracks.length === 0) {
    fields.push({ name: "Up Next", value: "(empty)", inline: false });
  } else {
    const lines = [];
    for (let i = start; i < end; i++) {
      const t = tracks[i];
      const title = t?.title ?? "Unknown title";
      const durMs = t?.duration ?? t?.length;
      const dur = durMs ? ` | ${formatDuration(durMs)}` : "";
      lines.push(`${i + 1}. [${title}](${t?.uri ?? ""})${dur}`);
    }
    fields.push({ name: `Up Next (${start + 1}-${end} of ${tracks.length})`, value: lines.join("\n"), inline: false });
  }

  const footer = {
    text: `Page ${safePage + 1}/${totalPages}${actionNote ? ` | ${actionNote}` : ""}`
  };

  return { embed: makeEmbed("Music Queue", "Interactive queue controls below.", fields, null, null, QUEUE_COLOR, footer), page: safePage, totalPages };
}

function buildQueueComponents(voiceChannelId, page, totalPages) {
  const base = `musicq:${voiceChannelId}:${page}`;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${base}:prev`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${base}:next`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`${base}:refresh`)
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${base}:now`).setLabel("Now").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${base}:pause`).setLabel("Pause").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${base}:resume`).setLabel("Resume").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${base}:skip`).setLabel("Skip").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${base}:stop`).setLabel("Stop").setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

function buildSettingsEmbed(config, updated) {
  const fields = [
    { name: "Control Mode", value: config?.controlMode ?? "owner", inline: true },
    { name: "Default Mode", value: config?.defaultMode ?? "open", inline: true },
    { name: "Default Volume", value: String(config?.defaultVolume ?? 100), inline: true },
    { name: "Max Queue", value: String(config?.limits?.maxQueue ?? 100), inline: true },
    { name: "Max Track (min)", value: String(config?.limits?.maxTrackMinutes ?? 20), inline: true },
    { name: "Max Queue (min)", value: String(config?.limits?.maxQueueMinutes ?? 120), inline: true },
    { name: "Search Providers", value: (config?.searchProviders?.join(", ") || "default"), inline: false },
    { name: "Fallback Providers", value: (config?.fallbackProviders?.join(", ") || "default"), inline: false }
  ];
  return makeEmbed("Music Settings", updated ? "Settings updated." : "Current settings.", fields, null, null, QUEUE_COLOR);
}

function formatDisconnectField(result) {
  const at = Number(result?.disconnectAt);
  const ms = Number(result?.disconnectInMs);

  if (Number.isFinite(at) && at > 0) {
    return {
      name: "Disconnect",
      value: `<t:${Math.trunc(at)}:R>`,
      inline: true
    };
  }

  if (Number.isFinite(ms) && ms > 0) {
    const at2 = Math.floor((Date.now() + ms) / 1000);
    return {
      name: "Disconnect",
      value: `<t:${at2}:R>`,
      inline: true
    };
  }

  return null;
}

function actionLabel(sub, action) {
  const a = String(action ?? "");

  if (sub === "pause") {
    if (a === "paused") return "Paused";
    if (a === "already-paused") return "Already paused";
    if (a === "nothing-playing") return "Nothing playing";
    if (a === "stopping") return "Stopping";
    return `Pause: ${a || "unknown"}`;
  }

  if (sub === "resume") {
    if (a === "resumed") return "Resumed";
    if (a === "already-playing") return "Already playing";
    if (a === "nothing-playing") return "Nothing playing";
    if (a === "stopping") return "Stopping";
    return `Resume: ${a || "unknown"}`;
  }

  if (sub === "skip") {
    if (a === "skipped") return "Skipped";
    if (a === "stopped") return "Stopped";
    if (a === "nothing-to-skip") return "Nothing to skip";
    if (a === "stopping") return "Stopping";
    return `Skip: ${a || "unknown"}`;
  }

  if (sub === "stop") {
    if (a === "stopped") return "Stopped";
    if (a === "stopping") return "Stopping";
    return `Stop: ${a || "unknown"}`;
  }

  return a || "Done";
}

async function sendAudioDropEphemeral(interaction, payload, { preferFollowUp = false } = {}) {
  const body = { ...payload, ephemeral: true };
  if (preferFollowUp) {
    return interaction.followUp(body).catch(() => {});
  }
  if (interaction.deferred || interaction.replied) {
    // If we deferred a reply, prefer editing the original ephemeral reply.
    if (interaction.deferred) return interaction.editReply(payload).catch(() => {});
    return interaction.followUp(body).catch(() => {});
  }
  return interaction.reply(body).catch(() => {});
}

function buildAudioDropDeployRow(dropKey, uploaderId) {
  const base = `audiodrop:${dropKey}:${uploaderId}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${base}:deploy_ui`).setLabel("Deploy Agents").setStyle(ButtonStyle.Secondary)
  );
}

async function playAudioDropToVc(interaction, dropKey, uploaderId, voiceChannelId, { preferFollowUp = false } = {}) {
  const state = await getAudioDropCache(dropKey);
  if (!state) {
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Audio Drop", "This drop panel expired. Upload the file again.", [], null, null, 0xFF0000)]
    }, { preferFollowUp });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Audio Drop", "This action requires a server context.", [], null, null, 0xFF0000)]
    }, { preferFollowUp });
    return;
  }

  const ch = guild.channels.cache.get(voiceChannelId) ?? null;
  if (!ch || (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice)) {
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Audio Drop", "That voice channel is no longer available.", [], null, null, 0xFF0000)]
    }, { preferFollowUp });
    return;
  }

  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const botPerms = me ? ch.permissionsFor(me) : null;
  if (!botPerms?.has?.(PermissionsBitField.Flags.Connect)) {
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Audio Drop", `I can't connect to <#${ch.id}>. Check channel permissions.`, [], null, null, 0xFF0000)]
    }, { preferFollowUp });
    return;
  }

  const attachments = Array.isArray(state.attachments) ? state.attachments : [];
  if (!attachments.length) {
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Audio Drop", "No files found for this panel.", [], null, null, 0xFF0000)]
    }, { preferFollowUp });
    return;
  }

  const selIdxRaw = await getAudioDropSelection(dropKey, interaction.user.id);
  const selIdx = Math.max(0, Math.min(attachments.length - 1, selIdxRaw));
  const att = attachments[selIdx];
  const url = String(att?.url ?? "");
  if (!/^https?:\/\//i.test(url)) {
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Audio Drop", "That file URL is invalid.", [], null, null, 0xFF0000)]
    }, { preferFollowUp });
    return;
  }

  const guildId = guild.id;
  let config = null;
  try {
    config = await getMusicConfig(guildId);
  } catch {}

  const alloc = await ensureSessionAgent(guildId, ch.id, {
    textChannelId: state.textChannelId ?? interaction.channelId,
    ownerUserId: interaction.user.id
  });
  if (!alloc.ok) {
    const msg = formatMusicError(alloc.reason);
    const extra = (alloc.reason === "no-agents-in-guild" || alloc.reason === "no-free-agents")
      ? [buildAudioDropDeployRow(dropKey, uploaderId)]
      : [];
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Music Error", msg, [], null, null, 0xFF0000)],
      components: extra
    }, { preferFollowUp });
    return;
  }

  try {
    const result = await sendAgentCommand(alloc.agent, "play", {
      guildId,
      voiceChannelId: ch.id,
      textChannelId: state.textChannelId ?? interaction.channelId,
      ownerUserId: interaction.user.id,
      actorUserId: interaction.user.id,
      query: url,
      defaultMode: config?.defaultMode,
      defaultVolume: config?.defaultVolume,
      limits: config?.limits,
      controlMode: config?.controlMode,
      searchProviders: config?.searchProviders,
      fallbackProviders: config?.fallbackProviders,
      requester: buildRequester(interaction.user)
    });

    const playedTrack = result?.track ?? { title: att?.name || "Audio file", uri: url };
    const action = String(result?.action ?? "queued");
    await sendAudioDropEphemeral(interaction, {
      embeds: [buildTrackEmbed(action, playedTrack)]
    }, { preferFollowUp });
  } catch (err) {
    const msg = formatMusicError(err);
    await sendAudioDropEphemeral(interaction, {
      embeds: [makeEmbed("Music Error", msg, [], null, null, 0xFF0000)]
    }, { preferFollowUp });
  }
}

export async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === "drops") {
    const perms = interaction.memberPermissions;
    if (!perms?.has?.(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Music", "Manage Server permission required.")]
      });
      return;
    }

    const data = await loadGuildData(guildId);
    data.music ??= {};
    data.music.drops ??= { channelIds: [] };
    if (!Array.isArray(data.music.drops.channelIds)) data.music.drops.channelIds = [];

    const maxMb = Math.max(1, Math.trunc(Number(process.env.MUSIC_DROP_MAX_MB ?? 25)));

    if (sub === "status") {
      const enabled = data.music.drops.channelIds;
      const fields = [
        { name: "Enabled Channels", value: enabled.length ? enabled.map(id => `<#${id}>`).join(", ") : "(none)", inline: false },
        { name: "Max Upload Size", value: `${maxMb} MB`, inline: true }
      ];
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Audio Drops", "When a user uploads an audio file in an enabled channel, Chopsticks posts a play panel.", fields, null, null, QUEUE_COLOR)]
      });
      return;
    }

    if (sub === "enable") {
      const ch = interaction.options.getChannel("channel") ?? interaction.channel;
      if (!ch?.id) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [makeEmbed("Audio Drops", "Choose a text channel.")]
        });
        return;
      }
      if (!data.music.drops.channelIds.includes(ch.id)) data.music.drops.channelIds.push(ch.id);
      await saveGuildData(guildId, data);

      await auditLog({ guildId, userId, action: "music.drops.enable", details: { channelId: ch.id } });
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Audio Drops", `Enabled in <#${ch.id}>.\nUpload an audio file there to get a play panel.`, [
          { name: "Max Upload Size", value: `${maxMb} MB`, inline: true }
        ], null, null, QUEUE_COLOR)]
      });
      return;
    }

    if (sub === "disable") {
      const all = Boolean(interaction.options.getBoolean("all") ?? false);
      const ch = interaction.options.getChannel("channel") ?? interaction.channel;

      if (all) {
        data.music.drops.channelIds = [];
        await saveGuildData(guildId, data);
        await auditLog({ guildId, userId, action: "music.drops.disable_all", details: {} });
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [makeEmbed("Audio Drops", "Disabled in all channels.", [], null, null, QUEUE_COLOR)]
        });
        return;
      }

      if (!ch?.id) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [makeEmbed("Audio Drops", "Choose a text channel.")]
        });
        return;
      }

      data.music.drops.channelIds = data.music.drops.channelIds.filter(id => id !== ch.id);
      await saveGuildData(guildId, data);
      await auditLog({ guildId, userId, action: "music.drops.disable", details: { channelId: ch.id } });
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Audio Drops", `Disabled in <#${ch.id}>.`, [], null, null, QUEUE_COLOR)]
      });
      return;
    }

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [makeEmbed("Audio Drops", "Unknown action.", [], null, null, 0xFF0000)]
    });
    return;
  }

  if (sub === "default") {
    const perms = interaction.memberPermissions;
    if (!perms?.has?.(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Music", "Manage Server permission required.")]
      });
      return;
    }

    const mode = interaction.options.getString("mode", true);
    const res = await setDefaultMusicMode(guildId, mode);
    await auditLog({
      guildId,
      userId,
      action: "music.default.set",
      details: { mode: res.defaultMode }
    });
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [makeEmbed("Music", `Default mode set to **${res.defaultMode}**.`)]
    });
    return;
  }

  if (sub === "settings") {
    const perms = interaction.memberPermissions;
    if (!perms?.has?.(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Music", "Manage Server permission required.")]
      });
      return;
    }

    const patch = {};
    const limits = {};
    const controlMode = interaction.options.getString("control_mode");
    const defaultMode = interaction.options.getString("default_mode");
    const defaultVolume = interaction.options.getInteger("default_volume");
    const maxQueue = interaction.options.getInteger("max_queue");
    const maxTrackMinutes = interaction.options.getInteger("max_track_minutes");
    const maxQueueMinutes = interaction.options.getInteger("max_queue_minutes");
    const searchProviders = interaction.options.getString("search_providers");
    const fallbackProviders = interaction.options.getString("fallback_providers");

    if (controlMode) patch.controlMode = controlMode;
    if (defaultMode) patch.defaultMode = defaultMode;
    if (Number.isFinite(defaultVolume)) patch.defaultVolume = defaultVolume;
    if (Number.isFinite(maxQueue)) limits.maxQueue = maxQueue;
    if (Number.isFinite(maxTrackMinutes)) limits.maxTrackMinutes = maxTrackMinutes;
    if (Number.isFinite(maxQueueMinutes)) limits.maxQueueMinutes = maxQueueMinutes;
    if (searchProviders) patch.searchProviders = searchProviders;
    if (fallbackProviders) patch.fallbackProviders = fallbackProviders;
    if (Object.keys(limits).length) patch.limits = limits;

    const hasPatch = Object.keys(patch).length > 0;
    const config = hasPatch
      ? await updateMusicSettings(guildId, patch)
      : await getMusicConfig(guildId);

    if (hasPatch) {
      await auditLog({
        guildId,
        userId,
        action: "music.settings.update",
        details: patch
      });
    }

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [buildSettingsEmbed(config, hasPatch)]
    });
    return;
  }

  const voiceCheck = requireVoice(interaction);
  if (!voiceCheck.ok) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [makeEmbed("Music", "Join a voice channel.")]
    });
    return;
  }
  const vc = voiceCheck.vc;

  try {
    const config = await getMusicConfig(guildId);
    if (sub === "play") {
      const ack = await safeDefer(interaction, false);
      if (!ack.ok) return;

      const query = interaction.options.getString("query", true);
      if (!String(query).trim()) {
        await interaction.editReply({
          embeds: [makeEmbed("Music", "Query is empty.")]
        });
        return;
      }
      if (String(query).length > 200) {
        await interaction.editReply({
          embeds: [makeEmbed("Music", "Query too long.")]
        });
        return;
      }

      await interaction.editReply({
        embeds: [makeEmbed("Music", `Searching for: **${query}**`)]
      });

      const alloc = await ensureSessionAgent(guildId, vc.id, {
        textChannelId: interaction.channelId,
        ownerUserId: userId
      });

      if (!alloc.ok) {
        console.warn("[music:play] alloc failed:", alloc.reason);
        const errorMsg = formatMusicError(alloc.reason);
        const embedFields = [];
        if (alloc.reason === "no-agents-in-guild" || alloc.reason === "no-free-agents") {
          // Silent failure preference - no hint
        }
        await interaction.editReply({
          embeds: [makeEmbed("Music Error", errorMsg, embedFields, null, null, 0xFF0000)] // Red color for error
        });
        return;
      }

      const isUrl = /^https?:\/\//i.test(String(query).trim());

      if (isUrl) {
        let result;
        try {
          result = await sendAgentCommand(alloc.agent, "play", {
            guildId,
            voiceChannelId: vc.id,
            textChannelId: interaction.channelId,
            ownerUserId: userId,
            actorUserId: userId,
            query,
            defaultMode: config.defaultMode,
            defaultVolume: config.defaultVolume,
            limits: config.limits,
            controlMode: config.controlMode,
            searchProviders: config.searchProviders,
            fallbackProviders: config.fallbackProviders,
            requester: buildRequester(interaction.user)
          });
        } catch (err) {
          console.error("[music:play] agent error:", err?.stack ?? err?.message ?? err);
          await interaction.editReply({
            embeds: [makeEmbed("Music Error", formatMusicError(err), [], null, null, 0xFF0000)]
          });
          return;
        }

        const track = result?.track ?? null;
        if (!track) {
          await interaction.editReply({
            embeds: [makeEmbed("Music", "No results found for that URL.")]
          });
          return;
        }

        const action = String(result?.action ?? "queued");
        await interaction.editReply({
          embeds: [buildTrackEmbed(action, track)]
        });
        return;
      }

      let searchRes;
      try {
        searchRes = await sendAgentCommand(alloc.agent, "search", {
          guildId,
          voiceChannelId: vc.id,
          textChannelId: interaction.channelId,
          ownerUserId: userId,
          actorUserId: userId,
          query,
          defaultMode: config.defaultMode,
          defaultVolume: config.defaultVolume,
          limits: config.limits,
          controlMode: config.controlMode,
          searchProviders: config.searchProviders,
          fallbackProviders: config.fallbackProviders,
          requester: buildRequester(interaction.user)
        });
      } catch (err) {
        console.error("[music:search] agent error:", err?.stack ?? err?.message ?? err);
        await interaction.editReply({
          embeds: [makeEmbed("Music Error", formatMusicError(err), [], null, null, 0xFF0000)]
        });
        return;
      }

      const tracks = Array.isArray(searchRes?.tracks) ? searchRes.tracks : [];
      if (!tracks.length) {
        await interaction.editReply({
          embeds: [makeEmbed("Music", "No results found for that query.")]
        });
        return;
      }

      const cacheKey = await setSearchCache({
        userId,
        guildId,
        voiceChannelId: vc.id,
        tracks
      });

      const queueAddLabel = "Voice channel";
      const controlLabel = config.defaultMode === "dj"
        ? "DJ only"
        : (config.controlMode === "voice" ? "Voice channel" : "Owner/Admin");
      const row = buildSearchMenu(tracks, cacheKey);
      await interaction.editReply({
        embeds: [makeEmbed("Music Search", `Select a result to play.`, [
          { name: "Results", value: `${tracks.length} found`, inline: true },
          { name: "Queue Add", value: queueAddLabel, inline: true },
          { name: "Skip/Stop", value: controlLabel, inline: true }
        ], null, null, QUEUE_COLOR)],
        components: [row]
      });
      return;
    }

    const sess = getSessionAgent(guildId, vc.id);
    if (!sess.ok) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Music", "Nothing playing in this channel.")]
      });
      return;
    }

    const opMap = {
      skip: "skip",
      pause: "pause",
      resume: "resume",
      stop: "stop",
      now: "status",
      queue: "queue",
      remove: "remove",
      move: "move",
      swap: "swap",
      shuffle: "shuffle",
      clear: "clear",
      status: "status",
      mode: "setMode",
      volume: "volume"
    };

    const op = opMap[sub];
    if (!op) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [makeEmbed("Music", "Unknown action.")]
      });
      return;
    }

    const ack = await safeDeferEphemeral(interaction);
    if (!ack.ok) return;

    const index =
      sub === "remove"
        ? Math.max(0, Math.trunc(interaction.options.getInteger("index", true)) - 1)
        : null;
    const moveFrom =
      sub === "move"
        ? Math.max(0, Math.trunc(interaction.options.getInteger("from", true)) - 1)
        : null;
    const moveTo =
      sub === "move"
        ? Math.max(0, Math.trunc(interaction.options.getInteger("to", true)) - 1)
        : null;
    const swapA =
      sub === "swap"
        ? Math.max(0, Math.trunc(interaction.options.getInteger("a", true)) - 1)
        : null;
    const swapB =
      sub === "swap"
        ? Math.max(0, Math.trunc(interaction.options.getInteger("b", true)) - 1)
        : null;

    let result;
    try {
      result = await sendAgentCommand(sess.agent, op, {
        guildId,
        voiceChannelId: vc.id,
        textChannelId: interaction.channelId,
        ownerUserId: userId,
        actorUserId: userId,
        mode: sub === "mode" ? interaction.options.getString("mode", true) : undefined,
        volume: sub === "volume" ? interaction.options.getInteger("level", true) : undefined,
        controlMode: config.controlMode,
        searchProviders: config.searchProviders,
        fallbackProviders: config.fallbackProviders,
        index,
        from: moveFrom,
        to: moveTo,
        a: swapA,
        b: swapB
      });
    } catch (err) {
      if (String(err?.message ?? err) === "no-session") releaseSession(guildId, vc.id);
      await interaction.editReply({
        embeds: [makeEmbed("Music", formatMusicError(err))]
      });
      return;
    }

    if (sub === "now") {
      const current = result?.current ?? null;
      if (!current) {
        await interaction.editReply({
          embeds: [makeEmbed("Now Playing", "Nothing playing in this channel.")]
        });
        return;
      }

      const fields = [];
      if (current.author) fields.push({ name: "Artist", value: current.author, inline: true });
      const curDur = current?.duration ?? current?.length;
      if (curDur) fields.push({ name: "Duration", value: formatDuration(curDur), inline: true });
      if (current.requester?.username) fields.push({ name: "Requested by", value: current.requester.username, inline: true });

      await interaction.editReply({
        embeds: [makeEmbed(
          "Now Playing",
          current.title ?? "Unknown title",
          fields,
          current.uri, // URL for the embed
          current.thumbnail // Thumbnail URL
        )]
      });
      return;
    }

    if (sub === "status") {
      const fields = [];
      fields.push({
        name: "Playing",
        value: result?.playing ? "Yes" : "No",
        inline: true
      });
      fields.push({
        name: "Paused",
        value: result?.paused ? "Yes" : "No",
        inline: true
      });
      fields.push({
        name: "Mode",
        value: String(result?.mode ?? "open"),
        inline: true
      });
      if (result?.ownerId) {
        fields.push({
          name: "Owner",
          value: `<@${result.ownerId}>`,
          inline: true
        });
      }
      if (Number.isFinite(result?.queueLength)) {
        fields.push({
          name: "Queue",
          value: String(result.queueLength),
          inline: true
        });
      }
      if (Number.isFinite(result?.volume)) {
        fields.push({
          name: "Volume",
          value: String(result.volume),
          inline: true
        });
      }

      await interaction.editReply({
        embeds: [makeEmbed("Status", "Session status.", fields)]
      });
      return;
    }

    if (sub === "mode") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", `Mode set to **${result?.mode ?? "open"}**.`)]
      });
      return;
    }

    if (sub === "volume") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", `Volume set to **${result?.volume ?? "?"}**.`)]
      });
      return;
    }

    if (sub === "queue") {
      const current = result?.current ?? null;
      const tracks = Array.isArray(result?.tracks) ? result.tracks : [];

      const built = buildQueueEmbed({ current, tracks }, 0, QUEUE_PAGE_SIZE, null);
      await interaction.editReply({
        embeds: [built.embed],
        components: buildQueueComponents(vc.id, built.page, built.totalPages)
      });
      return;
    }

    if (sub === "remove") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", "Removed track from queue.")]
      });
      return;
    }

    if (sub === "move") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", "Moved track in queue.")]
      });
      return;
    }

    if (sub === "swap") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", "Swapped tracks in queue.")]
      });
      return;
    }

    if (sub === "shuffle") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", "Queue shuffled.")]
      });
      return;
    }

    if (sub === "clear") {
      await interaction.editReply({
        embeds: [makeEmbed("Music", "Queue cleared.")]
      });
      return;
    }

    // stop/skip can return grace timer info
    if (sub === "stop" || sub === "skip" || sub === "pause" || sub === "resume") {
      const label = actionLabel(sub, result?.action);
      const fields = [];
      const disconnectField = formatDisconnectField(result);
      if (disconnectField) fields.push(disconnectField);

      // Warn about auto-disconnect after stop/grace
      if ((sub === "stop" || (sub === "skip" && String(result?.action) === "stopped")) && disconnectField) {
        fields.push({
          name: "Note",
          value: "Agent will leave in ~30 seconds unless a new song is queued.",
          inline: false
        });
      }

      if (sub === "stop") {
        // do NOT release session immediately; it is released on grace-expired event
        await interaction.editReply({
          embeds: [makeEmbed("Music", label, fields)]
        });
        return;
      }

      await interaction.editReply({
        embeds: [makeEmbed("Music", label, fields)]
      });
      return;
    }

    await interaction.editReply({
      embeds: [makeEmbed("Music", actionLabel(sub, result?.action))]
    });
  } catch (err) {
    const msg = formatMusicError(err);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          embeds: [makeEmbed("Music Error", msg, [], null, null, 0xFF0000)] // Red color for error
        });
      } else {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [makeEmbed("Music Error", msg, [], null, null, 0xFF0000)] // Red color for error
        });
      }
    } catch {}

    throw err;
  }
}

export async function handleButton(interaction) {
  if (!interaction.isButton?.()) return false;
  const id = String(interaction.customId || "");

  if (id.startsWith("audiodrop:")) {
    const parts = id.split(":");
    const key = parts[1];
    const uploaderId = parts[2];
    const action = parts[3] || "";

    const state = await getAudioDropCache(key);
    if (!state) {
      await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "This drop panel expired. Upload the file again.", [], null, null, 0xFF0000)] }).catch(() => {});
      return true;
    }

    // Common permission: allow anyone to play into their own VC; restrict arbitrary-VC actions.
    const isUploader = interaction.user.id === uploaderId;
    const canAdmin = interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild);
    const canArbitrary = isUploader || canAdmin;

    if (action === "dismiss") {
      if (!canArbitrary) {
        await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Only the uploader or an admin can dismiss this panel.", [], null, null, 0xFF0000)] }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate().catch(() => {});
      const embed = makeEmbed("Audio Drop", "Panel dismissed.", [], null, null, QUEUE_COLOR);
      await interaction.message?.edit?.({ embeds: [embed], components: [] }).catch(() => {});
      return true;
    }

    if (action === "deploy_ui") {
      // Advisor UI is the lowest-typing path to get music agents available.
      await openAdvisorUiHandoff(interaction, { desiredTotal: 10 }).catch(() => {});
      return true;
    }

    if (action === "choose_file") {
      const attachments = Array.isArray(state.attachments) ? state.attachments : [];
      if (!attachments.length) {
        await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "No files found for this panel.", [], null, null, 0xFF0000)] }).catch(() => {});
        return true;
      }
      const options = attachments.slice(0, 25).map((a, idx) => ({
        label: truncate(a?.name || `Attachment ${idx + 1}`, 100),
        value: String(idx),
        description: truncate(humanBytes(a?.size || 0), 100)
      }));
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`audiodropfile:${key}:${uploaderId}`)
        .setPlaceholder("Pick which file to play")
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(menu);
      await interaction.reply({
        ephemeral: true,
        embeds: [makeEmbed("Audio Drop", "Choose which uploaded file you want to play.", [
          { name: "Tip", value: "Your selection is saved for this panel for ~15 minutes.", inline: false }
        ], null, null, QUEUE_COLOR)],
        components: [row]
      }).catch(() => {});
      return true;
    }

    if (action === "pick_vc") {
      if (!canArbitrary) {
        await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Only the uploader or an admin can pick an arbitrary voice channel.", [], null, null, 0xFF0000)] }).catch(() => {});
        return true;
      }
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "This action requires a server context.", [], null, null, 0xFF0000)] }).catch(() => {});
        return true;
      }
      const all = Array.from(guild.channels.cache.values());
      const member = interaction.member;
      const vcOptions = [];
      for (const ch of all) {
        if (vcOptions.length >= 25) break;
        if (!ch || (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice)) continue;
        const perms = ch.permissionsFor?.(member);
        if (!perms?.has?.(PermissionsBitField.Flags.ViewChannel)) continue;
        if (!perms?.has?.(PermissionsBitField.Flags.Connect)) continue;
        vcOptions.push({ label: truncate(ch.name, 100), value: ch.id });
      }
      if (!vcOptions.length) {
        await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "No voice channels available.", [], null, null, 0xFF0000)] }).catch(() => {});
        return true;
      }
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`audiodropvc:${key}:${uploaderId}`)
        .setPlaceholder("Choose a voice channel")
        .addOptions(vcOptions);
      const row = new ActionRowBuilder().addComponents(menu);
      await interaction.reply({
        ephemeral: true,
        embeds: [makeEmbed("Audio Drop", "Choose where to play this file.", [], null, null, QUEUE_COLOR)],
        components: [row]
      }).catch(() => {});
      return true;
    }

    if (action === "play_my_vc") {
      const memberVcId = await resolveMemberVoiceId(interaction);
      if (!memberVcId) {
        await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Join a voice channel first, then press Play.", [], null, null, 0xFF0000)] }).catch(() => {});
        return true;
      }
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      await playAudioDropToVc(interaction, key, uploaderId, memberVcId);
      return true;
    }

    await interaction.reply({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Unknown action.", [], null, null, 0xFF0000)] }).catch(() => {});
    return true;
  }

  if (!id.startsWith("musicq:")) return false;

  // Anti-spam: Check if already processing this interaction
  if (buttonProcessing.has(interaction.id)) {
    return true; // Silently ignore duplicate
  }
  buttonProcessing.set(interaction.id, Date.now());

  const parts = id.split(":");
  const voiceChannelId = parts[1];
  const page = Math.max(0, Number.parseInt(parts[2] || "0", 10) || 0);
  const action = parts[3] || "refresh";

  // Check user cooldown for this button type
  const cooldownKey = `${interaction.user.id}:${action}`;
  const lastPressed = userButtonCooldowns.get(cooldownKey);
  if (lastPressed && (Date.now() - lastPressed) < BUTTON_COOLDOWN_MS) {
    // Too soon, silently ignore
    buttonProcessing.delete(interaction.id);
    return true;
  }
  userButtonCooldowns.set(cooldownKey, Date.now());

  const memberVcId = await resolveMemberVoiceId(interaction);
  if (!memberVcId || memberVcId !== voiceChannelId) {
    buttonProcessing.delete(interaction.id);
    await interaction.reply({
      content: "Join the same voice channel to control this queue.",
      ephemeral: true
    }).catch(err => {
      handleInteractionError(err, {
        operation: 'music_button_vc_check',
        guildId: interaction.guildId
      });
    });
    return true;
  }

  await interaction.deferUpdate().catch(err => {
    buttonProcessing.delete(interaction.id);
    handleInteractionError(err, {
      operation: 'music_button_defer',
      guildId: interaction.guildId
    });
  });

  const guildId = interaction.guildId;
  if (!guildId || !voiceChannelId) return true;

  const sess = getSessionAgent(guildId, voiceChannelId);
  if (!sess.ok) {
    await interaction.editReply({
      embeds: [makeEmbed("Music", formatMusicError(sess.reason), [], null, null, 0xFF0000)],
      components: []
    }).catch(err => {
      handleInteractionError(err, {
        operation: 'music_button_error_reply',
        guildId: interaction.guildId
      });
    });
    return true;
  }

  let actionNote = null;
  let nextPage = page;

  if (action === "prev") nextPage = Math.max(0, page - 1);
  if (action === "next") nextPage = page + 1;

  let config = null;
  try {
    config = await getMusicConfig(guildId);
  } catch {}

  if (!["prev", "next", "refresh", "now"].includes(action)) {
    const opMap = { pause: "pause", resume: "resume", skip: "skip", stop: "stop" };
    const op = opMap[action];
    if (op) {
      try {
        const res = await sendAgentCommand(sess.agent, op, {
          guildId,
          voiceChannelId,
          textChannelId: interaction.channelId,
          ownerUserId: interaction.user.id,
          actorUserId: interaction.user.id,
          controlMode: config?.controlMode,
          searchProviders: config?.searchProviders,
          fallbackProviders: config?.fallbackProviders
        });
        actionNote = actionLabel(action, res?.action);
      } catch (err) {
        if (String(err?.message ?? err) === "no-session") releaseSession(guildId, voiceChannelId);
        actionNote = formatMusicError(err);
      }
    }
  }

  if (action === "now") nextPage = 0;

  try {
    const result = await sendAgentCommand(sess.agent, "queue", {
      guildId,
      voiceChannelId,
      textChannelId: interaction.channelId,
      ownerUserId: interaction.user.id,
      actorUserId: interaction.user.id,
      controlMode: config?.controlMode,
      searchProviders: config?.searchProviders,
      fallbackProviders: config?.fallbackProviders
    });
    const built = buildQueueEmbed(result, nextPage, QUEUE_PAGE_SIZE, actionNote);
    await interaction.editReply({
      embeds: [built.embed],
      components: buildQueueComponents(voiceChannelId, built.page, built.totalPages)
    }).catch(() => {});
  } catch (err) {
    if (String(err?.message ?? err) === "no-session") releaseSession(guildId, voiceChannelId);
    await interaction.editReply({
      embeds: [makeEmbed("Music Error", formatMusicError(err), [], null, null, 0xFF0000)],
      components: []
    }).catch(() => {});
  }

  // Clean up processing tracker
  buttonProcessing.delete(interaction.id);
  
  return true;
}

export async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu?.()) return false;
  const id = String(interaction.customId || "");
  if (id.startsWith("audiodropfile:")) {
    await interaction.deferUpdate().catch(() => {});
    const parts = id.split(":");
    const key = parts[1];
    const uploaderId = parts[2];

    const state = await getAudioDropCache(key);
    if (!state) {
      await interaction.followUp({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "This drop panel expired. Upload the file again.", [], null, null, 0xFF0000)] }).catch(() => {});
      return true;
    }

    const idx = Math.max(0, Math.trunc(Number(interaction.values?.[0] ?? 0)));
    const attachments = Array.isArray(state.attachments) ? state.attachments : [];
    const selected = attachments[idx];
    if (!selected) {
      await interaction.followUp({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Invalid selection.", [], null, null, 0xFF0000)] }).catch(() => {});
      return true;
    }

    await setAudioDropSelection(key, interaction.user.id, idx).catch(() => {});
    const label = selected.name ? `**${selected.name}**` : `Attachment ${idx + 1}`;
    await interaction.followUp({
      ephemeral: true,
      embeds: [makeEmbed("Audio Drop", `Selected ${label}.\nUse **Play In My VC** on the panel to start playback.`, [
        { name: "Size", value: humanBytes(selected.size), inline: true }
      ], null, null, QUEUE_COLOR)]
    }).catch(() => {});
    return true;
  }

  if (id.startsWith("audiodropvc:")) {
    await interaction.deferUpdate().catch(() => {});
    const parts = id.split(":");
    const key = parts[1];
    const uploaderId = parts[2];

    const state = await getAudioDropCache(key);
    if (!state) {
      await interaction.followUp({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "This drop panel expired. Upload the file again.", [], null, null, 0xFF0000)] }).catch(() => {});
      return true;
    }

    const isUploader = interaction.user.id === uploaderId;
    const canAdmin = interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild);
    if (!isUploader && !canAdmin) {
      await interaction.followUp({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Only the uploader or an admin can pick an arbitrary voice channel.", [], null, null, 0xFF0000)] }).catch(() => {});
      return true;
    }

    const vcId = String(interaction.values?.[0] ?? "");
    if (!vcId) {
      await interaction.followUp({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Choose a voice channel.", [], null, null, 0xFF0000)] }).catch(() => {});
      return true;
    }

    await interaction.followUp({ ephemeral: true, embeds: [makeEmbed("Audio Drop", "Starting playback...", [], null, null, QUEUE_COLOR)] }).catch(() => {});
    // Use followUp context: run playback and then send a final result embed.
    await playAudioDropToVc(interaction, key, uploaderId, vcId, { preferFollowUp: true });
    return true;
  }

  if (!id.startsWith("musicsearch:")) return false;

  // Defer immediately to prevent interaction timeout
  await interaction.deferUpdate().catch(() => {});

  const key = id.split(":")[1];
  const entry = await getSearchCache(key);
  if (!entry) {
    await interaction.followUp({ content: "Search selection expired. Run /music play again.", ephemeral: true }).catch(() => {});
    return true;
  }

  if (entry.userId !== interaction.user.id) {
    await interaction.followUp({ content: "Not for you.", ephemeral: true }).catch(() => {});
    return true;
  }

  const memberVcId = await resolveMemberVoiceId(interaction);
  if (!memberVcId || memberVcId !== entry.voiceChannelId) {
    await interaction.followUp({ content: "Join the same voice channel to select this result.", ephemeral: true }).catch(() => {});
    return true;
  }

  const idx = Math.max(0, Math.trunc(Number(interaction.values?.[0] ?? 0)));
  const track = entry.tracks?.[idx];
  if (!track) {
    await interaction.followUp({ content: "Invalid selection.", ephemeral: true }).catch(() => {});
    return true;
  }

  const sess = getSessionAgent(entry.guildId, entry.voiceChannelId);
  if (!sess.ok) {
    await interaction.followUp({ content: formatMusicError(sess.reason), ephemeral: true }).catch(() => {});
    return true;
  }

  let config = null;
  try {
    config = await getMusicConfig(entry.guildId);
  } catch {}

  try {
    console.log(`[music:select] Sending play command for track: ${track.title || track.uri} to agent ${sess.agent?.agentId}`);
    const result = await sendAgentCommand(sess.agent, "play", {
      guildId: entry.guildId,
      voiceChannelId: entry.voiceChannelId,
      textChannelId: interaction.channelId,
      ownerUserId: interaction.user.id,
      actorUserId: interaction.user.id,
      query: track.uri ?? track.title ?? "",
      controlMode: config?.controlMode,
      searchProviders: config?.searchProviders,
      fallbackProviders: config?.fallbackProviders,
      requester: buildRequester(interaction.user)
    });
    console.log(`[music:select] Play command result:`, result);
    const playedTrack = result?.track ?? track;
    const action = String(result?.action ?? "queued");
    await interaction.editReply({
      embeds: [buildTrackEmbed(action, playedTrack)],
      components: []
    }).catch(() => {});
  } catch (err) {
    console.error(`[music:select] Error sending play command:`, err?.stack ?? err?.message ?? err);
    await interaction.editReply({
      embeds: [makeEmbed("Music Error", formatMusicError(err), [], null, null, 0xFF0000)],
      components: []
    }).catch(() => {});
  }

  // Do NOT delete the cache entry immediately. 
  // Allow multiple people (or the same person) to select from the same search result if they want?
  // Or at least prevent the race condition where "Search selection expired" appears because it was deleted too fast.
  // Redis TTL handles cleanup.
  // searchCache.delete(key); 
  return true;
}

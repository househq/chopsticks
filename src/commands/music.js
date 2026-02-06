// src/commands/music.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  getPlayerContext,
  assertOwnership,
  assertSameVoice,
  createOrGetPlayer,
  searchOnPlayer,
  playFirst,
  skip,
  pause,
  stop,
} from "../lavalink/client.js";

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Voice-channel gated music")
  .addSubcommand((s) =>
    s
      .setName("play")
      .setDescription("Play a track")
      .addStringOption((o) =>
        o.setName("query").setDescription("Search or URL").setRequired(true)
      )
  )
  .addSubcommand((s) => s.setName("skip").setDescription("Skip current track"))
  .addSubcommand((s) => s.setName("pause").setDescription("Pause playback"))
  .addSubcommand((s) => s.setName("resume").setDescription("Resume playback"))
  .addSubcommand((s) => s.setName("stop").setDescription("Stop playback"));

function requireVoice(interaction) {
  const member = interaction.member;
  const vc = member?.voice?.channel ?? null;
  if (!vc) return { ok: false, vc: null };
  return { ok: true, vc };
}

function enforceOwnershipAndVC(ctx, userId, voiceChannelId) {
  assertOwnership(ctx, userId);
  assertSameVoice(ctx, voiceChannelId);
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch {
    // If Discord says "Unknown interaction", do nothing: it’s already dead.
  }
}

export async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const sub = interaction.options.getSubcommand();

  const voiceCheck = requireVoice(interaction);
  if (!voiceCheck.ok) {
    await safeReply(interaction, { content: "Join a voice channel.", ephemeral: true });
    return;
  }

  const vc = voiceCheck.vc;

  if (sub === "play") {
    // Always defer immediately to avoid Unknown interaction if Lavalink/node is slow.
    await safeReply(interaction, { content: "Searching…", ephemeral: true });
    try {
      // Convert the “Searching…” reply into a deferred editReply flow.
      // If initial reply succeeded, defer is unnecessary and may fail; so we just edit later.
    } catch {}

    let ctx = getPlayerContext(guildId);
    if (!ctx) {
      ctx = await createOrGetPlayer({
        guildId,
        voiceChannelId: vc.id,
        textChannelId: interaction.channelId,
        ownerId: userId,
      });
    } else {
      enforceOwnershipAndVC(ctx, userId, vc.id);
    }

    const query = interaction.options.getString("query", true);

    let res;
    try {
      res = await searchOnPlayer(ctx, query, interaction.user);
    } catch (e) {
      await safeReply(interaction, {
        content: `Search failed: ${e?.message ?? "unknown error"}`,
        ephemeral: true,
      });
      return;
    }

    if (!res?.tracks?.length) {
      await safeReply(interaction, { content: "No results.", ephemeral: true });
      return;
    }

    const track = res.tracks[0];

    try {
      await playFirst(ctx, track);
    } catch (e) {
      await safeReply(interaction, {
        content: `Play failed: ${e?.message ?? "unknown error"}`,
        ephemeral: true,
      });
      return;
    }

    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle("Now Playing")
          .setDescription(track.info?.title ?? "Unknown title"),
      ],
    });
    return;
  }

  const ctx = getPlayerContext(guildId);
  if (!ctx) {
    await safeReply(interaction, { content: "Nothing playing in this guild.", ephemeral: true });
    return;
  }

  try {
    enforceOwnershipAndVC(ctx, userId, vc.id);
  } catch (e) {
    await safeReply(interaction, { content: `${e.message}`, ephemeral: true });
    return;
  }

  try {
    if (sub === "skip") skip(ctx);
    if (sub === "pause") pause(ctx, true);
    if (sub === "resume") pause(ctx, false);
    if (sub === "stop") stop(ctx);
  } catch (e) {
    await safeReply(interaction, { content: `Failed: ${e?.message ?? "unknown"}`, ephemeral: true });
    return;
  }

  await safeReply(interaction, { content: "OK", ephemeral: true });
}

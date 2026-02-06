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
  stop
} from "../lavalink/client.js";

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Voice-channel gated music")
  .addSubcommand(s =>
    s.setName("play")
      .setDescription("Play a track")
      .addStringOption(o =>
        o.setName("query")
          .setDescription("Search or URL")
          .setRequired(true)
      )
  )
  .addSubcommand(s => s.setName("skip").setDescription("Skip current track"))
  .addSubcommand(s => s.setName("pause").setDescription("Pause playback"))
  .addSubcommand(s => s.setName("resume").setDescription("Resume playback"))
  .addSubcommand(s => s.setName("stop").setDescription("Stop playback"));

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

export async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const sub = interaction.options.getSubcommand();

  const voiceCheck = requireVoice(interaction);
  if (!voiceCheck.ok) {
    await interaction.reply({ content: "Join a voice channel.", ephemeral: true });
    return;
  }

  const vc = voiceCheck.vc;

  if (sub === "play") {
    await interaction.deferReply();

    let ctx = getPlayerContext(guildId);
    if (!ctx) {
      ctx = await createOrGetPlayer({
        guildId,
        voiceChannelId: vc.id,
        textChannelId: interaction.channelId,
        ownerId: userId
      });
    } else {
      enforceOwnershipAndVC(ctx, userId, vc.id);
    }

    const query = interaction.options.getString("query", true);
    const res = await searchOnPlayer(ctx, query, interaction.user);

    if (!res?.tracks?.length) {
      await interaction.editReply("No results.");
      return;
    }

    const track = res.tracks[0];
    await playFirst(ctx, track);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Now Playing")
          .setDescription(track.info?.title ?? "Unknown title")
      ]
    });
    return;
  }

  const ctx = getPlayerContext(guildId);
  if (!ctx) {
    await interaction.reply({ content: "Nothing playing in this guild.", ephemeral: true });
    return;
  }

  enforceOwnershipAndVC(ctx, userId, vc.id);

  if (sub === "skip") skip(ctx);
  if (sub === "pause") pause(ctx, true);
  if (sub === "resume") pause(ctx, false);
  if (sub === "stop") stop(ctx);

  await interaction.reply({ content: "OK", ephemeral: true });
}

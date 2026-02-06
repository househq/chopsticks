import { LavalinkManager } from "lavalink-client";

let manager = null;
let rawHooked = false;
let startPromise = null;

// One player per guild. Lavalink is guild-scoped.
// Your command UX can still be VC-gated at the command layer.
const ctxByGuild = new Map(); // guildId -> ctx

function ensureRawHook(client) {
  if (rawHooked) return;
  rawHooked = true;

  // lavalink-client expects the raw gateway payload stream
  client.on("raw", d => {
    try {
      manager?.sendRawData(d);
    } catch {}
  });
}

export function initLavalink(client) {
  if (manager) return manager;
  if (!client?.user?.id) {
    throw new Error("client-not-ready");
  }

  manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host: process.env.LAVALINK_HOST || "localhost",
        port: Number(process.env.LAVALINK_PORT) || 2333,
        authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass"
      }
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      guild?.shard?.send(payload);
    },
    client: {
      id: client.user.id,
      username: client.user.username
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false
      },
      onEmptyQueue: {
        destroyAfterMs: 300_000
      }
    }
  });

  ensureRawHook(client);
  return manager;
}

export async function startLavalink(client) {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const m = initLavalink(client);
    await m.init({ id: client.user.id, username: client.user.username });
    return m;
  })();

  try {
    return await startPromise;
  } catch (err) {
    startPromise = null;
    throw err;
  }
}

export function getPlayerContext(guildId) {
  return ctxByGuild.get(guildId) ?? null;
}

export function assertOwnership(ctx, userId) {
  if (ctx.ownerId !== userId) throw new Error("not-owner");
}

export function assertSameVoice(ctx, voiceChannelId) {
  if (ctx.voiceChannelId !== voiceChannelId) throw new Error("wrong-voice-channel");
}

export async function createOrGetPlayer({
  guildId,
  voiceChannelId,
  textChannelId,
  ownerId
}) {
  if (!manager) throw new Error("lavalink-not-ready");

  const existing = ctxByGuild.get(guildId);
  if (existing) return existing;

  const player = manager.createPlayer({
    guildId,
    voiceChannelId,
    textChannelId,
    selfDeaf: true,
    volume: 100
  });

  await player.connect();

  const ctx = {
    player,
    guildId,
    voiceChannelId,
    textChannelId,
    ownerId,
    lastActive: Date.now()
  };

  player.on("trackStart", () => {
    ctx.lastActive = Date.now();
  });

  player.on("queueEnd", () => {
    // onEmptyQueue destroyAfterMs handles server-side cleanup;
    // we also clear local ctx if the player is gone.
    scheduleCtxSweep(guildId);
  });

  ctxByGuild.set(guildId, ctx);
  return ctx;
}

export async function searchOnPlayer(ctx, query, requester) {
  return ctx.player.search({ query }, requester);
}

export async function playFirst(ctx, track) {
  ctx.lastActive = Date.now();
  await ctx.player.queue.add(track);
  if (!ctx.player.playing) await ctx.player.play();
}

export function skip(ctx) {
  ctx.lastActive = Date.now();
  ctx.player.skip();
}

export function pause(ctx, state) {
  ctx.lastActive = Date.now();
  ctx.player.pause(state);
}

export function stop(ctx) {
  ctx.lastActive = Date.now();
  try {
    ctx.player.queue.clear();
    ctx.player.stop();
  } finally {
    destroy(ctx.guildId);
  }
}

export function destroy(guildId) {
  const ctx = ctxByGuild.get(guildId);
  if (!ctx) return;

  try {
    ctx.player.destroy();
  } catch {}
  ctxByGuild.delete(guildId);
}

function scheduleCtxSweep(guildId) {
  setTimeout(() => {
    const ctx = ctxByGuild.get(guildId);
    if (!ctx) return;

    const idle = Date.now() - ctx.lastActive > 300_000;
    const empty = (ctx.player.queue?.size ?? 0) === 0;

    if (idle && empty && !ctx.player.playing) destroy(guildId);
  }, 300_000);
}

// src/lavalink/client.js
import { LavalinkManager } from "lavalink-client";

let manager = null;
let rawHooked = false;
let startPromise = null;

// One ctx per guild.
const ctxByGuild = new Map(); // guildId -> ctx

function ensureRawHook(client) {
  if (rawHooked) return;
  rawHooked = true;

  // lavalink-client expects the raw gateway payload stream.
  client.on("raw", (d) => {
    try {
      manager?.sendRawData(d);
    } catch {}
  });
}

function normalizeQuery(input) {
  const q = String(input ?? "").trim();
  if (!q) return "";
  if (/^https?:\/\//i.test(q)) return q;

  // IMPORTANT:
  // Lavalink v4 REST expects "ytsearch:..." for search identifiers.
  // We pass the identifier directly to the Player search to avoid "defaultSearchPlatform"
  // ambiguity and any double-prefix behaviors across client versions.
  return `ytsearch:${q}`;
}

function bindManagerEventsOnce() {
  if (!manager) return;
  if (manager.__chopsticksBound) return;
  manager.__chopsticksBound = true;

  // Keep ctx lastActive fresh and clean up if we detect destruction.
  for (const evt of ["trackStart", "queueEnd", "playerDestroy", "nodeDisconnect"]) {
    try {
      manager.on(evt, (player) => {
        if (evt === "nodeDisconnect") {
          ctxByGuild.clear();
          return;
        }

        const gid = player?.guildId;
        if (!gid) return;

        const ctx = ctxByGuild.get(gid);
        if (!ctx) return;

        if (evt === "trackStart") ctx.lastActive = Date.now();
        if (evt === "queueEnd") scheduleCtxSweep(gid);
        if (evt === "playerDestroy") ctxByGuild.delete(gid);
      });
    } catch {}
  }
}

export function initLavalink(client) {
  if (manager) return manager;
  if (!client?.user?.id) throw new Error("client-not-ready");

  manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host: process.env.LAVALINK_HOST || "localhost",
        port: Number(process.env.LAVALINK_PORT) || 2333,
        authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
      },
    ],
    // Required by lavalink-client:
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      guild?.shard?.send(payload);
    },
    client: {
      id: client.user.id,
      username: client.user.username,
    },
    // Do not rely on defaultSearchPlatform behavior for identifiers we pass explicitly.
    playerOptions: {
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },
      onEmptyQueue: {
        destroyAfterMs: 300_000,
      },
    },
  });

  ensureRawHook(client);
  bindManagerEventsOnce();
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

export async function createOrGetPlayer({ guildId, voiceChannelId, textChannelId, ownerId }) {
  if (!manager) throw new Error("lavalink-not-ready");

  const existing = ctxByGuild.get(guildId);
  if (existing) return existing;

  const player = manager.createPlayer({
    guildId,
    voiceChannelId,
    textChannelId,
    selfDeaf: true,
    volume: 100,
  });

  // connect can throw if node isn’t actually alive; let it throw
  await player.connect();

  const ctx = {
    player,
    guildId,
    voiceChannelId,
    textChannelId,
    ownerId,
    lastActive: Date.now(),
  };

  ctxByGuild.set(guildId, ctx);
  return ctx;
}

export async function searchOnPlayer(ctx, query, requester) {
  const identifier = normalizeQuery(query);
  if (!identifier) return { tracks: [] };

  const p = ctx?.player;
  if (!p || typeof p.search !== "function") throw new Error("player-search-missing");

  // lavalink-client expects { query } where query is an identifier (ytsearch:... or URL)
  return await p.search({ query: identifier }, requester);
}

export async function playFirst(ctx, track) {
  const p = ctx.player;
  ctx.lastActive = Date.now();

  // queue.add exists; queue.clear may not. Guard.
  await p.queue.add(track);
  if (!p.playing) await p.play();
}

export function skip(ctx) {
  ctx.lastActive = Date.now();
  ctx.player.skip();
}

export function pause(ctx, state) {
  ctx.lastActive = Date.now();
  ctx.player.pause(state);
}

function bestEffortClearQueue(player) {
  const q = player?.queue;
  if (!q) return;

  if (typeof q.clear === "function") {
    try {
      q.clear();
      return;
    } catch {}
  }

  // Different shapes across versions
  if (Array.isArray(q)) q.length = 0;
  if (Array.isArray(q.tracks)) q.tracks.length = 0;
  if (typeof q.splice === "function" && typeof q.length === "number") q.splice(0, q.length);
}

export function stop(ctx) {
  ctx.lastActive = Date.now();

  try {
    bestEffortClearQueue(ctx.player);
    if (typeof ctx.player.stop === "function") ctx.player.stop();
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

    const q = ctx.player?.queue;
    const size =
      (typeof q?.size === "number" ? q.size : null) ??
      (typeof q?.length === "number" ? q.length : null) ??
      (Array.isArray(q?.tracks) ? q.tracks.length : 0);

    const empty = (size ?? 0) === 0;

    if (idle && empty && !ctx.player.playing) destroy(guildId);
  }, 300_000);
}

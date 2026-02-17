// src/tools/voice/customVcsState.js
// Custom VC state: persisted in guild voice state (data.voice.*)
// No direct Discord.js calls here.

import { saveVoiceState } from "./schema.js";

function asIdList(value, { max = 100 } = {}) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(value) ? value : []) {
    const s = String(v || "").trim();
    if (!/^\d{16,21}$/.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function ensureCustomVcsState(voice) {
  if (!voice || typeof voice !== "object") return;
  voice.customVcs ??= {};
  voice.customVcs.enabled = typeof voice.customVcs.enabled === "boolean" ? voice.customVcs.enabled : false;
  voice.customVcs.categoryId = typeof voice.customVcs.categoryId === "string" ? voice.customVcs.categoryId : null;
  voice.customVcs.panelChannelId = typeof voice.customVcs.panelChannelId === "string" ? voice.customVcs.panelChannelId : null;
  voice.customVcs.panelMessageId = typeof voice.customVcs.panelMessageId === "string" ? voice.customVcs.panelMessageId : null;
  voice.customVcs.modRoleIds = asIdList(voice.customVcs.modRoleIds, { max: 10 });

  const maxRooms = Number(voice.customVcs.maxRoomsPerUser);
  voice.customVcs.maxRoomsPerUser = Number.isFinite(maxRooms) ? Math.max(1, Math.min(5, Math.trunc(maxRooms))) : 1;

  const defaultLimit = Number(voice.customVcs.defaultUserLimit);
  voice.customVcs.defaultUserLimit = Number.isFinite(defaultLimit) ? Math.max(0, Math.min(99, Math.trunc(defaultLimit))) : 0;

  const defaultBitrate = Number(voice.customVcs.defaultBitrateKbps);
  voice.customVcs.defaultBitrateKbps =
    Number.isFinite(defaultBitrate) ? Math.max(8, Math.min(512, Math.trunc(defaultBitrate))) : null;

  voice.customRooms ??= {};
  if (typeof voice.customRooms !== "object" || Array.isArray(voice.customRooms)) {
    voice.customRooms = {};
  }
}

export function getCustomVcConfig(voice) {
  ensureCustomVcsState(voice);
  return voice.customVcs;
}

export function getCustomRoom(voice, channelId) {
  ensureCustomVcsState(voice);
  const id = String(channelId || "").trim();
  const rec = voice.customRooms?.[id] ?? null;
  if (!rec || typeof rec !== "object") return null;
  return rec;
}

export function listCustomRooms(voice) {
  ensureCustomVcsState(voice);
  const out = [];
  for (const [channelId, rec] of Object.entries(voice.customRooms || {})) {
    if (!rec || typeof rec !== "object") continue;
    out.push({ channelId, ...rec });
  }
  return out;
}

export function findUserCustomRooms(voice, userId) {
  ensureCustomVcsState(voice);
  const uid = String(userId || "").trim();
  const out = [];
  for (const [channelId, rec] of Object.entries(voice.customRooms || {})) {
    if (!rec || typeof rec !== "object") continue;
    if (String(rec.ownerId || "") === uid) out.push({ channelId, ...rec });
  }
  out.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return out;
}

export async function upsertCustomRoom(guildId, channelId, record, voice) {
  ensureCustomVcsState(voice);
  const id = String(channelId || "").trim();
  if (!id) return { ok: false, error: "invalid-channel" };
  const rec = record && typeof record === "object" ? { ...record } : {};

  rec.ownerId = /^\d{16,21}$/.test(String(rec.ownerId || "")) ? String(rec.ownerId) : null;
  rec.privacy = String(rec.privacy || "public") === "private" ? "private" : "public";
  rec.createdAt = Number.isFinite(Number(rec.createdAt)) ? Math.trunc(Number(rec.createdAt)) : Date.now();
  rec.updatedAt = Date.now();

  rec.guestIds = asIdList(rec.guestIds, { max: 100 });
  rec.denyJoinIds = asIdList(rec.denyJoinIds, { max: 100 });
  rec.denySpeakIds = asIdList(rec.denySpeakIds, { max: 100 });

  voice.customRooms[id] = rec;
  await saveVoiceState(guildId, voice);
  return { ok: true, channelId: id, record: rec };
}

export async function patchCustomRoom(guildId, channelId, patch, voice) {
  ensureCustomVcsState(voice);
  const id = String(channelId || "").trim();
  const current = getCustomRoom(voice, id);
  if (!current) return { ok: false, error: "room-not-found" };

  const next = { ...current };
  if (patch && typeof patch === "object") {
    if (patch.privacy !== undefined) next.privacy = String(patch.privacy) === "private" ? "private" : "public";
    if (patch.guestIds !== undefined) next.guestIds = asIdList(patch.guestIds, { max: 100 });
    if (patch.denyJoinIds !== undefined) next.denyJoinIds = asIdList(patch.denyJoinIds, { max: 100 });
    if (patch.denySpeakIds !== undefined) next.denySpeakIds = asIdList(patch.denySpeakIds, { max: 100 });
  }

  return upsertCustomRoom(guildId, id, next, voice);
}

export async function removeCustomRoom(guildId, channelId, voice) {
  ensureCustomVcsState(voice);
  const id = String(channelId || "").trim();
  if (!id) return { ok: false, error: "invalid-channel" };
  if (voice.customRooms?.[id]) delete voice.customRooms[id];
  await saveVoiceState(guildId, voice);
  return { ok: true, channelId: id };
}


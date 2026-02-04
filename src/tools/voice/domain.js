// src/tools/voice/domain.js
// AUTHORITATIVE VOICE DOMAIN — persistence-backed
// NO Discord.js calls

import {
  getVoiceState,
  saveVoiceState
} from "./schema.js";

export function addLobby(guildId, channelId, categoryId, template) {
  const voice = getVoiceState(guildId);

  voice.lobbies ??= {};
  voice.tempChannels ??= {};

  voice.lobbies[channelId] = {
    channelId,
    categoryId,
    nameTemplate: template,
    enabled: true
  };

  saveVoiceState(guildId, voice);
  return { ok: true, action: "add", channelId };
}

export function removeLobby(guildId, channelId) {
  const voice = getVoiceState(guildId);
  delete voice.lobbies?.[channelId];
  saveVoiceState(guildId, voice);
  return { ok: true, action: "remove", channelId };
}

export function setLobbyEnabled(guildId, channelId, enabled) {
  const voice = getVoiceState(guildId);
  if (!voice.lobbies?.[channelId]) {
    return { ok: false, error: "lobby-not-found" };
  }

  voice.lobbies[channelId].enabled = enabled;
  saveVoiceState(guildId, voice);
  return { ok: true, action: enabled ? "enable" : "disable", channelId };
}

export function getStatus(guildId) {
  const voice = getVoiceState(guildId);
  return {
    lobbies: voice.lobbies ?? {},
    tempChannels: voice.tempChannels ?? {}
  };
}

export function resetVoice(guildId) {
  saveVoiceState(guildId, {
    lobbies: {},
    tempChannels: {}
  });
  return { ok: true, action: "reset" };
}

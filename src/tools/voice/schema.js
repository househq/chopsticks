// src/tools/voice/schema.js

import {
  loadGuildData,
  saveGuildData
} from "../../utils/storage.js";

export function initGuildVoiceState(guildId) {
  const data = loadGuildData(guildId);
  saveGuildData(guildId, data);
  return data.voice;
}

export function getVoiceState(guildId) {
  return loadGuildData(guildId).voice;
}

export function saveVoiceState(guildId, voice) {
  const data = loadGuildData(guildId);
  data.voice = voice;
  saveGuildData(guildId, data);
  return voice;
}

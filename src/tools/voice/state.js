import {
  getVoiceState,
  saveVoiceState
} from "./schema.js";

/* ---------- LOCKS (PROCESS-LOCAL) ---------- */

const creationLocks = new Map();

function lockKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

export function acquireCreationLock(guildId, userId) {
  const key = lockKey(guildId, userId);
  if (creationLocks.has(key)) return false;
  creationLocks.set(key, true);
  return true;
}

export function releaseCreationLock(guildId, userId) {
  creationLocks.delete(lockKey(guildId, userId));
}

/* ---------- STATE ACCESS ---------- */

export function ensureVoiceState(_) {
  // NO-OP BY DESIGN
  // Schema is authoritative
}

/* ---------- TEMP CHANNEL MUTATION (SCHEMA-SAFE) ---------- */

export function registerTempChannel(
  guildId,
  channelId,
  ownerId,
  lobbyId
) {
  const voice = getVoiceState(guildId);

  if (!voice.lobbies[lobbyId]) return;

  voice.tempChannels[channelId] = {
    ownerId,
    lobbyId
  };

  saveVoiceState(guildId, voice);
}

export function removeTempChannel(guildId, channelId) {
  const voice = getVoiceState(guildId);

  if (voice.tempChannels[channelId]) {
    delete voice.tempChannels[channelId];
    saveVoiceState(guildId, voice);
  }
}

export function findUserTempChannel(guildId, userId, lobbyId) {
  const voice = getVoiceState(guildId);

  for (const [channelId, temp] of Object.entries(
    voice.tempChannels
  )) {
    if (
      temp.ownerId === userId &&
      temp.lobbyId === lobbyId
    ) {
      return channelId;
    }
  }

  return null;
}

// src/tools/voice/controller.js

import { ChannelType, PermissionsBitField } from "discord.js";
import { loadGuildData, saveGuildData } from "../../utils/storage.js";
import { ensureVoiceState } from "./state.js";
import { logger } from "../../utils/logger.js";

/* ---------- INTERNAL GUARDS ---------- */

function isTempChannel(voice, channelId) {
  return Boolean(voice.tempChannels[channelId]);
}

function isManagedCategory(voice, categoryId) {
  return Object.values(voice.lobbies).some(
    lobby => lobby.categoryId === categoryId
  );
}

function isSpawnedUnderManagedCategory(voice, channelId) {
  const temp = voice.tempChannels[channelId];
  if (!temp) return false;

  const parentLobby = voice.lobbies[temp.lobbyId];
  if (!parentLobby) return false;

  return true;
}

/* ---------- CATEGORY VALIDATION ---------- */

async function validateCategoryPermissions(guild, categoryId) {
  try {
    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return { ok: false, reason: "category-not-found" };
    }

    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember) {
      return { ok: false, reason: "bot-member-unavailable" };
    }

    const perms = category.permissionsFor(botMember);
    if (!perms) {
      return { ok: false, reason: "permissions-unavailable" };
    }

    if (!perms.has(PermissionsBitField.Flags.ManageChannels)) {
      return { ok: false, reason: "missing-manage-channels" };
    }

    if (!perms.has(PermissionsBitField.Flags.ViewChannel)) {
      return { ok: false, reason: "missing-view-channel" };
    }

    return { ok: true };
  } catch (err) {
    logger.error("voice: category validation failed", {
      categoryId,
      error: err.message
    });
    return { ok: false, reason: "validation-error" };
  }
}

/* ---------- ADD LOBBY ---------- */

export async function addLobby(guildId, channelId, categoryId, template, guild) {
  const data = loadGuildData(guildId);
  ensureVoiceState(data);

  const voice = data.voice;

  /* HARD BLOCK: spawned temp VC */
  if (isTempChannel(voice, channelId)) {
    return { ok: false, reason: "temp-channel" };
  }

  /* HARD BLOCK: channel spawned under managed category */
  if (isSpawnedUnderManagedCategory(voice, channelId)) {
    return { ok: false, reason: "spawned-channel" };
  }

  /* HARD BLOCK: duplicate lobby */
  if (voice.lobbies[channelId]) {
    return { ok: false, reason: "exists" };
  }

  /* HARD BLOCK: category already managed */
  if (isManagedCategory(voice, categoryId)) {
    return { ok: false, reason: "category-bound" };
  }

  /* PREFLIGHT: category permissions (default enabled) */
  if (guild) {
    const validation = await validateCategoryPermissions(guild, categoryId);
    if (!validation.ok) {
      logger.warn("voice: category validation failed during add", {
        guildId,
        categoryId,
        reason: validation.reason
      });
      return { ok: false, reason: validation.reason };
    }
  }

  voice.lobbies[channelId] = {
    categoryId,
    enabled: false,
    nameTemplate: template,
    maxChannels: null,
    cleanupMode: "wait-until-empty",
    validateCategory: true
  };

  saveGuildData(guildId, data);
  return { ok: true };
}

/* ---------- REMOVE LOBBY ---------- */

export async function removeLobby(guildId, channelId, guild) {
  const data = loadGuildData(guildId);
  ensureVoiceState(data);

  const lobby = data.voice.lobbies[channelId];
  if (!lobby) {
    return { ok: false, reason: "missing" };
  }

  const cleanupMode = lobby.cleanupMode ?? "wait-until-empty";
  const affectedChannels = [];

  for (const [tempId, temp] of Object.entries(data.voice.tempChannels)) {
    if (temp.lobbyId === channelId) {
      affectedChannels.push(tempId);
      delete data.voice.tempChannels[tempId];
    }
  }

  delete data.voice.lobbies[channelId];
  saveGuildData(guildId, data);

  /* CLEANUP: delete Discord channels based on mode */
  if (guild && cleanupMode === "immediate") {
    for (const tempId of affectedChannels) {
      try {
        const channel = await guild.channels.fetch(tempId).catch(() => null);
        if (channel) {
          await channel.delete();
          logger.info("voice: immediate cleanup deleted channel", {
            guildId,
            channelId: tempId
          });
        }
      } catch (err) {
        logger.error("voice: immediate cleanup failed", {
          guildId,
          channelId: tempId,
          error: err.message
        });
      }
    }
  }

  return { ok: true, cleanupMode, deletedCount: affectedChannels.length };
}

/* ---------- ENABLE / DISABLE ---------- */

export async function setLobbyEnabled(guildId, channelId, enabled) {
  const data = loadGuildData(guildId);
  ensureVoiceState(data);

  const lobby = data.voice.lobbies[channelId];
  if (!lobby) return { ok: false, reason: "missing" };

  if (lobby.enabled === enabled) {
    return { ok: true, noop: true };
  }

  if (enabled) {
    const conflict = Object.entries(data.voice.lobbies).find(
      ([id, l]) =>
        id !== channelId &&
        l.enabled === true &&
        l.categoryId === lobby.categoryId
    );

    if (conflict) {
      return {
        ok: false,
        reason: "category-conflict",
        conflictChannelId: conflict[0]
      };
    }
  }

  lobby.enabled = enabled;
  saveGuildData(guildId, data);
  return { ok: true };
}

/* ---------- RESET ---------- */

export async function resetVoice(guildId) {
  const data = loadGuildData(guildId);
  data.voice = { lobbies: {}, tempChannels: {} };
  saveGuildData(guildId, data);
}

/* ---------- STATUS ---------- */

export async function getStatus(guildId) {
  const data = loadGuildData(guildId);
  ensureVoiceState(data);
  return data.voice;
}
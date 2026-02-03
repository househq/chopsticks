// src/tools/voice/cleanup.js

import { loadGuildData, saveGuildData } from "../../utils/storage.js";
import { logger } from "../../utils/logger.js";

export async function cleanupVoice(client) {
  logger.info("voice: starting global cleanup");

  let totalOrphaned = 0;
  let totalDeleted = 0;
  let totalFailed = 0;

  for (const guild of client.guilds.cache.values()) {
    let data;
    try {
      data = loadGuildData(guild.id);
    } catch (err) {
      logger.error("voice: cleanup skipped guild (load failed)", {
        guildId: guild.id,
        error: err.message
      });
      continue;
    }

    const voice = data.voice;
    if (!voice || !voice.tempChannels) continue;

    let mutated = false;
    const orphanedChannelIds = [];

    for (const [channelId, temp] of Object.entries(voice.tempChannels)) {
      const channel = guild.channels.cache.get(channelId);

      if (!channel) {
        orphanedChannelIds.push(channelId);
        delete voice.tempChannels[channelId];
        mutated = true;
        totalOrphaned++;
        continue;
      }

      if (channel.members.size === 0) {
        orphanedChannelIds.push(channelId);
        delete voice.tempChannels[channelId];
        mutated = true;

        try {
          await channel.delete();
          totalDeleted++;
          logger.info("voice: cleanup deleted empty channel", {
            guildId: guild.id,
            channelId
          });
        } catch (err) {
          totalFailed++;
          logger.error("voice: cleanup deletion failed", {
            guildId: guild.id,
            channelId,
            error: err.message
          });
        }
      }
    }

    if (mutated) {
      try {
        saveGuildData(guild.id, data);
      } catch (err) {
        logger.error("voice: cleanup save failed", {
          guildId: guild.id,
          error: err.message
        });
      }
    }
  }

  logger.info("voice: cleanup complete", {
    totalOrphaned,
    totalDeleted,
    totalFailed
  });
}
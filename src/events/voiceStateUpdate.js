// events/voiceStateUpdate.js
// EXECUTION-ONLY EVENT HANDLER
// No direct domain mutation. No persistence.

import { ChannelType, PermissionsBitField } from "discord.js";
import { loadGuildData } from "../utils/storage.js";
import {
  registerTempChannel,
  removeTempChannel,
  findUserTempChannel,
  acquireCreationLock,
  releaseCreationLock
} from "../tools/voice/state.js";

export default {
  name: "voiceStateUpdate",

  async execute(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    if (!guild) return;

    const member = newState.member ?? oldState.member;
    if (!member) return;

    const oldChannel = oldState.channel ?? null;
    const newChannel = newState.channel ?? null;

    if (oldChannel?.id === newChannel?.id) return;

    const data = loadGuildData(guild.id);
    if (!data || !data.voice) return;

    const voice = data.voice;
    voice.tempChannels ??= {};
    voice.lobbies ??= {};

    /* ---------- LEAVE TEMP ---------- */

    if (oldChannel && voice.tempChannels[oldChannel.id]) {
      const channel = guild.channels.cache.get(oldChannel.id) ?? null;
      const empty = channel ? channel.members.size === 0 : true;

      if (!channel || empty) {
        removeTempChannel(guild.id, oldChannel.id);
        if (channel) {
          await channel.delete().catch(() => {});
        }
      }
    }

    /* ---------- JOIN LOBBY ---------- */

    if (!newChannel) return;

    const lobby = voice.lobbies[newChannel.id];
    if (!lobby || lobby.enabled !== true) return;

    const category = guild.channels.cache.get(lobby.categoryId) ?? null;
    if (!category || category.type !== ChannelType.GuildCategory) return;

    const lockKey = `${newChannel.id}:${member.id}`;
    const acquired = acquireCreationLock(guild.id, lockKey);
    if (!acquired) return;

    try {
      const existing = findUserTempChannel(
        guild.id,
        member.id,
        newChannel.id
      );

      if (existing) {
        const ch = guild.channels.cache.get(existing) ?? null;
        if (ch) {
          await member.voice.setChannel(ch).catch(() => {});
          return;
        }
      }

      const name =
        typeof lobby.nameTemplate === "string"
          ? lobby.nameTemplate.replace("{user}", member.displayName)
          : member.displayName;

      const channel = await guild.channels
        .create({
          name,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.MoveMembers
              ]
            }
          ]
        })
        .catch(() => null);

      if (!channel) return;

      registerTempChannel(
        guild.id,
        channel.id,
        member.id,
        newChannel.id
      );

      await member.voice.setChannel(channel).catch(() => {});
    } finally {
      releaseCreationLock(guild.id, lockKey);
    }
  }
};

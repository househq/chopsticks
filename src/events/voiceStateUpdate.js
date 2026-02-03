import {
  ChannelType,
  PermissionsBitField
} from "discord.js";

import {
  loadGuildData,
  saveGuildData
} from "../utils/storage.js";

export default {
  name: "voiceStateUpdate",

  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const guildId = guild.id;
    const member = newState.member || oldState.member;
    if (!member) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (oldChannel?.id === newChannel?.id) return;

    const data = loadGuildData(guildId);
    const voice = data.voice;

    /* -------------------------------------------------
     * LEAVE TEMP CHANNEL (runs FIRST, before join logic)
     * ------------------------------------------------- */

    if (oldChannel && voice.tempChannels[oldChannel.id]) {
      const channel = guild.channels.cache.get(oldChannel.id);

      if (!channel) {
        delete voice.tempChannels[oldChannel.id];
        saveGuildData(guildId, data);
      } else {
        // if owner moved AND channel is now empty → delete
        const temp = voice.tempChannels[oldChannel.id];

        if (
          temp.ownerId === member.id &&
          channel.members.size === 0
        ) {
          delete voice.tempChannels[oldChannel.id];
          saveGuildData(guildId, data);
          await channel.delete().catch(() => {});
        }
      }
    }

    /* -----------------
     * JOIN LOBBY
     * ----------------- */

    if (
      newChannel &&
      voice.lobbies[newChannel.id] &&
      voice.lobbies[newChannel.id].enabled === true
    ) {
      const lobby = voice.lobbies[newChannel.id];
      const category = guild.channels.cache.get(lobby.categoryId);

      if (!category || category.type !== ChannelType.GuildCategory) return;

      // prevent multi-temp ownership
      for (const [id, temp] of Object.entries(voice.tempChannels)) {
        if (temp.ownerId === member.id) {
          const existing = guild.channels.cache.get(id);
          if (existing) {
            await member.voice.setChannel(existing).catch(() => {});
            return;
          }
        }
      }

      const name = lobby.nameTemplate.replace(
        "{user}",
        member.displayName
      );

      const channel = await guild.channels.create({
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
      });

      voice.tempChannels[channel.id] = {
        ownerId: member.id,
        lobbyId: newChannel.id
      };

      saveGuildData(guildId, data);

      await member.voice.setChannel(channel).catch(() => {});
    }
  }
};

import { loadGuildData } from "../utils/storage.js";
import {
  normalizeReactionRoleConfig,
  emojiKeyFromReaction,
  reactionRoleBindingKey
} from "../utils/reactionRoles.js";

export default {
  name: "messageReactionRemove",
  async execute(reaction, user) {
    if (!user || user.bot) return;

    try {
      if (reaction?.partial) await reaction.fetch();
    } catch (error) {
      console.warn("[reactionroles:remove] failed to fetch partial reaction:", error?.message || error);
      return;
    }

    const guild = reaction?.message?.guild;
    if (!guild) return;

    const emojiKey = emojiKeyFromReaction(reaction);
    if (!emojiKey) return;

    const guildData = normalizeReactionRoleConfig(await loadGuildData(guild.id));
    const key = reactionRoleBindingKey(reaction.message.channelId, reaction.message.id, emojiKey);
    const binding = guildData?.reactionRoles?.bindings?.[key];
    if (!binding?.roleId) return;

    let member = reaction.message.member;
    if (!member || member.id !== user.id) {
      try {
        member = await guild.members.fetch(user.id);
      } catch (error) {
        console.warn("[reactionroles:remove] could not fetch member:", error?.message || error);
        return;
      }
    }

    try {
      if (member.roles.cache.has(binding.roleId)) {
        await member.roles.remove(binding.roleId, "Reaction role remove");
      }
    } catch (error) {
      console.warn("[reactionroles:remove] role update failed:", error?.message || error);
    }
  }
};

import { loadGuildData } from "../utils/storage.js";
import { maybeBuildGuildFunLine } from "../fun/integrations.js";
import { maybeSyncMemberLevelRoleRewards } from "../game/levelRewards.js";
import { runGuildEventAutomations } from "../utils/automations.js";

export default {
  name: "guildMemberAdd",

  async execute(member) {
    const guildId = member.guild?.id;
    if (!guildId) return;
    const data = await loadGuildData(guildId);

    // Auto-role
    try {
      const ar = data.autorole;
      if (ar?.enabled && ar.roleId) {
        const role = member.guild.roles.cache.get(ar.roleId) ?? null;
        if (role) await member.roles.add(role).catch(() => {});
      }
    } catch {}

    // Welcome
    try {
      const w = data.welcome;
      if (w?.enabled && w.channelId) {
        const ch = member.guild.channels.cache.get(w.channelId);
        if (ch && ch.send) {
          const baseText = String(w.message || "Welcome {user}!").replace("{user}", `<@${member.id}>`);
          const flavor = await maybeBuildGuildFunLine({
            guildId,
            feature: "welcome",
            actorTag: "chopsticks",
            target: member.user?.username || member.displayName || member.id,
            intensity: 3,
            maxLength: 160,
            context: { guildName: member.guild?.name || "" }
          });
          const text = `${baseText}${flavor ? `\n${flavor}` : ""}`.slice(0, 1900);
          await ch.send(text);
        }
      }
    } catch {}

    // Level reward sync (best effort)
    try {
      await maybeSyncMemberLevelRoleRewards(member, { guildData: data, force: true });
    } catch {}

    // Event automations
    try {
      await runGuildEventAutomations({
        guild: member.guild,
        eventKey: "member_join",
        user: member.user,
        member
      });
    } catch {}
  }
};

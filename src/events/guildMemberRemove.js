import { runGuildEventAutomations } from "../utils/automations.js";

export default {
  name: "guildMemberRemove",

  async execute(member) {
    const guild = member?.guild;
    if (!guild) return;
    try {
      await runGuildEventAutomations({
        guild,
        eventKey: "member_leave",
        user: member.user,
        member
      });
    } catch {}
  }
};

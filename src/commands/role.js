import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { canModerateTarget, fetchTargetMember, moderationGuardMessage } from "../moderation/guards.js";
import { replyModError, replyModSuccess } from "../moderation/output.js";
import { dispatchModerationLog } from "../utils/modLogs.js";

export const meta = {
  guildOnly: true,
  userPerms: [PermissionFlagsBits.ManageRoles],
  category: "mod"
};

export const data = new SlashCommandBuilder()
  .setName("role")
  .setDescription("Role management")
  .addSubcommand(s =>
    s
      .setName("add")
      .setDescription("Add a role to a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
  )
  .addSubcommand(s =>
    s
      .setName("remove")
      .setDescription("Remove a role from a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const actionName = "role";
  const user = interaction.options.getUser("user", true);
  const role = interaction.options.getRole("role", true);
  const member = await fetchTargetMember(interaction.guild, user.id);
  if (!member) {
    await replyModError(interaction, {
      title: "Role Update Failed",
      summary: "User is not a member of this guild."
    });
    await dispatchModerationLog(interaction.guild, {
      action: actionName,
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason: `${sub}:${role.id}`,
      summary: "Role update failed because target user is not in the guild.",
      commandName: "role",
      channelId: interaction.channelId
    });
    return;
  }

  const gate = canModerateTarget(interaction, member);
  if (!gate.ok) {
    const failSummary = moderationGuardMessage(gate.reason);
    await replyModError(interaction, {
      title: "Role Update Blocked",
      summary: failSummary
    });
    await dispatchModerationLog(interaction.guild, {
      action: actionName,
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason: `${sub}:${role.id}`,
      summary: failSummary,
      commandName: "role",
      channelId: interaction.channelId
    });
    return;
  }

  const botHighest = interaction.guild.members.me?.roles?.highest?.position ?? -1;
  const actorHighest = interaction.member?.roles?.highest?.position ?? -1;
  const rolePosition = role?.position ?? -1;
  if (rolePosition >= actorHighest) {
    await replyModError(interaction, {
      title: "Role Update Blocked",
      summary: "Your highest role must be above the target role."
    });
    await dispatchModerationLog(interaction.guild, {
      action: actionName,
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason: `${sub}:${role.id}`,
      summary: "Actor role hierarchy is below target role.",
      commandName: "role",
      channelId: interaction.channelId
    });
    return;
  }
  if (rolePosition >= botHighest) {
    await replyModError(interaction, {
      title: "Role Update Blocked",
      summary: "Bot role hierarchy is below the target role."
    });
    await dispatchModerationLog(interaction.guild, {
      action: actionName,
      ok: false,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: user.id,
      targetTag: user.tag,
      reason: `${sub}:${role.id}`,
      summary: "Bot role hierarchy is below target role.",
      commandName: "role",
      channelId: interaction.channelId
    });
    return;
  }

  if (sub === "add") {
    try {
      await member.roles.add(role);
      await replyModSuccess(interaction, {
        title: "Role Added",
        summary: `Added **${role.name}** to **${user.tag}**.`,
        fields: [
          { name: "User", value: `${user.tag} (${user.id})` },
          { name: "Role", value: `${role.name} (${role.id})` }
        ]
      });
      await dispatchModerationLog(interaction.guild, {
        action: actionName,
        ok: true,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: user.id,
        targetTag: user.tag,
        reason: `add:${role.id}`,
        summary: `Added role ${role.name} to ${user.tag}.`,
        commandName: "role",
        channelId: interaction.channelId
      });
    } catch (err) {
      const summary = err?.message || "Unable to add role.";
      await replyModError(interaction, {
        title: "Role Update Failed",
        summary
      });
      await dispatchModerationLog(interaction.guild, {
        action: actionName,
        ok: false,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: user.id,
        targetTag: user.tag,
        reason: `add:${role.id}`,
        summary,
        commandName: "role",
        channelId: interaction.channelId
      });
    }
    return;
  }
  if (sub === "remove") {
    try {
      await member.roles.remove(role);
      await replyModSuccess(interaction, {
        title: "Role Removed",
        summary: `Removed **${role.name}** from **${user.tag}**.`,
        fields: [
          { name: "User", value: `${user.tag} (${user.id})` },
          { name: "Role", value: `${role.name} (${role.id})` }
        ]
      });
      await dispatchModerationLog(interaction.guild, {
        action: actionName,
        ok: true,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: user.id,
        targetTag: user.tag,
        reason: `remove:${role.id}`,
        summary: `Removed role ${role.name} from ${user.tag}.`,
        commandName: "role",
        channelId: interaction.channelId
      });
    } catch (err) {
      const summary = err?.message || "Unable to remove role.";
      await replyModError(interaction, {
        title: "Role Update Failed",
        summary
      });
      await dispatchModerationLog(interaction.guild, {
        action: actionName,
        ok: false,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: user.id,
        targetTag: user.tag,
        reason: `remove:${role.id}`,
        summary,
        commandName: "role",
        channelId: interaction.channelId
      });
    }
    return;
  }
}

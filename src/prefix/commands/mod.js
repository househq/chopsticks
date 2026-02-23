import { PermissionsBitField } from "discord.js";
import { reply, parseIntSafe } from "../helpers.js";
import { addWarning, listWarnings, clearWarnings } from "../../utils/moderation.js";

export default [
  {
    name: "purge",
    guildOnly: true,
    rateLimit: 5000,
    userPerms: [PermissionsBitField.Flags.ManageMessages],
    async execute(message, args) {
      const count = parseIntSafe(args[0], 1, 100);
      if (!count) return reply(message, "Count 1-100.");
      const deleted = await message.channel.bulkDelete(count, true).catch(() => null);
      await reply(message, `Deleted ${deleted?.size ?? 0} messages.`);
    }
  },
  {
    name: "slowmode",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message, args) {
      const seconds = parseIntSafe(args[0], 0, 21600);
      if (seconds === null) return reply(message, "Seconds 0-21600.");
      await message.channel.setRateLimitPerUser(seconds);
      await reply(message, `Slowmode set to ${seconds}s.`);
    }
  },
  {
    name: "kick",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.KickMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      const member = await message.guild.members.fetch(id).catch(() => null);
      if (!member) return reply(message, "User not found.");
      await member.kick(args.slice(1).join(" ") || "No reason").catch(() => null);
      await reply(message, `Kicked ${member.user.tag}`);
    }
  },
  {
    name: "ban",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.BanMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      await message.guild.members.ban(id, { reason: args.slice(1).join(" ") || "No reason" }).catch(() => null);
      await reply(message, `Banned ${id}`);
    }
  },
  {
    name: "unban",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.BanMembers],
    async execute(message, args) {
      const id = args[0];
      if (!id) return reply(message, "User ID required.");
      await message.guild.members.unban(id).catch(() => null);
      await reply(message, `Unbanned ${id}`);
    }
  },
  {
    name: "timeout",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ModerateMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      const minutes = parseIntSafe(args[1], 0, 10080);
      if (!id || minutes === null) return reply(message, "Usage: timeout <user> <minutes>");
      const member = await message.guild.members.fetch(id).catch(() => null);
      if (!member) return reply(message, "User not found.");
      const ms = minutes === 0 ? null : minutes * 60 * 1000;
      await member.timeout(ms).catch(() => null);
      await reply(message, minutes === 0 ? "Timeout cleared." : `Timed out for ${minutes}m`);
    }
  },
  {
    name: "warn",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ModerateMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      const list = await addWarning(message.guildId, id, message.author.id, args.slice(1).join(" ") || "No reason");
      await reply(message, `Warned ${id}. Total: ${list.length}`);
    }
  },
  {
    name: "warnings",
    guildOnly: true,
    rateLimit: 5000,
    userPerms: [PermissionsBitField.Flags.ModerateMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      const list = await listWarnings(message.guildId, id);
      if (!list.length) return reply(message, "No warnings.");
      const lines = list.slice(0, 10).map((w, i) => `${i + 1}. ${w.reason} by <@${w.by}>`);
      await reply(message, lines.join("\n"));
    }
  },
  {
    name: "clearwarns",
    guildOnly: true,
    rateLimit: 5000,
    userPerms: [PermissionsBitField.Flags.ModerateMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      await clearWarnings(message.guildId, id);
      await reply(message, "Warnings cleared.");
    }
  },
  {
    name: "lock",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message) {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      await reply(message, "Channel locked.");
    }
  },
  {
    name: "unlock",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message) {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      await reply(message, "Channel unlocked.");
    }
  },
  {
    name: "nick",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ManageNicknames],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      const member = await message.guild.members.fetch(id).catch(() => null);
      if (!member) return reply(message, "User not found.");
      const nick = args.slice(1).join(" ") || null;
      await member.setNickname(nick).catch(() => null);
      await reply(message, "Nickname updated.");
    }
  },
  {
    name: "softban",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.BanMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "");
      if (!id) return reply(message, "User ID required.");
      await message.guild.members.ban(id).catch(() => null);
      await message.guild.members.unban(id).catch(() => null);
      await reply(message, "Softban complete.");
    }
  },
  {
    name: "role",
    guildOnly: true,
    rateLimit: 3000,
    userPerms: [PermissionsBitField.Flags.ManageRoles],
    async execute(message, args) {
      const action = args[0];
      const userId = args[1]?.replace(/[<@!>]/g, "");
      const roleId = args[2]?.replace(/[<@&>]/g, "");
      if (!action || !userId || !roleId) return reply(message, "Usage: role <add|remove> <user> <role>");
      const member = await message.guild.members.fetch(userId).catch(() => null);
      const role = message.guild.roles.cache.get(roleId);
      if (!member || !role) return reply(message, "User/role not found.");
      if (action === "add") await member.roles.add(role).catch(() => null);
      if (action === "remove") await member.roles.remove(role).catch(() => null);
      await reply(message, "Role updated.");
    }
  }
];

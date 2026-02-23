import { reply } from "../helpers.js";

export default [
  {
    name: "serverinfo",
    guildOnly: true,
    rateLimit: 5000,
    async execute(message) {
      const g = message.guild;
      await reply(message, `**${g.name}** | Members: ${g.memberCount} | ID: ${g.id}`);
    }
  },
  {
    name: "userinfo",
    rateLimit: 3000,
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "") || message.author.id;
      const user = await message.client.users.fetch(id).catch(() => null);
      if (!user) return reply(message, "User not found.");
      await reply(message, `${user.tag} | ID: ${user.id}`);
    }
  },
  {
    name: "avatar",
    rateLimit: 3000,
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, "") || message.author.id;
      const user = await message.client.users.fetch(id).catch(() => null);
      if (!user) return reply(message, "User not found.");
      await reply(message, user.displayAvatarURL({ size: 512 }));
    }
  },
  {
    name: "roleinfo",
    guildOnly: true,
    rateLimit: 3000,
    async execute(message, args) {
      const id = args[0]?.replace(/[<@&>]/g, "");
      if (!id) return reply(message, "Role ID required.");
      const role = message.guild.roles.cache.get(id);
      if (!role) return reply(message, "Role not found.");
      await reply(message, `${role.name} | Members: ${role.members.size} | ID: ${role.id}`);
    }
  },
  {
    name: "botinfo",
    rateLimit: 5000,
    async execute(message) {
      await reply(message, `Guilds: ${message.client.guilds.cache.size} | Users: ${message.client.users.cache.size}`);
    }
  }
];

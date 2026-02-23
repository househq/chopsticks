import { PermissionsBitField } from "discord.js";
import { reply, dm, parseIntSafe } from "../helpers.js";
import { loadGuildData, saveGuildData } from "../../utils/storage.js";
import { schedule } from "../../utils/scheduler.js";
import { normalizePrefixValue } from "../hardening.js";

export default [
  {
    name: "poll",
    rateLimit: 10000,
    async execute(message, args) {
      const text = args.join(" ");
      const [q, opts] = text.split("|").map(s => s.trim());
      if (!q || !opts) return reply(message, "Usage: poll Question | opt1, opt2");
      const items = opts.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10);
      if (items.length < 2) return reply(message, "Need at least 2 options.");
      const emoji = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
      const lines = items.map((o, i) => `${emoji[i]} ${o}`).join("\n");
      const msg = await message.channel.send(`**${q}**\n${lines}`);
      for (let i = 0; i < items.length; i++) await msg.react(emoji[i]).catch(() => {});
    }
  },
  {
    name: "giveaway",
    guildOnly: true,
    rateLimit: 10000,
    userPerms: [PermissionsBitField.Flags.ManageGuild],
    async execute(message, args) {
      const mins = parseIntSafe(args[0], 1, 10080);
      const winners = parseIntSafe(args[1], 1, 10);
      const prize = args.slice(2).join(" ");
      if (!mins || !winners || !prize) return reply(message, "Usage: giveaway <minutes> <winners> <prize>");
      const msg = await message.channel.send(`🎉 **GIVEAWAY** 🎉\nPrize: **${prize}**\nEnds in ${mins}m`);
      await msg.react("🎉").catch(() => {});
      schedule(`giveaway:${msg.id}`, mins * 60 * 1000, async () => {
        const m = await message.channel.messages.fetch(msg.id).catch(() => null);
        if (!m) return;
        const reaction = m.reactions.cache.get("🎉");
        const users = await reaction.users.fetch();
        const pool = users.filter(u => !u.bot).map(u => u.id);
        const picked = [];
        while (pool.length && picked.length < winners) {
          picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        const text = picked.length ? picked.map(id => `<@${id}>`).join(", ") : "No entries.";
        await m.reply(`🎉 Winner(s): ${text}`);
      });
    }
  },
  {
    name: "remind",
    rateLimit: 5000,
    async execute(message, args) {
      const mins = parseIntSafe(args[0], 1, 10080);
      const text = args.slice(1).join(" ");
      if (!mins || !text) return reply(message, "Usage: remind <minutes> <text>");
      schedule(`remind:${message.author.id}:${Date.now()}`, mins * 60 * 1000, async () => {
        await dm(message.author, `⏰ Reminder: ${text}`);
      });
      await reply(message, `Okay, I will remind you in ${mins} minutes.`);
    }
  },
  {
    name: "welcome",
    guildOnly: true,
    rateLimit: 5000,
    userPerms: [PermissionsBitField.Flags.ManageGuild],
    async execute(message, args) {
      const sub = args[0];
      const data = await loadGuildData(message.guildId);
      data.welcome ??= { enabled: false, channelId: null, message: "Welcome {user}!" };
      if (sub === "set") {
        const channelId = args[1]?.replace(/[<#>]/g, "");
        if (!channelId) return reply(message, "Channel ID required.");
        data.welcome.channelId = channelId;
        data.welcome.enabled = true;
        await saveGuildData(message.guildId, data);
        return reply(message, "Welcome channel set.");
      }
      if (sub === "message") {
        const msg = args.slice(1).join(" ");
        data.welcome.message = msg;
        data.welcome.enabled = true;
        await saveGuildData(message.guildId, data);
        return reply(message, "Welcome message set.");
      }
      if (sub === "disable") {
        data.welcome.enabled = false;
        await saveGuildData(message.guildId, data);
        return reply(message, "Welcome disabled.");
      }
      return reply(message, "Usage: welcome <set|message|disable>");
    }
  },
  {
    name: "autorole",
    guildOnly: true,
    rateLimit: 5000,
    userPerms: [PermissionsBitField.Flags.ManageGuild],
    async execute(message, args) {
      const sub = args[0];
      const data = await loadGuildData(message.guildId);
      data.autorole ??= { enabled: false, roleId: null };
      if (sub === "set") {
        const roleId = args[1]?.replace(/[<@&>]/g, "");
        if (!roleId) return reply(message, "Role ID required.");
        data.autorole.roleId = roleId;
        data.autorole.enabled = true;
        await saveGuildData(message.guildId, data);
        return reply(message, "Auto-role set.");
      }
      if (sub === "disable") {
        data.autorole.enabled = false;
        await saveGuildData(message.guildId, data);
        return reply(message, "Auto-role disabled.");
      }
      return reply(message, "Usage: autorole <set|disable>");
    }
  },
  {
    name: "prefix",
    guildOnly: true,
    rateLimit: 5000,
    userPerms: [PermissionsBitField.Flags.ManageGuild],
    async execute(message, args) {
      const sub = args[0];
      const data = await loadGuildData(message.guildId);
      if (sub === "set") {
        const p = args[1];
        if (!p) return reply(message, "Usage: prefix set <value>");
        const normalized = normalizePrefixValue(p);
        if (!normalized.ok) return reply(message, normalized.error);
        data.prefix.value = normalized.value;
        await saveGuildData(message.guildId, data);
        return reply(message, `Prefix set to ${data.prefix.value}`);
      }
      if (sub === "reset") {
        data.prefix.value = "!";
        await saveGuildData(message.guildId, data);
        return reply(message, "Prefix reset.");
      }
      return reply(message, `Prefix: ${data.prefix.value || "!"}`);
    }
  }
];

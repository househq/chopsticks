import { PermissionFlagsBits } from "discord.js";
import { loadGuildData } from "../utils/storage.js";

const LEVEL_REWARD_SYNC_COOLDOWN_MS = 30_000;
const lastSyncByMember = new Map();

function toLevelInt(value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 1000) return null;
  return n;
}

function safeRoleId(value) {
  const out = String(value || "").trim();
  return /^\d{16,21}$/.test(out) ? out : null;
}

export function listLevelRoleRewards(guildData) {
  const map = guildData?.levels?.roleRewards;
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.entries(map)
    .map(([levelKey, roleId]) => {
      const level = toLevelInt(levelKey);
      const rid = safeRoleId(roleId);
      if (!level || !rid) return null;
      return { level, roleId: rid };
    })
    .filter(Boolean)
    .sort((a, b) => a.level - b.level);
}

export function setLevelRoleReward(guildData, level, roleId) {
  const lvl = toLevelInt(level);
  const rid = safeRoleId(roleId);
  if (!lvl || !rid) throw new Error("Invalid level reward config.");
  guildData.levels ??= {};
  guildData.levels.roleRewards ??= {};
  guildData.levels.roleRewards[String(lvl)] = rid;
  return { level: lvl, roleId: rid };
}

export function removeLevelRoleReward(guildData, level) {
  const lvl = toLevelInt(level);
  if (!lvl) throw new Error("Invalid level.");
  const key = String(lvl);
  const existing = guildData?.levels?.roleRewards?.[key];
  if (!existing) return false;
  delete guildData.levels.roleRewards[key];
  return true;
}

async function resolveRole(guild, roleId) {
  if (!guild || !roleId) return null;
  const cached = guild.roles.cache.get(roleId);
  if (cached) return cached;
  try {
    return await guild.roles.fetch(roleId);
  } catch {
    return null;
  }
}

export async function applyLevelRoleRewardsToMember(member, { level, guildData } = {}) {
  if (!member?.guild) return { ok: false, reason: "missing-member" };
  const guild = member.guild;
  const data = guildData || (await loadGuildData(guild.id));
  const rewards = listLevelRoleRewards(data);
  if (!rewards.length) return { ok: true, level: Number(level || 1), matched: 0, added: 0, removed: 0, skipped: 0 };

  const me = guild.members.me || null;
  if (!me) return { ok: false, reason: "missing-bot-member" };
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, reason: "missing-manage-roles" };
  }

  const resolvedLevel = Math.max(1, Math.trunc(Number(level) || 1));
  const targetRoleIds = new Set(rewards.filter(r => resolvedLevel >= r.level).map(r => r.roleId));
  const configuredRoleIds = new Set(rewards.map(r => r.roleId));

  let matched = 0;
  let added = 0;
  let removed = 0;
  let skipped = 0;

  for (const roleId of configuredRoleIds) {
    const role = await resolveRole(guild, roleId);
    if (!role || role.managed || me.roles.highest.comparePositionTo(role) <= 0) {
      skipped += 1;
      continue;
    }

    matched += 1;
    const hasRole = member.roles.cache.has(roleId);
    const shouldHave = targetRoleIds.has(roleId);

    try {
      if (shouldHave && !hasRole) {
        await member.roles.add(roleId, "Level reward reached");
        added += 1;
      } else if (!shouldHave && hasRole) {
        await member.roles.remove(roleId, "Level reward no longer applicable");
        removed += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  return { ok: true, level: resolvedLevel, matched, added, removed, skipped };
}

export async function syncMemberLevelRoleRewards(member, { guildData, level } = {}) {
  if (!member?.guild) return { ok: false, reason: "missing-member" };
  let resolvedLevel = level;
  if (!Number.isFinite(Number(resolvedLevel)) || Number(resolvedLevel) < 1) {
    const { getGameProfile } = await import("./profile.js");
    const profile = await getGameProfile(member.id);
    resolvedLevel = Math.max(1, Number(profile?.level) || 1);
  }
  return await applyLevelRoleRewardsToMember(member, { level: resolvedLevel, guildData });
}

export async function maybeSyncMemberLevelRoleRewards(member, { guildData, level, force = false } = {}) {
  if (!member?.guild) return { ok: false, reason: "missing-member" };
  const key = `${member.guild.id}:${member.id}`;
  const now = Date.now();
  if (!force) {
    const last = Number(lastSyncByMember.get(key) || 0);
    if (now - last < LEVEL_REWARD_SYNC_COOLDOWN_MS) {
      return { ok: true, skipped: true, reason: "cooldown" };
    }
  }
  lastSyncByMember.set(key, now);
  return await syncMemberLevelRoleRewards(member, { guildData, level });
}

export async function syncUserLevelRewardsAcrossGuilds(userId, level) {
  const client = global.client;
  if (!client?.guilds?.cache) return { ok: false, synced: 0 };

  let synced = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const guildData = await loadGuildData(guild.id);
      if (!listLevelRoleRewards(guildData).length) continue;

      let member = guild.members.cache.get(userId) || null;
      if (!member) {
        try {
          member = await guild.members.fetch(userId);
        } catch {
          member = null;
        }
      }
      if (!member) continue;

      await applyLevelRoleRewardsToMember(member, { level, guildData });
      synced += 1;
    } catch {}
  }
  return { ok: true, synced };
}

import { REST, Routes, PermissionsBitField } from "discord.js";
import { config } from "dotenv";
import { canRunCommand } from "../../src/utils/permissions.js";

config();

const DISCORD_TOKEN = String(process.env.DISCORD_TOKEN || "").trim();
const CLIENT_ID = String(process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || "").trim();
const GUILD_ID = String(
  process.env.PUBLIC_TEST_GUILD_ID || process.env.STAGING_GUILD_ID || process.env.DEV_GUILD_ID || process.env.GUILD_ID || ""
).trim();

const ADMIN_USER_ID = String(process.env.ADMIN_USER_ID || "").trim();
const PUBLIC_USER_ID = String(process.env.PUBLIC_USER_ID || "").trim();
const STRICT = String(process.env.PERSONA_STRICT || "true").toLowerCase() !== "false";
const ALLOW_SYNTHETIC_PUBLIC = String(process.env.PERSONA_ALLOW_SYNTHETIC_PUBLIC || "true").toLowerCase() !== "false";

const REQUIRED_COMMANDS = [
  "help",
  "agents",
  "config",
  "purge",
  "scripts",
  "pools",
  "ping",
  "fun",
  "music"
];

const MATRIX = {
  adminAllow: ["agents", "config", "purge", "scripts", "pools", "help"],
  publicAllow: ["help", "ping", "fun", "music"],
  publicDeny: ["agents", "config", "purge", "scripts"]
};

function fail(message, details = null) {
  console.error(`❌ ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

if (!DISCORD_TOKEN) fail("DISCORD_TOKEN missing");
if (!CLIENT_ID) fail("CLIENT_ID (or DISCORD_CLIENT_ID) missing");
if (!GUILD_ID) fail("PUBLIC_TEST_GUILD_ID (or STAGING_GUILD_ID/DEV_GUILD_ID/GUILD_ID) missing");

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

function toBigIntSafe(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function computeMemberPermissions(member, guildId, roles) {
  const roleMap = new Map((Array.isArray(roles) ? roles : []).map(r => [String(r.id), r]));
  const memberRoleIds = new Set((member?.roles || []).map(String));
  memberRoleIds.add(String(guildId)); // @everyone

  let bits = 0n;
  for (const roleId of memberRoleIds) {
    const role = roleMap.get(roleId);
    if (!role?.permissions) continue;
    bits |= toBigIntSafe(role.permissions);
  }
  return new PermissionsBitField(bits);
}

function toMockInteraction(guildId, roleIds, permissions) {
  const roleCache = new Map((Array.isArray(roleIds) ? roleIds : []).map(id => [String(id), { id: String(id) }]));
  return {
    guildId,
    inGuild: () => true,
    member: {
      permissions,
      roles: {
        cache: roleCache
      }
    }
  };
}

async function loadCommandMeta(commandName) {
  const moduleUrl = new URL(`../../src/commands/${commandName}.js`, import.meta.url);
  const mod = await import(moduleUrl.href);
  return mod?.meta ?? {};
}

async function resolvePersonaMembers(guild, roles) {
  const adminTargetId = ADMIN_USER_ID || String(guild.owner_id || "");
  if (!adminTargetId) {
    fail("Unable to resolve admin persona. Set ADMIN_USER_ID.");
  }

  const adminMember = await rest.get(Routes.guildMember(GUILD_ID, adminTargetId));
  const adminPerms = computeMemberPermissions(adminMember, GUILD_ID, roles);

  let publicMember = null;
  let publicSource = null;

  if (PUBLIC_USER_ID) {
    publicMember = await rest.get(Routes.guildMember(GUILD_ID, PUBLIC_USER_ID));
    publicSource = "PUBLIC_USER_ID";
  } else {
    try {
      const members = await rest.get(Routes.guildMembers(GUILD_ID), {
        query: { limit: 200 }
      });

      if (Array.isArray(members)) {
        publicMember = members.find(m => {
          if (!m || !m.user || m.user.bot) return false;
          if (String(m.user.id) === String(adminMember.user?.id || adminTargetId)) return false;
          const perms = computeMemberPermissions(m, GUILD_ID, roles);
          return !perms.has(PermissionsBitField.Flags.Administrator);
        }) || null;

        if (publicMember) publicSource = "guildMembers-scan";
      }
    } catch {
      // fall through to strict validation below
    }
  }

  if (!publicMember && !ALLOW_SYNTHETIC_PUBLIC && STRICT) {
    fail(
      "Unable to resolve public-user persona automatically. Set PUBLIC_USER_ID to a non-admin guild member.",
      { guildId: GUILD_ID }
    );
  }

  return {
    admin: {
      id: String(adminMember.user?.id || adminTargetId),
      roleIds: Array.isArray(adminMember.roles) ? adminMember.roles.map(String) : [],
      permissions: adminPerms
    },
    publicUser: publicMember
      ? {
          id: String(publicMember.user?.id),
          roleIds: Array.isArray(publicMember.roles) ? publicMember.roles.map(String) : [],
          permissions: computeMemberPermissions(publicMember, GUILD_ID, roles),
          source: publicSource
        }
      : ALLOW_SYNTHETIC_PUBLIC
        ? {
            id: "synthetic-public",
            roleIds: [],
            permissions: computeMemberPermissions({ roles: [] }, GUILD_ID, roles),
            source: "synthetic-everyone"
          }
        : null
  };
}

async function evalMatrix(personaName, persona, checks, expected) {
  const results = [];

  for (const commandName of checks) {
    const meta = await loadCommandMeta(commandName);
    const interaction = toMockInteraction(GUILD_ID, persona.roleIds, persona.permissions);
    const gate = await canRunCommand(interaction, commandName, meta);
    const allowed = Boolean(gate?.ok);
    const pass = expected === "allow" ? allowed : !allowed;

    results.push({
      command: commandName,
      expected,
      actual: allowed ? "allow" : "deny",
      reason: gate?.reason || null,
      pass
    });
  }

  return {
    persona: personaName,
    expected,
    pass: results.every(r => r.pass),
    results
  };
}

async function main() {
  const me = await rest.get(Routes.user("@me"));
  if (!me?.id) fail("Unable to authenticate bot token");

  const guild = await rest.get(Routes.guild(GUILD_ID));
  const roles = await rest.get(Routes.guildRoles(GUILD_ID));

  const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
  const globalCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
  const effectiveNames = new Set([
    ...((Array.isArray(guildCommands) ? guildCommands : []).map(c => c.name)),
    ...((Array.isArray(globalCommands) ? globalCommands : []).map(c => c.name))
  ]);

  const missingCommands = REQUIRED_COMMANDS.filter(name => !effectiveNames.has(name));
  if (missingCommands.length > 0) {
    fail("Persona smoke aborted: missing required commands", {
      missingCommands,
      guildCommandCount: Array.isArray(guildCommands) ? guildCommands.length : 0,
      globalCommandCount: Array.isArray(globalCommands) ? globalCommands.length : 0
    });
  }

  const personas = await resolvePersonaMembers(guild, roles);

  const adminAdminCheck = personas.admin.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!adminAdminCheck) {
    fail("Admin persona does not have Administrator permission", {
      adminUserId: personas.admin.id
    });
  }

  const report = {
    ok: true,
    guild: {
      id: guild.id,
      name: guild.name
    },
    botUserId: me.id,
    personas: {
      adminUserId: personas.admin.id,
      publicUserId: personas.publicUser?.id || null,
      publicResolution: personas.publicUser?.source || null
    },
    commandSurface: {
      guildCommandCount: Array.isArray(guildCommands) ? guildCommands.length : 0,
      globalCommandCount: Array.isArray(globalCommands) ? globalCommands.length : 0
    },
    matrix: []
  };

  const adminAllow = await evalMatrix("admin", personas.admin, MATRIX.adminAllow, "allow");
  report.matrix.push(adminAllow);

  if (personas.publicUser) {
    const publicAllow = await evalMatrix("public", personas.publicUser, MATRIX.publicAllow, "allow");
    const publicDeny = await evalMatrix("public", personas.publicUser, MATRIX.publicDeny, "deny");
    report.matrix.push(publicAllow, publicDeny);
  } else {
    report.ok = false;
    report.matrix.push({
      persona: "public",
      expected: "mixed",
      pass: false,
      results: [],
      note: "Public persona unavailable; set PUBLIC_USER_ID"
    });
  }

  report.ok = report.ok && report.matrix.every(group => group.pass);

  if (!report.ok) {
    fail("Persona smoke failed", report);
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch(err => {
  fail(err?.message || String(err));
});

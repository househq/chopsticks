import { PermissionsBitField } from "discord.js";

export const OWNER_PERMISSION_FIELDS = [
  {
    key: "manageChannels",
    option: "owner_manage_channels",
    label: "Manage Channels",
    overwriteKey: "ManageChannels",
    flag: PermissionsBitField.Flags.ManageChannels,
    defaultValue: true
  },
  {
    key: "moveMembers",
    option: "owner_move_members",
    label: "Move Members",
    overwriteKey: "MoveMembers",
    flag: PermissionsBitField.Flags.MoveMembers,
    defaultValue: true
  },
  {
    key: "muteMembers",
    option: "owner_mute_members",
    label: "Mute Members",
    overwriteKey: "MuteMembers",
    flag: PermissionsBitField.Flags.MuteMembers,
    defaultValue: false
  },
  {
    key: "deafenMembers",
    option: "owner_deafen_members",
    label: "Deafen Members",
    overwriteKey: "DeafenMembers",
    flag: PermissionsBitField.Flags.DeafenMembers,
    defaultValue: false
  },
  {
    key: "prioritySpeaker",
    option: "owner_priority_speaker",
    label: "Priority Speaker",
    overwriteKey: "PrioritySpeaker",
    flag: PermissionsBitField.Flags.PrioritySpeaker,
    defaultValue: false
  }
];

export function defaultOwnerPermissions() {
  const out = {};
  for (const field of OWNER_PERMISSION_FIELDS) {
    out[field.key] = field.defaultValue;
  }
  return out;
}

export function coerceOwnerPermissions(input) {
  const out = defaultOwnerPermissions();
  if (!input || typeof input !== "object") return out;

  for (const field of OWNER_PERMISSION_FIELDS) {
    if (typeof input[field.key] === "boolean") {
      out[field.key] = input[field.key];
    }
  }
  return out;
}

export function applyOwnerPermissionPatch(current, patch) {
  const out = coerceOwnerPermissions(current);
  if (!patch || typeof patch !== "object") return out;

  for (const field of OWNER_PERMISSION_FIELDS) {
    if (typeof patch[field.key] === "boolean") {
      out[field.key] = patch[field.key];
    }
  }
  return out;
}

export function ownerPermissionOverwrite(perms) {
  const normalized = coerceOwnerPermissions(perms);
  const overwrite = {};
  for (const field of OWNER_PERMISSION_FIELDS) {
    if (normalized[field.key]) {
      overwrite[field.overwriteKey] = true;
    }
  }
  return overwrite;
}

export function ownerPermissionFlags(perms) {
  const normalized = coerceOwnerPermissions(perms);
  return OWNER_PERMISSION_FIELDS
    .filter(field => normalized[field.key])
    .map(field => field.flag);
}

export function describeOwnerPermissions(perms) {
  const normalized = coerceOwnerPermissions(perms);
  const enabled = OWNER_PERMISSION_FIELDS
    .filter(field => normalized[field.key])
    .map(field => field.label);

  return enabled.length ? enabled.join(", ") : "None";
}

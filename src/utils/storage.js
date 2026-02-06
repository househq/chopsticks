import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SCHEMA_VERSION = 1;
const MAX_SAVE_RETRIES = 5;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function guildFile(guildId) {
  return path.join(DATA_DIR, `${guildId}.json`);
}

function baseData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    rev: 0,
    voice: {
      lobbies: {},
      tempChannels: {}
    }
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeData(input) {
  const raw = isPlainObject(input) ? input : {};
  const out = { ...raw };

  const legacyLobbies = isPlainObject(raw.lobbies) ? raw.lobbies : null;
  const legacyTemp = isPlainObject(raw.tempChannels) ? raw.tempChannels : null;

  let voice = isPlainObject(raw.voice) ? { ...raw.voice } : {};
  if (!isPlainObject(voice.lobbies) && legacyLobbies) voice.lobbies = legacyLobbies;
  if (!isPlainObject(voice.tempChannels) && legacyTemp) voice.tempChannels = legacyTemp;

  if (!isPlainObject(voice.lobbies)) voice.lobbies = {};
  if (!isPlainObject(voice.tempChannels)) voice.tempChannels = {};

  out.voice = voice;

  const schemaVersion = Number.isInteger(raw.schemaVersion)
    ? raw.schemaVersion
    : SCHEMA_VERSION;
  out.schemaVersion = schemaVersion;

  const rev = Number.isInteger(raw.rev) && raw.rev >= 0 ? raw.rev : 0;
  out.rev = rev;

  // Remove legacy top-level keys once migrated.
  if ("lobbies" in out) delete out.lobbies;
  if ("tempChannels" in out) delete out.tempChannels;

  return out;
}

function detectNeedsMigration(raw, normalized) {
  if (!isPlainObject(raw)) return true;
  if (!Number.isInteger(raw.schemaVersion)) return true;
  if (!Number.isInteger(raw.rev)) return true;
  if (!isPlainObject(raw.voice)) return true;
  if (!isPlainObject(raw.voice.lobbies)) return true;
  if (!isPlainObject(raw.voice.tempChannels)) return true;
  if ("lobbies" in raw || "tempChannels" in raw) return true;

  // Compare minimal keys to detect schema normalization adjustments.
  if (normalized.schemaVersion !== raw.schemaVersion) return true;
  if (normalized.rev !== raw.rev) return true;
  return false;
}

function readFileIfValid(file) {
  if (!fs.existsSync(file)) return { data: null, needsWrite: true };

  try {
    const rawText = fs.readFileSync(file, "utf8");
    const raw = JSON.parse(rawText);
    const normalized = normalizeData(raw);
    const needsWrite = detectNeedsMigration(raw, normalized);
    return { data: normalized, needsWrite };
  } catch {
    return { data: null, needsWrite: true };
  }
}

function readGuildDataWithFallback(file) {
  const primary = readFileIfValid(file);
  if (primary.data) return primary;

  const bak = `${file}.bak`;
  const fallback = readFileIfValid(bak);
  if (fallback.data) return { data: fallback.data, needsWrite: true };

  return { data: baseData(), needsWrite: true };
}

function writeAtomicJson(file, data) {
  const tmp = `${file}.tmp`;
  const bak = `${file}.bak`;
  const json = JSON.stringify(data, null, 2);

  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, json, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  if (fs.existsSync(file)) {
    try {
      fs.copyFileSync(file, bak);
    } catch {
      // Best-effort backup.
    }
  }

  fs.renameSync(tmp, file);
}

function mergeOnConflict(latest, incoming) {
  const a = normalizeData(latest);
  const b = normalizeData(incoming);

  const mergedVoice = {
    ...a.voice,
    ...b.voice,
    lobbies: { ...a.voice.lobbies, ...b.voice.lobbies },
    tempChannels: { ...a.voice.tempChannels, ...b.voice.tempChannels }
  };

  return {
    ...a,
    ...b,
    voice: mergedVoice,
    schemaVersion: SCHEMA_VERSION
  };
}

export function loadGuildData(guildId) {
  ensureDir();
  const file = guildFile(guildId);
  const { data } = readGuildDataWithFallback(file);
  return data ?? baseData();
}

export function ensureGuildData(guildId) {
  ensureDir();
  const file = guildFile(guildId);
  const { data, needsWrite } = readGuildDataWithFallback(file);
  if (needsWrite) {
    try {
      saveGuildData(guildId, data);
    } catch {
      // If a concurrent writer wins, caller can re-load.
    }
  }
  return data;
}

export function saveGuildData(guildId, data) {
  ensureDir();
  const file = guildFile(guildId);

  let next = normalizeData(data);

  for (let attempt = 0; attempt < MAX_SAVE_RETRIES; attempt += 1) {
    const current = readGuildDataWithFallback(file).data ?? baseData();
    const expectedRev = Number.isInteger(next.rev) ? next.rev : current.rev;

    if (current.rev !== expectedRev) {
      next = mergeOnConflict(current, next);
      next.rev = current.rev;
      continue;
    }

    const toWrite = {
      ...next,
      schemaVersion: SCHEMA_VERSION,
      rev: current.rev + 1
    };

    writeAtomicJson(file, toWrite);
    return toWrite;
  }

  throw new Error("save-conflict");
}

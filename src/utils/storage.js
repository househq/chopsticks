import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

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
    voice: {
      lobbies: {},
      tempChannels: {}
    }
  };
}

function validate(data) {
  return (
    data &&
    typeof data === "object" &&
    data.voice &&
    typeof data.voice.lobbies === "object" &&
    typeof data.voice.tempChannels === "object"
  );
}

export function loadGuildData(guildId) {
  ensureDir();
  const file = guildFile(guildId);

  if (!fs.existsSync(file)) {
    return baseData();
  }

  try {
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    return validate(data) ? data : baseData();
  } catch {
    return baseData();
  }
}

export function saveGuildData(guildId, data) {
  ensureDir();
  if (!validate(data)) {
    throw new Error("Invalid guild data");
  }

  fs.writeFileSync(
    guildFile(guildId),
    JSON.stringify(data, null, 2)
  );
}

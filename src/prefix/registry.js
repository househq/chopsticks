import {
  isValidAliasName,
  normalizeAliasName,
  normalizePrefixValue,
  resolveAliasedCommand
} from "./hardening.js";

import metaCommands from "./commands/meta.js";
import utilityCommands from "./commands/utility.js";
import funCommands from "./commands/fun.js";
import infoCommands from "./commands/info.js";
import modCommands from "./commands/mod.js";
import serverCommands from "./commands/server.js";
import mediaCommands from "./commands/media.js";
import economyCommands from "./commands/economy.js";

export async function getPrefixCommands() {
  const map = new Map();
  const allCommands = [
    ...metaCommands,
    ...utilityCommands,
    ...funCommands,
    ...infoCommands,
    ...modCommands,
    ...serverCommands,
    ...mediaCommands,
    ...economyCommands,
  ];
  for (const cmdDef of allCommands) {
    map.set(cmdDef.name, cmdDef);
  }
  return map;
}

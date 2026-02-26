// test/unit/map-c1-command-taxonomy.test.js
// MAP Cycle 1 — Command Architecture Pod: taxonomy enforcement

import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = resolve(__dirname, "../../src/commands");

function getCommandFiles() {
  return readdirSync(commandsDir).filter(f => f.endsWith(".js"));
}

function src(relPath) {
  return readFileSync(resolve(__dirname, `../../${relPath}`), "utf8");
}

// ── Canonical category enum ────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "admin", "mod", "safety",
  "agents", "ai",
  "economy", "game", "social",
  "music", "voice",
  "fun", "community",
  "utility", "tools", "info",
  "media", "entertainment",
  "internal",
]);

// Legacy values that are NO LONGER valid
const LEGACY_CATEGORIES = new Set([
  "util", "server", "pools", "assistant", "profile", "core", "admin",
]);
// Note: "admin" is still valid — only the old duplicates/typos are legacy

describe("MAP-C1 — commandCategories.js canonical enum", () => {
  it("exports CATEGORIES object with all required keys", () => {
    const code = src("src/utils/commandCategories.js");
    const requiredKeys = ["ADMIN", "MOD", "SAFETY", "AGENTS", "AI", "ECONOMY", "GAME", "SOCIAL",
      "MUSIC", "VOICE", "FUN", "COMMUNITY", "UTILITY", "TOOLS", "INFO", "MEDIA", "ENTERTAINMENT", "INTERNAL"];
    for (const key of requiredKeys) {
      assert.ok(code.includes(`${key}:`), `CATEGORIES must have ${key}`);
    }
  });

  it("exports VALID_CATEGORIES set", () => {
    const code = src("src/utils/commandCategories.js");
    assert.ok(code.includes("VALID_CATEGORIES"), "must export VALID_CATEGORIES");
  });

  it("exports isValidCategory function", () => {
    const code = src("src/utils/commandCategories.js");
    assert.ok(code.includes("export function isValidCategory"), "must export isValidCategory");
  });

  it("exports CATEGORY_MIGRATION map for legacy values", () => {
    const code = src("src/utils/commandCategories.js");
    assert.ok(code.includes("CATEGORY_MIGRATION"), "must export CATEGORY_MIGRATION");
  });
});

describe("MAP-C1 — COMMAND_TAXONOMY.md exists and is complete", () => {
  it("taxonomy doc exists", () => {
    const code = src("docs/COMMAND_TAXONOMY.md");
    assert.ok(code.length > 1000, "COMMAND_TAXONOMY.md must exist and have content");
  });

  it("lists all 18 locked slash commands", () => {
    const code = src("docs/COMMAND_TAXONOMY.md");
    const required = ["/help", "/setup", "/dashboard", "/config", "/agents", "/pools",
      "/agentkeys", "/mod", "/antinuke", "/tickets", "/music", "/voice",
      "/ai", "/verify", "/profile", "/levels", "/game", "/stats"];
    for (const cmd of required) {
      assert.ok(code.includes(cmd), `taxonomy doc must list locked command ${cmd}`);
    }
  });

  it("documents canonical category enum", () => {
    const code = src("docs/COMMAND_TAXONOMY.md");
    assert.ok(code.includes("admin") && code.includes("mod") && code.includes("safety"), "doc must show core categories");
  });
});

describe("MAP-C1 — all slash command meta.category values are canonical", () => {
  const files = getCommandFiles();
  const invalid = [];

  for (const file of files) {
    const code = readFileSync(resolve(commandsDir, file), "utf8");
    const m = code.match(/category:\s*['"]([^'"]+)['"]/);
    if (!m) continue;
    const cat = m[1];
    if (!VALID_CATEGORIES.has(cat)) {
      invalid.push(`${file}: "${cat}"`);
    }
  }

  it("no command uses a non-canonical category value", () => {
    assert.deepStrictEqual(
      invalid,
      [],
      `Commands with invalid categories:\n${invalid.join("\n")}`
    );
  });

  it("no command uses legacy 'util' category", () => {
    const withLegacy = files.filter(f => {
      const code = readFileSync(resolve(commandsDir, f), "utf8");
      return /category:\s*['"]util['"]/.test(code);
    });
    assert.deepStrictEqual(withLegacy, [], `Commands still using 'util': ${withLegacy.join(", ")}`);
  });

  it("no command uses legacy 'server' category", () => {
    const withLegacy = files.filter(f => {
      const code = readFileSync(resolve(commandsDir, f), "utf8");
      return /category:\s*['"]server['"]/.test(code);
    });
    assert.deepStrictEqual(withLegacy, [], `Commands still using 'server': ${withLegacy.join(", ")}`);
  });

  it("no command uses legacy 'pools' category", () => {
    const withLegacy = files.filter(f => {
      const code = readFileSync(resolve(commandsDir, f), "utf8");
      return /category:\s*['"]pools['"]/.test(code);
    });
    assert.deepStrictEqual(withLegacy, [], `Commands still using 'pools': ${withLegacy.join(", ")}`);
  });

  it("no command uses legacy 'assistant' category", () => {
    const withLegacy = files.filter(f => {
      const code = readFileSync(resolve(commandsDir, f), "utf8");
      return /category:\s*['"]assistant['"]/.test(code);
    });
    assert.deepStrictEqual(withLegacy, [], `Commands still using 'assistant': ${withLegacy.join(", ")}`);
  });

  it("no command uses legacy 'core' category", () => {
    const withLegacy = files.filter(f => {
      const code = readFileSync(resolve(commandsDir, f), "utf8");
      return /category:\s*['"]core['"]/.test(code);
    });
    assert.deepStrictEqual(withLegacy, [], `Commands still using 'core': ${withLegacy.join(", ")}`);
  });
});

describe("MAP-C1 — help.js is updated as unified discoverability hub", () => {
  it("imports commandCategories", () => {
    const code = src("src/commands/help.js");
    assert.ok(code.includes("commandCategories"), "help.js must import commandCategories");
  });

  it("has /help prefix subcommand", () => {
    const code = src("src/commands/help.js");
    assert.ok(code.includes('"prefix"') && code.includes("Prefix"), "help.js must have prefix subcommand");
  });

  it("uses TAXONOMY_TO_BROAD mapping", () => {
    const code = src("src/commands/help.js");
    assert.ok(code.includes("TAXONOMY_TO_BROAD"), "help.js must use TAXONOMY_TO_BROAD");
  });

  it("imports getPrefixCommands for prefix discoverability", () => {
    const code = src("src/commands/help.js");
    assert.ok(code.includes("getPrefixCommands"), "help.js must import getPrefixCommands");
  });
});

describe("MAP-C1 — all 111 commands have meta export with category", () => {
  it("every command file has meta.category", () => {
    const files = getCommandFiles();
    const missing = [];
    for (const file of files) {
      const code = readFileSync(resolve(commandsDir, file), "utf8");
      if (!code.includes("category:")) {
        missing.push(file);
      }
    }
    assert.deepStrictEqual(missing, [], `Commands missing category: ${missing.join(", ")}`);
  });

  it("every command file has meta export", () => {
    const files = getCommandFiles();
    const missing = [];
    for (const file of files) {
      const code = readFileSync(resolve(commandsDir, file), "utf8");
      if (!code.includes("export const meta")) {
        missing.push(file);
      }
    }
    assert.deepStrictEqual(missing, [], `Commands missing meta export: ${missing.join(", ")}`);
  });
});

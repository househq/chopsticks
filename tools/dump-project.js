import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "PROJECT_DUMP.txt");

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage"
]);

const EXCLUDE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

const ALLOWED_EXT = new Set([
  ".js",
  ".ts",
  ".json",
  ".md",
  ".env",
  ".env.example"
]);

let output = "";

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);

    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(full);
      continue;
    }

    if (EXCLUDE_FILES.has(e.name)) continue;
    if (!ALLOWED_EXT.has(path.extname(e.name))) continue;

    const content = fs.readFileSync(full, "utf8");

    output += "\n";
    output += "============================================================\n";
    output += `FILE: ${rel}\n`;
    output += "============================================================\n";
    output += content + "\n";
  }
}

walk(ROOT);
fs.writeFileSync(OUT, output);

console.log("PROJECT_DUMP.txt written");

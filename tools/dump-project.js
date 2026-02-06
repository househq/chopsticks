// src/dump-project.js
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "PROJECT_DUMP.txt");

const SKIP_DIRS = new Set(["node_modules", ".git", "data", "logs", "dist", "build"]);
const SKIP_FILES = new Set([".env", "PROJECT_DUMP.txt"]);

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  if (!ext) return true;
  return [
    ".js", ".cjs", ".mjs", ".json", ".yml", ".yaml", ".md", ".txt",
    ".ts", ".tsx", ".sh", ".bash", ".zsh", ".toml", ".ini", ".env.example"
  ].includes(ext);
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) {
      if (e.name !== ".github") continue;
    }
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);

    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
      continue;
    }

    if (SKIP_FILES.has(e.name)) continue;
    if (!isTextFile(full)) continue;

    out.push(rel);
  }
  return out;
}

function readSafe(rel) {
  const p = path.join(ROOT, rel);
  const buf = fs.readFileSync(p);
  // Hard cap per file to avoid massive dumps
  const max = 200_000;
  const sliced = buf.length > max ? buf.subarray(0, max) : buf;
  const text = sliced.toString("utf8");
  const suffix = buf.length > max ? "\n\n/* TRUNCATED */\n" : "\n";
  return text + suffix;
}

const files = walk(ROOT).sort();

let dump = "";
dump += `# Chopsticks Project Dump\n`;
dump += `# Root: ${ROOT}\n`;
dump += `# Files: ${files.length}\n\n`;

for (const rel of files) {
  dump += `\n\n===== FILE: ${rel} =====\n\n`;
  dump += readSafe(rel);
}

fs.writeFileSync(OUT, dump, "utf8");
console.log(`Wrote ${OUT} (${files.length} files)`);

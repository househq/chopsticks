import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";

function execFileBuffer(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, encoding: null, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr || "");
        const e = new Error(msg || err.message);
        e.cause = err;
        reject(e);
        return;
      }
      resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout || ""), "utf8"));
    });
  });
}

export async function svgToPngBuffer(svg, { width = 960, height = 540, density = 192 } = {}) {
  const id = randomBytes(8).toString("hex");
  const svgPath = path.join(os.tmpdir(), `chopsticks-${id}.svg`);
  try {
    await fs.writeFile(svgPath, String(svg || ""), "utf8");
    // ImageMagick supports SVG input in this image; render to stdout PNG bytes.
    // -density improves text/line crispness before downscaling.
    return await execFileBuffer("convert", [
      "-density", String(density),
      "-background", "none",
      svgPath,
      "-resize", `${Math.max(1, width)}x${Math.max(1, height)}`,
      "png:-"
    ]);
  } finally {
    await fs.unlink(svgPath).catch(() => {});
  }
}


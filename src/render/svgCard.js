// src/render/svgCard.js
// Render a "card" image for embeds using SVG -> PNG via ImageMagick.
//
// Discord does not reliably preview SVGs. We generate SVG for layout, render to PNG, and attach it.

import crypto from "node:crypto";
import { svgToPngBuffer } from "../game/render/svgToPng.js";

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampText(s, max) {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  if (max <= 1) return t.slice(0, Math.max(0, max));
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

function toHexColor(value, fallback = "#5865F2") {
  if (typeof value === "string" && /^#?[0-9a-f]{6}$/i.test(value.trim())) {
    const s = value.trim();
    return s.startsWith("#") ? s : `#${s}`;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const hex = Math.max(0, Math.min(0xffffff, Math.trunc(n))).toString(16).padStart(6, "0");
  return `#${hex}`;
}

function sigilRects(seed, { x, y, size, fill = "rgba(255,255,255,0.08)" } = {}) {
  const buf = crypto.createHash("sha256").update(String(seed || "x")).digest();
  const grid = 8;
  const cell = Math.max(2, Math.floor(size / grid));
  const rects = [];
  let bit = 0;
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const b = buf[(bit >> 3) % buf.length] ?? 0;
      const on = ((b >> (bit & 7)) & 1) === 1;
      bit += 1;
      if (!on) continue;
      const rx = x + gx * cell;
      const ry = y + gy * cell;
      rects.push(`<rect x="${rx}" y="${ry}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="${fill}"/>`);
    }
  }
  return rects.join("");
}

export function embedToCardSvg(embed, { width = 960, height = 540 } = {}) {
  const e = embed && typeof embed === "object" ? embed : {};
  const title = clampText(e.title || "Chopsticks", 48);
  const desc = clampText(e.description || "", 220);
  const color = toHexColor(e.color, "#5865F2");
  const footer = clampText((e.footer && (e.footer.text || e.footer)) || "", 80);

  const fields = Array.isArray(e.fields) ? e.fields : [];
  const showFields = fields
    .filter(f => f && f.name)
    .slice(0, 6)
    .map(f => ({
      name: clampText(f.name, 26),
      value: clampText(f.value ?? "-", 80)
    }));

  const W = Math.max(320, Math.trunc(Number(width) || 960));
  const H = Math.max(240, Math.trunc(Number(height) || 540));

  const pad = 44;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;

  const fieldY = 250;
  const fieldH = 54;
  const fieldGap = 10;

  const fieldSvg = showFields
    .map((f, idx) => {
      const y = fieldY + idx * (fieldH + fieldGap);
      return `
        <g>
          <rect x="${pad + 24}" y="${y}" width="${cardW - 48}" height="${fieldH}" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
          <text x="${pad + 44}" y="${y + 22}" font-family="DejaVu Sans, sans-serif" font-size="16" fill="rgba(255,255,255,0.78)">${escapeXml(f.name)}</text>
          <text x="${pad + 44}" y="${y + 44}" font-family="DejaVu Sans, sans-serif" font-size="18" fill="rgba(255,255,255,0.92)">${escapeXml(f.value)}</text>
        </g>`;
    })
    .join("\n");

  const sigil = sigilRects(`${title}|${desc}`, { x: W - pad - 132, y: pad + 22, size: 110 });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050816"/>
      <stop offset="100%" stop-color="#090a12"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.25"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>

  <g filter="url(#soft)">
    <rect x="${pad}" y="${pad}" width="${cardW}" height="${cardH}" rx="22" fill="rgba(12,18,32,0.9)" stroke="rgba(255,255,255,0.10)"/>
    <rect x="${pad}" y="${pad}" width="${cardW}" height="10" rx="22" fill="url(#accent)"/>

    <g opacity="0.95">
      ${sigil}
    </g>

    <text x="${pad + 24}" y="${pad + 62}" font-family="DejaVu Sans, sans-serif" font-size="42" fill="#ffffff">${escapeXml(title)}</text>
    <text x="${pad + 24}" y="${pad + 102}" font-family="DejaVu Sans, sans-serif" font-size="20" fill="rgba(255,255,255,0.72)">${escapeXml(desc)}</text>

    ${fieldSvg}

    <text x="${pad + 24}" y="${H - pad - 18}" font-family="DejaVu Sans, sans-serif" font-size="14" fill="rgba(255,255,255,0.45)">
      ${escapeXml(footer ? footer : "Chopsticks")}
    </text>
  </g>
</svg>`;
}

export async function renderEmbedCardPng(embed, { width = 960, height = 540 } = {}) {
  const svg = embedToCardSvg(embed, { width, height });
  return await svgToPngBuffer(svg, { width, height, density: 192 });
}

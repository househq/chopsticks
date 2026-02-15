function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "mythic": return "#a855f7";
    case "legendary": return "#f59e0b";
    case "epic": return "#3b82f6";
    case "rare": return "#22c55e";
    case "common": return "#94a3b8";
    default: return "#94a3b8";
  }
}

function rarityLabel(r) {
  return String(r || "common").toUpperCase();
}

export function buildGatherCardSvg({ title, subtitle, items = [] } = {}) {
  const W = 960;
  const H = 540;
  const safeTitle = esc(title || "Gather Run");
  const safeSubtitle = esc(subtitle || "");

  const rows = items.slice(0, 4);
  const cardX = 56;
  const cardY = 140;
  const cardW = W - 112;
  const cardH = H - 200;
  const gap = 14;
  const rowH = Math.floor((cardH - gap * (rows.length - 1)) / Math.max(1, rows.length));

  const blocks = rows.map((it, idx) => {
    const y = cardY + idx * (rowH + gap);
    const name = esc(it?.name || it?.id || "Unknown");
    const rarity = String(it?.rarity || "common");
    const color = rarityColor(rarity);
    const label = esc(rarityLabel(rarity));
    const initials = esc((String(it?.name || it?.id || "U").trim().match(/[A-Za-z0-9]+/g) || ["U"])[0].slice(0, 2).toUpperCase());

    return `
      <g>
        <rect x="${cardX}" y="${y}" rx="16" ry="16" width="${cardW}" height="${rowH}" fill="#0b1220" stroke="${color}" stroke-width="3" opacity="0.98" />
        <circle cx="${cardX + 52}" cy="${y + Math.floor(rowH / 2)}" r="28" fill="#07131f" stroke="${color}" stroke-width="4"/>
        <text x="${cardX + 52}" y="${y + Math.floor(rowH / 2) + 10}" text-anchor="middle" font-size="22" font-family="DejaVu Sans, sans-serif" fill="#e5e7eb" font-weight="800">${initials}</text>
        <text x="${cardX + 96}" y="${y + 58}" font-size="30" font-family="DejaVu Sans, sans-serif" fill="#e5e7eb" font-weight="800">${name}</text>
        <text x="${cardX + 96}" y="${y + 94}" font-size="20" font-family="DejaVu Sans, sans-serif" fill="${color}" font-weight="800">${label}</text>
      </g>
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050816"/>
      <stop offset="55%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#0a1a2b"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.00"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="36" y="28" rx="20" ry="20" width="${W - 72}" height="${H - 56}" fill="#0b1220" opacity="0.55" filter="url(#shadow)"/>
  <rect x="36" y="28" rx="20" ry="20" width="${W - 72}" height="${H - 56}" fill="url(#sheen)" opacity="1"/>

  <text x="56" y="78" font-size="40" font-family="DejaVu Sans, sans-serif" fill="#ffffff" font-weight="900">${safeTitle}</text>
  <text x="56" y="110" font-size="20" font-family="DejaVu Sans, sans-serif" fill="#9ca3af" font-weight="700">${safeSubtitle}</text>

  ${blocks}

  <text x="${W - 56}" y="${H - 40}" text-anchor="end" font-size="16" font-family="DejaVu Sans, sans-serif" fill="#64748b">
    Chopsticks Game Engine
  </text>
</svg>`;
}

export function buildWorkCardSvg({ title, subtitle, rewardText, bonusText } = {}) {
  const W = 960;
  const H = 540;
  const safeTitle = esc(title || "Work Completed");
  const safeSubtitle = esc(subtitle || "");
  const safeReward = esc(rewardText || "");
  const safeBonus = esc(bonusText || "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#061018"/>
      <stop offset="55%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#0a2a1b"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="48" y="40" rx="22" ry="22" width="${W - 96}" height="${H - 80}" fill="#0b1220" opacity="0.60" filter="url(#shadow)"/>

  <text x="72" y="108" font-size="42" font-family="DejaVu Sans, sans-serif" fill="#ffffff" font-weight="900">${safeTitle}</text>
  <text x="72" y="144" font-size="20" font-family="DejaVu Sans, sans-serif" fill="#9ca3af" font-weight="700">${safeSubtitle}</text>

  <rect x="72" y="190" rx="18" ry="18" width="${W - 144}" height="120" fill="#07131f" stroke="#22c55e" stroke-width="3" opacity="0.98"/>
  <text x="102" y="258" font-size="34" font-family="DejaVu Sans, sans-serif" fill="#e5e7eb" font-weight="900">Reward: ${safeReward}</text>

  ${
    safeBonus
      ? `<rect x="72" y="332" rx="18" ry="18" width="${W - 144}" height="120" fill="#07131f" stroke="#f59e0b" stroke-width="3" opacity="0.98"/>
         <text x="102" y="400" font-size="28" font-family="DejaVu Sans, sans-serif" fill="#e5e7eb" font-weight="900">Bonus: ${safeBonus}</text>`
      : ""
  }

  <text x="${W - 72}" y="${H - 64}" text-anchor="end" font-size="16" font-family="DejaVu Sans, sans-serif" fill="#64748b">
    Chopsticks Game Engine
  </text>
</svg>`;
}

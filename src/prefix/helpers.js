export async function reply(message, text) {
  return message.reply({ content: text });
}

export async function dm(user, text) {
  try { await user.send(text); } catch {}
}

export function parseIntSafe(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const t = Math.trunc(n);
  if (t < min || t > max) return null;
  return t;
}

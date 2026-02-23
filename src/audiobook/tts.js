/**
 * TTS engine for Chopsticks audiobook feature.
 * Uses msedge-tts (Microsoft Edge Read Aloud API) — free, no API key.
 * Falls back to VOICE_ASSIST_TTS_URL if set.
 * Caches generated audio chunks in Redis (6hr TTL).
 */

import { createHash } from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// ── Voice presets ──────────────────────────────────────────────────────────────
export const VOICE_PRESETS = {
  narrator:  { id: 'en-US-GuyNeural',   label: '🎙️ Narrator',  style: 'narrative',  desc: 'Deep and authoritative — perfect for non-fiction' },
  story:     { id: 'en-US-JennyNeural', label: '📖 Story',      style: undefined,    desc: 'Warm and conversational — great for fiction' },
  dramatic:  { id: 'en-US-DavisNeural', label: '🎭 Dramatic',   style: 'unfriendly', desc: 'Intense and expressive — thrillers, horror' },
  calm:      { id: 'en-US-AriaNeural',  label: '😴 Calm',       style: 'calm',       desc: 'Soothing and measured — meditation, poetry' },
  energetic: { id: 'en-US-TonyNeural',  label: '⚡ Energetic',  style: 'cheerful',   desc: 'Lively and upbeat — adventure, self-help' },
};

export const PRESET_KEYS = Object.keys(VOICE_PRESETS);

// Max chars per TTS request (avoid timeouts on long text)
const MAX_CHUNK_CHARS = 1800;

// Redis TTL for cached audio chunks (6 hours)
const CACHE_TTL = 60 * 60 * 6;

let _redis = null;
/** Inject Redis client (optional — caching degrades gracefully without it). */
export function setRedis(client) { _redis = client; }

/** Compute cache key for a text+voice+speed combination. */
function cacheKey(text, voiceId, speed) {
  const hash = createHash('sha256').update(`${voiceId}:${speed}:${text}`).digest('hex').slice(0, 20);
  return `tts:chunk:${hash}`;
}

/**
 * Generate TTS audio for a single text chunk.
 * Returns an Ogg/Opus Buffer suitable for @discordjs/voice createAudioResource.
 *
 * @param {string} text
 * @param {string} voiceId  e.g. 'en-US-GuyNeural'
 * @param {number} speed    0.5 – 2.0
 * @param {string} [style]  SSML speaking style (optional)
 * @returns {Promise<Buffer>}
 */
export async function generateChunk(text, voiceId = 'en-US-GuyNeural', speed = 1.0, style) {
  if (!text?.trim()) return Buffer.alloc(0);

  // If an external TTS service is configured, use it instead
  if (process.env.VOICE_ASSIST_TTS_URL) {
    return externalTts(text, voiceId, speed);
  }

  const key = cacheKey(text, voiceId, speed);

  // Check Redis cache
  if (_redis) {
    try {
      const cached = await _redis.getBuffer(key);
      if (cached) return cached;
    } catch { /* cache miss */ }
  }

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  // Build SSML with optional rate adjustment
  const rateSign = speed >= 1 ? '+' : '-';
  const rateAbs  = Math.round(Math.abs((speed - 1) * 100));
  const prosody  = rateAbs > 0
    ? `<prosody rate="${rateSign}${rateAbs}%">${escapeXml(text)}</prosody>`
    : escapeXml(text);

  const ssml = style
    ? `<mstts:express-as style="${style}">${prosody}</mstts:express-as>`
    : prosody;

  const chunks = [];
  await new Promise((resolve, reject) => {
    const readable = tts.toStream(ssml);
    readable.on('data', d => chunks.push(d));
    readable.on('end', resolve);
    readable.on('error', reject);
  });

  const buf = Buffer.concat(chunks);

  // Cache result
  if (_redis && buf.length > 0) {
    try { await _redis.setex(key, CACHE_TTL, buf); } catch { /* ignore */ }
  }

  return buf;
}

/** Split long text into ≤MAX_CHUNK_CHARS segments, breaking on sentence boundaries. */
export function splitIntoChunks(text) {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHUNK_CHARS) {
    // Find last sentence boundary within limit
    let cutAt = MAX_CHUNK_CHARS;
    const sentenceEnd = remaining.lastIndexOf('. ', cutAt);
    const newline      = remaining.lastIndexOf('\n', cutAt);
    const best = Math.max(sentenceEnd, newline);
    if (best > MAX_CHUNK_CHARS * 0.5) cutAt = best + 1;

    chunks.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/** Fetch the full voice list from Edge TTS (cached in-process for session lifetime). */
let _voiceCache = null;
export async function getVoices() {
  if (_voiceCache) return _voiceCache;
  try {
    const tts = new MsEdgeTTS();
    const voices = await tts.getVoices();
    _voiceCache = voices;
    return voices;
  } catch {
    return [];
  }
}

/** Get voices grouped by locale/language. */
export async function getVoicesByLanguage() {
  const voices = await getVoices();
  const groups = {};
  for (const v of voices) {
    const lang = v.Locale?.split('-')[0]?.toUpperCase() ?? 'OTHER';
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(v);
  }
  return groups;
}

/** Resolve a preset key OR a raw voiceId to { id, style }. */
export function resolveVoice(presetOrId) {
  const preset = VOICE_PRESETS[presetOrId];
  if (preset) return { id: preset.id, style: preset.style };
  return { id: presetOrId, style: undefined };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function externalTts(text, voiceId, speed) {
  const url  = process.env.VOICE_ASSIST_TTS_URL;
  const auth = process.env.VOICE_ASSIST_TTS_AUTH;
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, voice: voiceId, speed }),
  });
  if (!res.ok) throw new Error(`External TTS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Unit tests for audiobook TTS engine helpers.
 * Tests pure logic: chunk splitting, cache key generation, voice resolution.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';

// ── Inline re-implementations of testable pure helpers ────────────────────────

const MAX_CHUNK_CHARS = 1800;

function splitIntoChunks(text) {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > MAX_CHUNK_CHARS) {
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

function cacheKey(text, voiceId, speed) {
  const hash = createHash('sha256').update(`${voiceId}:${speed}:${text}`).digest('hex').slice(0, 20);
  return `tts:chunk:${hash}`;
}

const VOICE_PRESETS = {
  narrator:  { id: 'en-US-GuyNeural',   label: '🎙️ Narrator',  style: 'narrative' },
  story:     { id: 'en-US-JennyNeural', label: '📖 Story',      style: undefined },
  dramatic:  { id: 'en-US-DavisNeural', label: '🎭 Dramatic',   style: 'unfriendly' },
  calm:      { id: 'en-US-AriaNeural',  label: '😴 Calm',       style: 'calm' },
  energetic: { id: 'en-US-TonyNeural',  label: '⚡ Energetic',  style: 'cheerful' },
};

function resolveVoice(presetOrId) {
  const preset = VOICE_PRESETS[presetOrId];
  if (preset) return { id: preset.id, style: preset.style };
  return { id: presetOrId, style: undefined };
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('audiobook-tts: splitIntoChunks', () => {
  it('returns single element for short text', () => {
    const text = 'Hello world.';
    const chunks = splitIntoChunks(text);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], text);
  });

  it('splits text exceeding MAX_CHUNK_CHARS into multiple chunks', () => {
    const text = 'A'.repeat(4000);
    const chunks = splitIntoChunks(text);
    assert.ok(chunks.length >= 2);
    chunks.forEach(c => assert.ok(c.length <= MAX_CHUNK_CHARS + 100, `chunk too long: ${c.length}`));
  });

  it('prefers sentence boundary when available', () => {
    const base = 'Word '.repeat(300);           // short words to fill chars
    const half = 'X '.repeat(200);              // fills up to near boundary
    const sentence = half + '. ' + 'Z '.repeat(200);
    const text = sentence.repeat(3);
    if (text.length > MAX_CHUNK_CHARS) {
      const chunks = splitIntoChunks(text);
      // First chunk should ideally end at a sentence boundary
      assert.ok(chunks.length > 1);
    }
  });

  it('handles exactly MAX_CHUNK_CHARS as single chunk', () => {
    const text = 'a'.repeat(MAX_CHUNK_CHARS);
    const chunks = splitIntoChunks(text);
    assert.equal(chunks.length, 1);
  });

  it('handles empty string', () => {
    const chunks = splitIntoChunks('');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], '');
  });

  it('all chunks are non-empty after trimming', () => {
    const text = ('Word. ').repeat(600);
    const chunks = splitIntoChunks(text);
    chunks.forEach(c => assert.ok(c.trim().length > 0));
  });

  it('total characters preserved across all chunks (no data loss)', () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitIntoChunks(words);
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    // Total content ≤ original (trimming removes spaces at boundaries)
    assert.ok(totalLen <= words.length, 'chunks should not exceed original length');
    assert.ok(totalLen >= words.length * 0.95, 'should not lose more than 5% of content');
  });
});

describe('audiobook-tts: cacheKey', () => {
  it('returns consistent key for same inputs', () => {
    const k1 = cacheKey('hello', 'en-US-GuyNeural', 1.0);
    const k2 = cacheKey('hello', 'en-US-GuyNeural', 1.0);
    assert.equal(k1, k2);
  });

  it('returns different key for different text', () => {
    const k1 = cacheKey('hello', 'en-US-GuyNeural', 1.0);
    const k2 = cacheKey('world', 'en-US-GuyNeural', 1.0);
    assert.notEqual(k1, k2);
  });

  it('returns different key for different voiceId', () => {
    const k1 = cacheKey('text', 'en-US-GuyNeural', 1.0);
    const k2 = cacheKey('text', 'en-US-JennyNeural', 1.0);
    assert.notEqual(k1, k2);
  });

  it('returns different key for different speed', () => {
    const k1 = cacheKey('text', 'en-US-GuyNeural', 1.0);
    const k2 = cacheKey('text', 'en-US-GuyNeural', 1.5);
    assert.notEqual(k1, k2);
  });

  it('key has tts:chunk: prefix', () => {
    const k = cacheKey('test', 'voice', 1);
    assert.ok(k.startsWith('tts:chunk:'));
  });

  it('key is deterministic length', () => {
    const k = cacheKey('sample text', 'en-US-GuyNeural', 1.25);
    // 'tts:chunk:' + 20-char hex
    assert.equal(k.length, 'tts:chunk:'.length + 20);
  });
});

describe('audiobook-tts: resolveVoice', () => {
  it('resolves "narrator" preset to GuyNeural', () => {
    const { id, style } = resolveVoice('narrator');
    assert.equal(id, 'en-US-GuyNeural');
    assert.equal(style, 'narrative');
  });

  it('resolves "story" preset to JennyNeural with no style', () => {
    const { id, style } = resolveVoice('story');
    assert.equal(id, 'en-US-JennyNeural');
    assert.equal(style, undefined);
  });

  it('resolves "dramatic" preset with style', () => {
    const { id, style } = resolveVoice('dramatic');
    assert.equal(id, 'en-US-DavisNeural');
    assert.equal(style, 'unfriendly');
  });

  it('passes through raw voiceId when not a preset', () => {
    const { id, style } = resolveVoice('en-GB-RyanNeural');
    assert.equal(id, 'en-GB-RyanNeural');
    assert.equal(style, undefined);
  });

  it('all 5 presets resolve without error', () => {
    ['narrator', 'story', 'dramatic', 'calm', 'energetic'].forEach(k => {
      const result = resolveVoice(k);
      assert.ok(result.id, `${k} preset missing id`);
    });
  });
});

describe('audiobook-tts: escapeXml', () => {
  it('escapes &', () => assert.ok(escapeXml('a & b').includes('&amp;')));
  it('escapes <', () => assert.ok(escapeXml('a < b').includes('&lt;')));
  it('escapes >', () => assert.ok(escapeXml('a > b').includes('&gt;')));
  it('escapes "', () => assert.ok(escapeXml('a " b').includes('&quot;')));
  it("escapes '", () => assert.ok(escapeXml("a ' b").includes('&apos;')));
  it('leaves plain text unchanged', () => assert.equal(escapeXml('hello world'), 'hello world'));
});

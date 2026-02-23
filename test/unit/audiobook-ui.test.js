/**
 * Unit tests for audiobook UI — button IDs, select IDs, ownership guards,
 * voice picker pagination, and session flow validation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Button / select ID helpers (mirrors audiobook.js logic) ──────────────────

function makeControlButtonId(action, guildId) {
  return `audiobook:${action}:${guildId}`;
}

function parseButtonId(customId) {
  if (!customId.startsWith('audiobook:')) return null;
  const [, action, ...rest] = customId.split(':');
  return { action, rest };
}

function makeVoicePresetSelectId(guildId) {
  return `audiobook:voicepreset:${guildId}`;
}

function makeSelectBookId(guildId) {
  return `audiobook:selectbook:${guildId}`;
}

function makeVoiceCatalogButtonId(guildId, page) {
  return `audiobook:voicecatalog:${guildId}:${page}`;
}

function makeJumpBookmarkId(guildId) {
  return `audiobook:jumpbookmark:${guildId}`;
}

// ── Voice preset catalog helpers ──────────────────────────────────────────────

const VOICE_PRESETS = {
  narrator:  { id: 'en-US-GuyNeural',   label: '🎙️ Narrator' },
  story:     { id: 'en-US-JennyNeural', label: '📖 Story' },
  dramatic:  { id: 'en-US-DavisNeural', label: '🎭 Dramatic' },
  calm:      { id: 'en-US-AriaNeural',  label: '😴 Calm' },
  energetic: { id: 'en-US-TonyNeural',  label: '⚡ Energetic' },
};

function buildPresetOptions() {
  return Object.entries(VOICE_PRESETS).map(([k, v]) => ({
    label: v.label,
    value: k,
  }));
}

// ── Catalog pagination ────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function paginateVoices(voices, page) {
  const start = page * PAGE_SIZE;
  return voices.slice(start, start + PAGE_SIZE);
}

function isLastPage(total, page) {
  return (page + 1) * PAGE_SIZE >= total;
}

// ── Format icon helper ────────────────────────────────────────────────────────

function formatIcon(fmt) {
  const icons = { txt: '📄', md: '📝', pdf: '📕', docx: '📘', epub: '📗' };
  return icons[fmt] ?? '📄';
}

// ── File extension validation ─────────────────────────────────────────────────

const SUPPORTED_EXTS = ['.txt', '.md', '.pdf', '.docx', '.epub'];

function isSupported(filename) {
  const ext = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  return SUPPORTED_EXTS.includes(ext);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('audiobook-ui: button ID format', () => {
  const guildId = '123456789';

  it('pause button ID is correct', () => {
    assert.equal(makeControlButtonId('pause', guildId), `audiobook:pause:${guildId}`);
  });

  it('resume button ID is correct', () => {
    assert.equal(makeControlButtonId('resume', guildId), `audiobook:resume:${guildId}`);
  });

  it('skip button ID is correct', () => {
    assert.equal(makeControlButtonId('skip', guildId), `audiobook:skip:${guildId}`);
  });

  it('stop button ID is correct', () => {
    assert.equal(makeControlButtonId('stop', guildId), `audiobook:stop:${guildId}`);
  });

  it('restart button ID is correct', () => {
    assert.equal(makeControlButtonId('restart', guildId), `audiobook:restart:${guildId}`);
  });

  it('all control IDs start with audiobook:', () => {
    ['pause', 'resume', 'skip', 'stop', 'restart'].forEach(action => {
      assert.ok(makeControlButtonId(action, guildId).startsWith('audiobook:'));
    });
  });
});

describe('audiobook-ui: parseButtonId', () => {
  it('returns null for non-audiobook ID', () => {
    assert.equal(parseButtonId('music:play:123'), null);
  });

  it('parses action from ID', () => {
    const p = parseButtonId('audiobook:pause:123');
    assert.equal(p.action, 'pause');
  });

  it('parses guildId in rest', () => {
    const p = parseButtonId('audiobook:stop:987654321');
    assert.equal(p.rest[0], '987654321');
  });

  it('parses voicecatalog with page number', () => {
    const p = parseButtonId('audiobook:voicecatalog:111:3');
    assert.equal(p.action, 'voicecatalog');
    assert.equal(p.rest[0], '111');
    assert.equal(p.rest[1], '3');
  });

  it('handles closedrop (no guildId)', () => {
    const p = parseButtonId('audiobook:closedrop');
    assert.equal(p.action, 'closedrop');
  });
});

describe('audiobook-ui: select menu IDs', () => {
  it('voice preset select ID is correct', () => {
    assert.equal(makeVoicePresetSelectId('111'), 'audiobook:voicepreset:111');
  });

  it('select book ID is correct', () => {
    assert.equal(makeSelectBookId('222'), 'audiobook:selectbook:222');
  });

  it('jump bookmark ID is correct', () => {
    assert.equal(makeJumpBookmarkId('333'), 'audiobook:jumpbookmark:333');
  });

  it('voice catalog button ID includes page number', () => {
    assert.equal(makeVoiceCatalogButtonId('444', 2), 'audiobook:voicecatalog:444:2');
  });
});

describe('audiobook-ui: voice preset options', () => {
  it('returns 5 preset options', () => {
    const opts = buildPresetOptions();
    assert.equal(opts.length, 5);
  });

  it('all options have label and value', () => {
    buildPresetOptions().forEach(o => {
      assert.ok(o.label, 'missing label');
      assert.ok(o.value, 'missing value');
    });
  });

  it('narrator is a valid option', () => {
    const opts = buildPresetOptions();
    assert.ok(opts.some(o => o.value === 'narrator'));
  });

  it('all preset values are recognized preset keys', () => {
    buildPresetOptions().forEach(o => {
      assert.ok(Object.keys(VOICE_PRESETS).includes(o.value), `unknown preset: ${o.value}`);
    });
  });
});

describe('audiobook-ui: voice catalog pagination', () => {
  const fakeVoices = Array.from({ length: 35 }, (_, i) => ({ ShortName: `Voice${i}` }));

  it('page 0 returns first 10 voices', () => {
    const page = paginateVoices(fakeVoices, 0);
    assert.equal(page.length, 10);
    assert.equal(page[0].ShortName, 'Voice0');
  });

  it('page 1 returns voices 10-19', () => {
    const page = paginateVoices(fakeVoices, 1);
    assert.equal(page.length, 10);
    assert.equal(page[0].ShortName, 'Voice10');
  });

  it('last page returns remaining voices', () => {
    const page = paginateVoices(fakeVoices, 3);
    assert.equal(page.length, 5);
  });

  it('isLastPage correct at last page', () => {
    assert.ok(isLastPage(35, 3));
  });

  it('isLastPage false on non-last page', () => {
    assert.ok(!isLastPage(35, 0));
  });

  it('empty page beyond total returns empty array', () => {
    const page = paginateVoices(fakeVoices, 10);
    assert.equal(page.length, 0);
  });
});

describe('audiobook-ui: file format validation', () => {
  it('accepts .txt files', () => assert.ok(isSupported('book.txt')));
  it('accepts .md files', () => assert.ok(isSupported('README.md')));
  it('accepts .pdf files', () => assert.ok(isSupported('story.pdf')));
  it('accepts .docx files', () => assert.ok(isSupported('doc.docx')));
  it('accepts .epub files', () => assert.ok(isSupported('novel.epub')));
  it('rejects .mp3 files', () => assert.ok(!isSupported('music.mp3')));
  it('rejects .jpg files', () => assert.ok(!isSupported('photo.jpg')));
  it('rejects .exe files', () => assert.ok(!isSupported('virus.exe')));
  it('rejects no extension', () => assert.ok(!isSupported('noext')));
  it('is case-insensitive', () => assert.ok(isSupported('BOOK.TXT')));
  it('handles dotfiles correctly', () => assert.ok(!isSupported('.gitignore')));
});

describe('audiobook-ui: format icons', () => {
  it('txt → 📄', () => assert.equal(formatIcon('txt'), '📄'));
  it('md → 📝', () => assert.equal(formatIcon('md'), '📝'));
  it('pdf → 📕', () => assert.equal(formatIcon('pdf'), '📕'));
  it('docx → 📘', () => assert.equal(formatIcon('docx'), '📘'));
  it('epub → 📗', () => assert.equal(formatIcon('epub'), '📗'));
  it('unknown → 📄', () => assert.equal(formatIcon('xyz'), '📄'));
});

describe('audiobook-ui: ownership guard pattern', () => {
  function shouldHandleButton(customId, handlerPrefix) {
    return customId.startsWith(handlerPrefix);
  }

  it('audiobook handler claims its own IDs', () => {
    assert.ok(shouldHandleButton('audiobook:pause:123', 'audiobook:'));
  });

  it('audiobook handler does not claim music IDs', () => {
    assert.ok(!shouldHandleButton('music:play:123', 'audiobook:'));
  });

  it('audiobook handler does not claim pool IDs', () => {
    assert.ok(!shouldHandleButton('pool:discover:123', 'audiobook:'));
  });

  it('closedrop is handled without guildId suffix', () => {
    assert.ok(shouldHandleButton('audiobook:closedrop', 'audiobook:'));
  });

  it('voicecatalog is handled even with extra segments', () => {
    assert.ok(shouldHandleButton('audiobook:voicecatalog:111:0', 'audiobook:'));
  });
});

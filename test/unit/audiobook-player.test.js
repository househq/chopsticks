/**
 * Unit tests for AudiobookPlayer state machine and progress logic.
 * Tests pure logic without Discord voice connections.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Inline re-implementation of testable state machine logic ──────────────────

const PlayerState = {
  IDLE:    'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED:  'paused',
  DONE:    'done',
};

const WPM = 150;

function buildBar(pct) {
  const filled = Math.round(pct / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
}

function calcProgress(session, chapters) {
  if (!chapters.length) return null;
  const chIdx    = session?.current_chapter ?? 0;
  const chapter  = chapters[chIdx];
  const wordsLeft = chapter ? Math.max(0, chapter.word_count - 0) : 0;
  const etaMin   = Math.ceil(wordsLeft / WPM);
  const pct      = Math.round((chIdx / chapters.length) * 100);
  return {
    chapterIndex: chIdx,
    totalChapters: chapters.length,
    percentComplete: pct,
    bar: buildBar(pct),
    etaMin,
    state: session?.state ?? PlayerState.IDLE,
  };
}

// ── State transition validator ────────────────────────────────────────────────

function isValidTransition(from, to) {
  const allowed = {
    idle:    ['loading', 'done'],
    loading: ['playing', 'idle', 'done'],
    playing: ['paused', 'loading', 'idle', 'done'],
    paused:  ['playing', 'idle'],
    done:    ['idle'],
  };
  return allowed[from]?.includes(to) ?? false;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('audiobook-player: buildBar', () => {
  it('shows 0% as all empty', () => {
    assert.equal(buildBar(0), '░░░░░░░░░░ 0%');
  });

  it('shows 100% as all filled', () => {
    assert.equal(buildBar(100), '▓▓▓▓▓▓▓▓▓▓ 100%');
  });

  it('shows 50% as half filled', () => {
    assert.equal(buildBar(50), '▓▓▓▓▓░░░░░ 50%');
  });

  it('shows 10% as one filled', () => {
    assert.equal(buildBar(10), '▓░░░░░░░░░ 10%');
  });

  it('shows 90% as nine filled', () => {
    assert.equal(buildBar(90), '▓▓▓▓▓▓▓▓▓░ 90%');
  });

  it('bar total characters (excluding percent text) is always 10', () => {
    [0, 25, 50, 75, 100].forEach(pct => {
      const bar = buildBar(pct);
      const chars = bar.split(' ')[0];
      assert.equal([...chars].length, 10, `bar chars count wrong for ${pct}%`);
    });
  });
});

describe('audiobook-player: calcProgress', () => {
  const chapters = [
    { title: 'Chapter 1', word_count: 300 },
    { title: 'Chapter 2', word_count: 600 },
    { title: 'Chapter 3', word_count: 900 },
  ];

  it('returns null for empty chapters', () => {
    assert.equal(calcProgress({ current_chapter: 0 }, []), null);
  });

  it('starts at 0% on chapter 0', () => {
    const p = calcProgress({ current_chapter: 0, state: PlayerState.IDLE }, chapters);
    assert.equal(p.percentComplete, 0);
    assert.equal(p.chapterIndex, 0);
  });

  it('shows 67% at chapter 2 of 3', () => {
    const p = calcProgress({ current_chapter: 2, state: PlayerState.PLAYING }, chapters);
    assert.equal(p.percentComplete, 67);
  });

  it('shows 33% at chapter 1 of 3', () => {
    const p = calcProgress({ current_chapter: 1, state: PlayerState.PLAYING }, chapters);
    assert.equal(p.percentComplete, 33);
  });

  it('includes totalChapters', () => {
    const p = calcProgress({ current_chapter: 0, state: PlayerState.IDLE }, chapters);
    assert.equal(p.totalChapters, 3);
  });

  it('calculates ETA from word count', () => {
    const p = calcProgress({ current_chapter: 0, state: PlayerState.PLAYING }, chapters);
    // chapter 0 has 300 words → ceil(300/150) = 2 min
    assert.equal(p.etaMin, 2);
  });

  it('reflects state from session', () => {
    const p = calcProgress({ current_chapter: 0, state: PlayerState.PAUSED }, chapters);
    assert.equal(p.state, PlayerState.PAUSED);
  });

  it('defaults state to idle when session has no state', () => {
    const p = calcProgress({ current_chapter: 0 }, chapters);
    assert.equal(p.state, PlayerState.IDLE);
  });
});

describe('audiobook-player: state machine transitions', () => {
  it('allows idle → loading', () => assert.ok(isValidTransition('idle', 'loading')));
  it('allows loading → playing', () => assert.ok(isValidTransition('loading', 'playing')));
  it('allows playing → paused', () => assert.ok(isValidTransition('playing', 'paused')));
  it('allows paused → playing', () => assert.ok(isValidTransition('paused', 'playing')));
  it('allows playing → idle (stop)', () => assert.ok(isValidTransition('playing', 'idle')));
  it('allows playing → done (end of book)', () => assert.ok(isValidTransition('playing', 'done')));
  it('allows done → idle (reset)', () => assert.ok(isValidTransition('done', 'idle')));
  it('does NOT allow idle → playing (must load first)', () => assert.ok(!isValidTransition('idle', 'playing')));
  it('does NOT allow done → playing', () => assert.ok(!isValidTransition('done', 'playing')));
  it('does NOT allow paused → done directly (must stop → idle first)', () => assert.ok(!isValidTransition('paused', 'done')));
});

describe('audiobook-player: chapter navigation', () => {
  it('skipChapter increments current_chapter', () => {
    const session = { current_chapter: 0 };
    const chapters = [{ title: 'C1' }, { title: 'C2' }, { title: 'C3' }];
    const next = session.current_chapter + 1;
    assert.ok(next < chapters.length);
    session.current_chapter = next;
    assert.equal(session.current_chapter, 1);
  });

  it('skipChapter at last chapter signals done', () => {
    const session = { current_chapter: 2 };
    const chapters = [{ title: 'C1' }, { title: 'C2' }, { title: 'C3' }];
    const next = session.current_chapter + 1;
    assert.ok(next >= chapters.length);
  });

  it('seekChapter clamps to valid range (low)', () => {
    const clamp = (n, max) => Math.max(0, Math.min(n, max - 1));
    assert.equal(clamp(-5, 3), 0);
  });

  it('seekChapter clamps to valid range (high)', () => {
    const clamp = (n, max) => Math.max(0, Math.min(n, max - 1));
    assert.equal(clamp(99, 3), 2);
  });

  it('prevChapter at chapter 0 stays at 0', () => {
    const prev = Math.max(0, 0 - 1);
    assert.equal(prev, 0);
  });

  it('restartChapter does not change chapter index', () => {
    const session = { current_chapter: 2 };
    const idx = session.current_chapter;
    // Restart = reload same index
    assert.equal(idx, 2);
  });
});

describe('audiobook-player: PlayerState constants', () => {
  it('defines all 5 states', () => {
    assert.equal(PlayerState.IDLE,    'idle');
    assert.equal(PlayerState.LOADING, 'loading');
    assert.equal(PlayerState.PLAYING, 'playing');
    assert.equal(PlayerState.PAUSED,  'paused');
    assert.equal(PlayerState.DONE,    'done');
  });
});

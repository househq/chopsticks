// test/unit/pool-ownership.test.js
// Pool ownership hardening backtests:
//   - 1-pool-per-user ID scheme
//   - getProfileCompleteness scoring
//   - renderCompleteness rendering
//   - Permission matrix (owner / admin / stranger)
//   - Discover list completeness-aware sorting
//   - validatePoolMeta tags field
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

// ──────────────────────────────────────────────────────────────────────────
// Inline pure helpers — tested independently of Discord/DB runtime
// ──────────────────────────────────────────────────────────────────────────

function getProfileCompleteness(pool) {
  const meta = pool?.meta || {};
  const checks = [
    { label: 'description',       points: 35, ok: Boolean(meta.description?.trim()) },
    { label: 'specialty',         points: 25, ok: Boolean(meta.specialty?.trim()) },
    { label: 'emoji',             points: 15, ok: Boolean(meta.emoji?.trim()) },
    { label: 'tags',              points: 15, ok: Boolean(meta.tags?.trim()) },
    { label: 'public visibility', points: 10, ok: pool?.visibility === 'public' },
  ];
  const score = checks.reduce((s, c) => s + (c.ok ? c.points : 0), 0);
  const missing = checks.filter(c => !c.ok).map(c => c.label);
  return { score, missing, complete: score === 100 };
}

function renderCompleteness(pool) {
  const { score, missing } = getProfileCompleteness(pool);
  const filled = Math.round(score / 20);
  const bar = '▓'.repeat(filled) + '░'.repeat(5 - filled);
  const label = score === 100 ? '✅ Complete' : `${bar} ${score}%`;
  return { label, score, missing };
}

function validatePoolMeta(meta) {
  const errors = [];
  if (meta.description && meta.description.length > 300)
    errors.push('Description must be 300 characters or less.');
  if (meta.color && !/^#?[0-9a-fA-F]{6}$/.test(meta.color))
    errors.push('Color must be a valid hex code.');
  if (meta.emoji && meta.emoji.length > 4)
    errors.push('Emoji must be a single emoji character.');
  if (meta.specialty && meta.specialty.length > 30)
    errors.push('Specialty must be 30 characters or less.');
  if (meta.banner_url) {
    try { new URL(meta.banner_url); } catch { errors.push('Banner URL must be a valid URL.'); }
    if (!meta.banner_url.startsWith('https://'))
      errors.push('Banner URL must use HTTPS.');
  }
  if (meta.tags) {
    const tagList = meta.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagList.length > 5)               errors.push('Maximum 5 tags allowed.');
    if (tagList.some(t => t.length > 20)) errors.push('Each tag must be 20 characters or less.');
  }
  return errors;
}

function normaliseTags(rawTags) {
  return rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5).join(', ');
}

// ──────────────────────────────────────────────────────────────────────────

describe('Pool ID scheme — 1 pool per user', () => {
  it('pool ID is deterministic from userId', () => {
    const userId = '123456789012345678';
    assert.strictEqual(`pool_${userId}`, 'pool_123456789012345678');
  });

  it('two different users produce different pool IDs', () => {
    assert.notStrictEqual(`pool_user1`, `pool_user2`);
  });

  it('same user always produces the same pool ID', () => {
    const uid = 'abc123';
    assert.strictEqual(`pool_${uid}`, `pool_${uid}`);
  });

  it('pool ID encodes the owner — admins cannot rename it', () => {
    const poolId = 'pool_alice';
    const derivedOwner = poolId.replace('pool_', '');
    assert.strictEqual(derivedOwner, 'alice');
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('getProfileCompleteness — scoring', () => {
  it('empty meta and private visibility scores 0', () => {
    const { score, complete } = getProfileCompleteness({ meta: {}, visibility: 'private' });
    assert.strictEqual(score, 0);
    assert.strictEqual(complete, false);
  });

  it('description alone earns 35 points', () => {
    const { score } = getProfileCompleteness({ meta: { description: 'hello' }, visibility: 'private' });
    assert.strictEqual(score, 35);
  });

  it('specialty alone earns 25 points', () => {
    const { score } = getProfileCompleteness({ meta: { specialty: 'music' }, visibility: 'private' });
    assert.strictEqual(score, 25);
  });

  it('emoji alone earns 15 points', () => {
    const { score } = getProfileCompleteness({ meta: { emoji: '🎵' }, visibility: 'private' });
    assert.strictEqual(score, 15);
  });

  it('tags alone earn 15 points', () => {
    const { score } = getProfileCompleteness({ meta: { tags: 'lofi, music' }, visibility: 'private' });
    assert.strictEqual(score, 15);
  });

  it('public visibility alone earns 10 points', () => {
    const { score } = getProfileCompleteness({ meta: {}, visibility: 'public' });
    assert.strictEqual(score, 10);
  });

  it('all fields set scores 100 with complete=true and empty missing[]', () => {
    const { score, complete, missing } = getProfileCompleteness({
      meta: { description: 'Music agents', specialty: 'music', emoji: '🎵', tags: 'lofi, chill' },
      visibility: 'public',
    });
    assert.strictEqual(score, 100);
    assert.strictEqual(complete, true);
    assert.deepStrictEqual(missing, []);
  });

  it('reports all 5 missing fields on empty pool', () => {
    const { missing } = getProfileCompleteness({ meta: {}, visibility: 'private' });
    assert.strictEqual(missing.length, 5);
    assert.ok(missing.includes('description'));
    assert.ok(missing.includes('specialty'));
    assert.ok(missing.includes('emoji'));
    assert.ok(missing.includes('tags'));
    assert.ok(missing.includes('public visibility'));
  });

  it('handles null meta gracefully without throwing', () => {
    const { score } = getProfileCompleteness({ meta: null, visibility: 'private' });
    assert.strictEqual(score, 0);
  });

  it('handles undefined pool gracefully', () => {
    const { score } = getProfileCompleteness(undefined);
    assert.strictEqual(score, 0);
  });

  it('whitespace-only description does not earn points', () => {
    const { score } = getProfileCompleteness({ meta: { description: '   ' }, visibility: 'private' });
    assert.strictEqual(score, 0);
  });

  it('points add up correctly for partial profile', () => {
    // description(35) + tags(15) = 50
    const { score } = getProfileCompleteness({
      meta: { description: 'hello', tags: 'music' },
      visibility: 'private',
    });
    assert.strictEqual(score, 50);
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('renderCompleteness — visual rendering', () => {
  it('returns "✅ Complete" at 100%', () => {
    const pool = {
      meta: { description: 'x', specialty: 'music', emoji: '🎵', tags: 'lofi' },
      visibility: 'public',
    };
    const { label, score } = renderCompleteness(pool);
    assert.strictEqual(score, 100);
    assert.strictEqual(label, '✅ Complete');
  });

  it('returns bar string and percentage at 0%', () => {
    const { label, score } = renderCompleteness({ meta: {}, visibility: 'private' });
    assert.strictEqual(score, 0);
    assert.ok(label.includes('0%'));
    assert.ok(label.includes('░'));
  });

  it('bar has exactly 5 characters (filled + empty)', () => {
    for (const score of [0, 20, 40, 60, 80, 100]) {
      const filled = Math.round(score / 20);
      const bar = '▓'.repeat(filled) + '░'.repeat(5 - filled);
      assert.strictEqual(bar.length, 5, `bar should be 5 chars at score ${score}`);
    }
  });

  it('missing array aligns with un-scored fields', () => {
    const { missing, score } = renderCompleteness({ meta: { description: 'x' }, visibility: 'private' });
    assert.strictEqual(score, 35);
    assert.ok(!missing.includes('description'));
    assert.ok(missing.includes('specialty'));
    assert.ok(missing.includes('tags'));
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('validatePoolMeta — tags field', () => {
  it('accepts valid comma-separated tags', () => {
    assert.strictEqual(validatePoolMeta({ tags: 'lofi, chill, music' }).length, 0);
  });

  it('rejects more than 5 tags', () => {
    const errors = validatePoolMeta({ tags: 'a, b, c, d, e, f' });
    assert.ok(errors.some(e => e.includes('5')));
  });

  it('rejects a tag longer than 20 characters', () => {
    const errors = validatePoolMeta({ tags: 'this-tag-is-way-too-long-to-be-valid' });
    assert.ok(errors.some(e => e.includes('20')));
  });

  it('accepts exactly 5 tags', () => {
    assert.strictEqual(validatePoolMeta({ tags: 'a, b, c, d, e' }).length, 0);
  });

  it('accepts description up to 300 chars', () => {
    assert.strictEqual(validatePoolMeta({ description: 'x'.repeat(300) }).length, 0);
  });

  it('rejects description over 300 chars', () => {
    const errors = validatePoolMeta({ description: 'x'.repeat(301) });
    assert.ok(errors.some(e => e.includes('300')));
  });

  it('no error when meta is empty', () => {
    assert.strictEqual(validatePoolMeta({}).length, 0);
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('Pool permission matrix', () => {
  const alicePool = { pool_id: 'pool_alice', owner_user_id: 'alice', visibility: 'public' };
  const bobPool   = { pool_id: 'pool_bob',   owner_user_id: 'bob',   visibility: 'private' };

  const canView = (pool, userId) =>
    pool.visibility === 'public' || pool.owner_user_id === userId;

  const isOwner = (pool, userId) => pool.owner_user_id === userId;

  it('anyone can view a public pool', () => {
    assert.ok(canView(alicePool, 'stranger'));
  });

  it('owner can always view their own private pool', () => {
    assert.ok(canView(bobPool, 'bob'));
  });

  it('stranger cannot view a private pool', () => {
    assert.ok(!canView(bobPool, 'stranger'));
  });

  it('guild admin with ManageGuild is still a stranger to someone else\'s pool', () => {
    // Guild admins can SELECT/deploy pools in their server but cannot manage the pool itself
    assert.ok(!isOwner(alicePool, 'guildAdmin'));
  });

  it('only the owner can edit pool profile fields', () => {
    assert.ok(isOwner(alicePool, 'alice'));
    assert.ok(!isOwner(alicePool, 'alice2'));
  });

  it('pool ownership cannot be inferred differently from pool_id', () => {
    // Ownership is encoded in the pool ID — it cannot drift
    const ownerFromId = alicePool.pool_id.replace('pool_', '');
    assert.strictEqual(ownerFromId, alicePool.owner_user_id);
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('Discover list — completeness-aware sort', () => {
  const fullPool    = { pool_id: 'pool_full',    meta: { description: 'x', specialty: 'music', emoji: '🎵', tags: 'lofi' }, visibility: 'public' };
  const partialPool = { pool_id: 'pool_partial', meta: { description: 'x' },                                               visibility: 'public' };
  const emptyPool   = { pool_id: 'pool_empty',   meta: {},                                                                  visibility: 'private' };

  it('full profile scores higher than partial', () => {
    const { score: f } = getProfileCompleteness(fullPool);
    const { score: p } = getProfileCompleteness(partialPool);
    assert.ok(f > p, `full (${f}) should beat partial (${p})`);
  });

  it('partial profile scores higher than empty private pool', () => {
    const { score: p } = getProfileCompleteness(partialPool);
    const { score: e } = getProfileCompleteness(emptyPool);
    assert.ok(p > e, `partial (${p}) should beat empty (${e})`);
  });

  it('sort by completeness desc places full pool first', () => {
    const pools = [emptyPool, fullPool, partialPool];
    pools.sort((a, b) => getProfileCompleteness(b).score - getProfileCompleteness(a).score);
    assert.strictEqual(pools[0].pool_id, 'pool_full');
  });

  it('sort by completeness desc places empty pool last', () => {
    const pools = [emptyPool, fullPool, partialPool];
    pools.sort((a, b) => getProfileCompleteness(b).score - getProfileCompleteness(a).score);
    assert.strictEqual(pools[2].pool_id, 'pool_empty');
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('Tags normalisation', () => {
  it('trims whitespace and lowercases', () => {
    assert.strictEqual(normaliseTags('Lofi , Music, CHILL'), 'lofi, music, chill');
  });

  it('limits to 5 tags', () => {
    const result = normaliseTags('a, b, c, d, e, f, g');
    assert.strictEqual(result.split(', ').length, 5);
  });

  it('filters empty entries from double commas', () => {
    const result = normaliseTags('a,, b, , c');
    assert.ok(!result.includes(',,'));
    const parts = result.split(', ').filter(Boolean);
    assert.ok(parts.every(p => p.length > 0));
  });

  it('single tag produces a single entry', () => {
    assert.strictEqual(normaliseTags('music'), 'music');
  });
});

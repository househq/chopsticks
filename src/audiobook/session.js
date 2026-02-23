/**
 * Session & persistence helpers for the audiobook feature.
 * Thin DB wrapper used by the command and player.
 */

import { randomUUID } from 'crypto';

// ── Books ─────────────────────────────────────────────────────────────────────

export async function createBook(db, { userId, guildId, title, author, format, totalChapters, totalWords, fileSize }) {
  const id = `ab_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await db.query(
    `INSERT INTO audiobooks (id, user_id, guild_id, title, author, format, total_chapters, total_words, file_size)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, userId, guildId, title, author ?? null, format, totalChapters, totalWords, fileSize]
  );
  return id;
}

export async function insertChapters(db, bookId, chapters) {
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    await db.query(
      `INSERT INTO audiobook_chapters (book_id, sequence, title, content, word_count)
       VALUES ($1,$2,$3,$4,$5)`,
      [bookId, i, ch.title, ch.content, ch.wordCount]
    );
  }
}

export async function getBook(db, bookId) {
  const r = await db.query('SELECT * FROM audiobooks WHERE id=$1', [bookId]);
  return r.rows[0] ?? null;
}

export async function listBooks(db, userId, guildId) {
  const r = await db.query(
    'SELECT * FROM audiobooks WHERE user_id=$1 AND guild_id=$2 ORDER BY created_at DESC',
    [userId, guildId]
  );
  return r.rows;
}

export async function deleteBook(db, bookId, userId) {
  await db.query('DELETE FROM audiobooks WHERE id=$1 AND user_id=$2', [bookId, userId]);
}

export async function getChapters(db, bookId) {
  const r = await db.query(
    'SELECT * FROM audiobook_chapters WHERE book_id=$1 ORDER BY sequence',
    [bookId]
  );
  return r.rows;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getOrCreateSession(db, userId, guildId) {
  const existing = await db.query(
    'SELECT * FROM audiobook_sessions WHERE user_id=$1 AND guild_id=$2',
    [userId, guildId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const id = `ses_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await db.query(
    `INSERT INTO audiobook_sessions (id, user_id, guild_id) VALUES ($1,$2,$3)`,
    [id, userId, guildId]
  );
  return (await db.query('SELECT * FROM audiobook_sessions WHERE id=$1', [id])).rows[0];
}

export async function updateSession(db, sessionId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  const vals = keys.map(k => fields[k]);
  await db.query(
    `UPDATE audiobook_sessions SET ${sets}, updated_at=NOW() WHERE id=$${keys.length + 1}`,
    [...vals, sessionId]
  );
}

export async function getSession(db, userId, guildId) {
  const r = await db.query(
    'SELECT * FROM audiobook_sessions WHERE user_id=$1 AND guild_id=$2',
    [userId, guildId]
  );
  return r.rows[0] ?? null;
}

// ── Voice preferences ─────────────────────────────────────────────────────────

export async function getVoicePrefs(db, userId) {
  const r = await db.query('SELECT * FROM audiobook_voice_prefs WHERE user_id=$1', [userId]);
  return r.rows[0] ?? { voice_id: 'narrator', speed: 1.0, preset: 'narrator' };
}

export async function saveVoicePrefs(db, userId, { voiceId, speed, preset }) {
  await db.query(
    `INSERT INTO audiobook_voice_prefs (user_id, voice_id, speed, preset, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET voice_id=$2, speed=$3, preset=$4, updated_at=NOW()`,
    [userId, voiceId, speed, preset]
  );
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export async function addBookmark(db, userId, bookId, chapterIndex, wordPosition, note) {
  await db.query(
    `INSERT INTO audiobook_bookmarks (user_id, book_id, chapter_index, word_position, note)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, bookId, chapterIndex, wordPosition, note ?? null]
  );
}

export async function getBookmarks(db, userId, bookId) {
  const r = await db.query(
    'SELECT * FROM audiobook_bookmarks WHERE user_id=$1 AND book_id=$2 ORDER BY created_at DESC LIMIT 20',
    [userId, bookId]
  );
  return r.rows;
}

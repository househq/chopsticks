export default {
  version: '20260223_000000',
  description: 'Audiobook feature: books, chapters, sessions, bookmarks, voice prefs',

  async up(client) {
    // Books — one row per uploaded file per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS audiobooks (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        guild_id    TEXT NOT NULL,
        title       TEXT NOT NULL,
        author      TEXT,
        format      TEXT NOT NULL,        -- txt|md|pdf|docx|epub
        total_chapters INT NOT NULL DEFAULT 0,
        total_words    INT NOT NULL DEFAULT 0,
        file_size      INT NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Chapters — content stored compressed
    await client.query(`
      CREATE TABLE IF NOT EXISTS audiobook_chapters (
        id          SERIAL PRIMARY KEY,
        book_id     TEXT NOT NULL REFERENCES audiobooks(id) ON DELETE CASCADE,
        sequence    INT NOT NULL,
        title       TEXT NOT NULL,
        content     TEXT NOT NULL,
        word_count  INT NOT NULL DEFAULT 0,
        UNIQUE(book_id, sequence)
      );
    `);

    // Active sessions — one per user per guild
    await client.query(`
      CREATE TABLE IF NOT EXISTS audiobook_sessions (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        guild_id        TEXT NOT NULL,
        book_id         TEXT REFERENCES audiobooks(id) ON DELETE SET NULL,
        thread_id       TEXT,
        current_chapter INT NOT NULL DEFAULT 0,
        word_position   INT NOT NULL DEFAULT 0,
        state           TEXT NOT NULL DEFAULT 'idle',  -- idle|loading|playing|paused|done
        voice_id        TEXT,
        speed           NUMERIC(3,2) NOT NULL DEFAULT 1.0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, guild_id)
      );
    `);

    // Bookmarks
    await client.query(`
      CREATE TABLE IF NOT EXISTS audiobook_bookmarks (
        id            SERIAL PRIMARY KEY,
        user_id       TEXT NOT NULL,
        book_id       TEXT NOT NULL REFERENCES audiobooks(id) ON DELETE CASCADE,
        chapter_index INT NOT NULL,
        word_position INT NOT NULL DEFAULT 0,
        note          TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Voice preferences per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS audiobook_voice_prefs (
        user_id   TEXT PRIMARY KEY,
        voice_id  TEXT NOT NULL DEFAULT 'en-US-GuyNeural',
        speed     NUMERIC(3,2) NOT NULL DEFAULT 1.0,
        preset    TEXT NOT NULL DEFAULT 'narrator',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_audiobooks_user ON audiobooks(user_id, guild_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audiobook_chapters_book ON audiobook_chapters(book_id, sequence);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audiobook_sessions_user ON audiobook_sessions(user_id, guild_id);`);
  },

  async down(client) {}
};

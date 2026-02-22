/**
 * Migration: Pool specializations, agent specializations, alliances, guild secondary pools
 *
 * Changes:
 * - agent_bots.specialty — enum column for agent specialization
 * - agent_pools.specialty — primary specialty for the pool (denormalized from meta for indexing)
 * - guild_pool_config — primary + up to 2 secondary pool IDs, preferred specialty
 * - pool_alliances — formal alliance between two pool owners
 * - pool_stats.badges_json — JSONB badge set earned by pool
 */
export const id = '20260222_010000';
export const description = 'Pool specializations, guild multi-pool config, alliances, badges';

const SPECIALTY_ENUM = ['music', 'voice_assistant', 'utility', 'relay', 'custom'];

export async function up(pool) {
  await pool.query(`
    -- Agent specialization column
    ALTER TABLE agent_bots
      ADD COLUMN IF NOT EXISTS specialty TEXT NOT NULL DEFAULT 'music'
        CHECK (specialty IN ('music','voice_assistant','utility','relay','custom'));

    -- Pool primary specialty column (for index/filter, mirrors meta.specialty)
    ALTER TABLE agent_pools
      ADD COLUMN IF NOT EXISTS specialty TEXT NOT NULL DEFAULT 'music'
        CHECK (specialty IN ('music','voice_assistant','utility','relay','custom'));

    -- Guild multi-pool config
    CREATE TABLE IF NOT EXISTS guild_pool_config (
      guild_id        TEXT        NOT NULL PRIMARY KEY,
      primary_pool_id TEXT        REFERENCES agent_pools(pool_id) ON DELETE SET NULL,
      secondary_pool_ids JSONB    NOT NULL DEFAULT '[]',
      preferred_specialty TEXT    NOT NULL DEFAULT 'music'
        CHECK (preferred_specialty IN ('music','voice_assistant','utility','relay','custom')),
      updated_at      BIGINT      NOT NULL DEFAULT 0
    );

    -- Pool alliances
    CREATE TABLE IF NOT EXISTS pool_alliances (
      id              SERIAL      PRIMARY KEY,
      pool_a_id       TEXT        NOT NULL REFERENCES agent_pools(pool_id) ON DELETE CASCADE,
      pool_b_id       TEXT        NOT NULL REFERENCES agent_pools(pool_id) ON DELETE CASCADE,
      initiated_by    TEXT        NOT NULL,
      status          TEXT        NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','active','dissolved')),
      created_at      BIGINT      NOT NULL DEFAULT 0,
      updated_at      BIGINT      NOT NULL DEFAULT 0,
      UNIQUE (pool_a_id, pool_b_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pool_alliances_a ON pool_alliances(pool_a_id);
    CREATE INDEX IF NOT EXISTS idx_pool_alliances_b ON pool_alliances(pool_b_id);

    -- Badges column on pool_stats
    ALTER TABLE pool_stats
      ADD COLUMN IF NOT EXISTS badges_json JSONB NOT NULL DEFAULT '[]';

    -- Index for specialty filtering
    CREATE INDEX IF NOT EXISTS idx_agent_pools_specialty ON agent_pools(specialty);
    CREATE INDEX IF NOT EXISTS idx_agent_bots_specialty  ON agent_bots(specialty);

    -- Backfill pool specialty from meta
    UPDATE agent_pools
      SET specialty = COALESCE(
        NULLIF(TRIM(meta->>'specialty'), ''),
        'music'
      )
    WHERE specialty = 'music';
  `);
}

export async function down(pool) {
  await pool.query(`
    DROP TABLE IF EXISTS pool_alliances;
    DROP TABLE IF EXISTS guild_pool_config;
    ALTER TABLE pool_stats   DROP COLUMN IF EXISTS badges_json;
    ALTER TABLE agent_pools  DROP COLUMN IF EXISTS specialty;
    ALTER TABLE agent_bots   DROP COLUMN IF EXISTS specialty;
  `);
}

export default { id, description, up, down };

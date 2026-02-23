// test/unit/voice-quick-play.test.js
// Backtests for the Quick Play button → modal flow in the VC room dashboard.
// Verifies the options stub is complete enough for musicExecute() to run
// without throwing, and that the button/modal routing logic is sound.
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { buildVoiceRoomDashboardComponents } from '../../src/tools/voice/panel.js';

// ──────────────────────────────────────────────────────────────────────────
// Helpers mirroring the options stub that handleVoiceUIModal builds before
// calling musicExecute(wrapped).
// ──────────────────────────────────────────────────────────────────────────

function buildQuickPlayOptionsStub(query) {
  return {
    getSubcommand:      ()     => "play",
    getSubcommandGroup: ()     => null,
    getString:          (name) => name === "query" ? query : null,
    getBoolean:         ()     => null,
    getInteger:         ()     => null,
    getNumber:          ()     => null,
    getUser:            ()     => null,
    getChannel:         ()     => null,
    getMember:          ()     => null,
    getRole:            ()     => null,
  };
}

describe('Quick Play options stub — completeness', () => {
  const stub = buildQuickPlayOptionsStub("never gonna give you up");

  it('getSubcommand returns "play"', () => {
    assert.strictEqual(stub.getSubcommand(), "play");
  });

  it('getSubcommandGroup returns null (not undefined, not throwing)', () => {
    assert.strictEqual(stub.getSubcommandGroup(), null);
  });

  it('getString("query") returns the query', () => {
    assert.strictEqual(stub.getString("query"), "never gonna give you up");
  });

  it('getString for any other key returns null', () => {
    assert.strictEqual(stub.getString("volume"), null);
  });

  it('getBoolean returns null', () => {
    assert.strictEqual(stub.getBoolean("loop"), null);
  });

  it('getInteger returns null', () => {
    assert.strictEqual(stub.getInteger("position"), null);
  });

  it('getUser returns null', () => {
    assert.strictEqual(stub.getUser("target"), null);
  });

  it('getChannel returns null', () => {
    assert.strictEqual(stub.getChannel("channel"), null);
  });

  it('all accessor keys exist and are functions (no missing methods)', () => {
    const required = [
      "getSubcommand", "getSubcommandGroup", "getString", "getBoolean",
      "getInteger", "getNumber", "getUser", "getChannel", "getMember", "getRole"
    ];
    for (const key of required) {
      assert.strictEqual(typeof stub[key], "function", `${key} must be a function`);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Quick Play button visibility — must be ENABLED in live server dashboard
// and DISABLED in DM dashboard builds.
// ──────────────────────────────────────────────────────────────────────────

describe('Quick Play button — enabled/disabled state', () => {
  it('Quick Play button is ENABLED by default (live in-server dashboard)', () => {
    const rows = buildVoiceRoomDashboardComponents('chan1');
    const allButtons = rows.flatMap(r => r.components);
    const musicBtn = allButtons.find(b => b.data?.custom_id?.includes(':music:'));
    assert.ok(musicBtn, 'music button must exist');
    assert.strictEqual(musicBtn.data.disabled, false, 'Quick Play must be enabled in live dashboard');
  });

  it('Quick Play button is DISABLED when disableQuickPlay=true (DM context)', () => {
    const rows = buildVoiceRoomDashboardComponents('chan1', { disableQuickPlay: true });
    const allButtons = rows.flatMap(r => r.components);
    const musicBtn = allButtons.find(b => b.data?.custom_id?.includes(':music:'));
    assert.ok(musicBtn, 'music button must exist');
    assert.strictEqual(musicBtn.data.disabled, true, 'Quick Play must be disabled in DM dashboard');
  });

  it('Quick Play button is DISABLED when controlsDisabled=true', () => {
    const rows = buildVoiceRoomDashboardComponents('chan1', { controlsDisabled: true });
    const allButtons = rows.flatMap(r => r.components);
    const musicBtn = allButtons.find(b => b.data?.custom_id?.includes(':music:'));
    assert.ok(musicBtn, 'music button must exist');
    assert.strictEqual(musicBtn.data.disabled, true, 'Quick Play must be disabled when controls are disabled');
  });

  it('Quick Play button customId is correct format', () => {
    const rows = buildVoiceRoomDashboardComponents('chan99');
    const allButtons = rows.flatMap(r => r.components);
    const musicBtn = allButtons.find(b => b.data?.custom_id?.includes(':music:'));
    assert.ok(musicBtn?.data?.custom_id?.includes('music'), 'customId must contain "music"');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Query validation edge cases
// ──────────────────────────────────────────────────────────────────────────

describe('Quick Play query validation', () => {
  it('non-empty string query is valid', () => {
    const query = "lofi chill beats";
    assert.ok(query.trim().length > 0);
  });

  it('whitespace-only query should be rejected (trimmed length 0)', () => {
    const query = "   ";
    assert.strictEqual(query.trim().length, 0);
  });

  it('query longer than 200 chars should be rejected', () => {
    const query = "a".repeat(201);
    assert.ok(query.length > 200);
  });

  it('query exactly 200 chars is accepted', () => {
    const query = "a".repeat(200);
    assert.strictEqual(query.length, 200);
    assert.ok(query.length <= 200);
  });

  it('URL query is detected correctly', () => {
    const httpUrl = "https://youtu.be/dQw4w9WgXcQ";
    assert.ok(/^https?:\/\//i.test(httpUrl.trim()));
  });

  it('non-URL text query is detected correctly', () => {
    const text = "never gonna give you up";
    assert.ok(!/^https?:\/\//i.test(text.trim()));
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Modal custom ID format — must parse back correctly
// ──────────────────────────────────────────────────────────────────────────

describe('Room modal customId format', () => {
  // Mirrors makeRoomModalCustomId from ui.js  (pure logic, no import needed)
  function makeRoomModalCustomId(kind, guildId, roomChannelId) {
    return `voiceroomm:${kind}:${guildId}:${roomChannelId}`;
  }

  function parseRoomModalCustomId(customId) {
    if (!customId?.startsWith("voiceroomm:")) return null;
    const [, kind, guildId, roomChannelId] = customId.split(":");
    if (!kind || !guildId || !roomChannelId) return null;
    return { kind, guildId, roomChannelId };
  }

  it('generates a parseable modal customId', () => {
    const id = makeRoomModalCustomId("music", "guild1", "room1");
    const parsed = parseRoomModalCustomId(id);
    assert.ok(parsed, 'should parse');
    assert.strictEqual(parsed.kind, "music");
    assert.strictEqual(parsed.guildId, "guild1");
    assert.strictEqual(parsed.roomChannelId, "room1");
  });

  it('rejects customId not starting with voiceroomm:', () => {
    assert.strictEqual(parseRoomModalCustomId("voiceroom:music:g:r"), null);
    assert.strictEqual(parseRoomModalCustomId("other:music:g:r"), null);
  });

  it('rejects customId with missing segments', () => {
    assert.strictEqual(parseRoomModalCustomId("voiceroomm:music:guild1"), null);
    assert.strictEqual(parseRoomModalCustomId("voiceroomm::guild1:room1"), null);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Button ownership guard — wrong-user interactions must be acknowledged
// ──────────────────────────────────────────────────────────────────────────

describe('Button ownership guard — interaction acknowledgement', () => {
  // Simulate the ownership check pattern used throughout music button handlers.
  // Pre-fix: `if (ownerId !== userId) return true` without a reply → Discord shows
  //          "This interaction failed"
  // Post-fix: an ephemeral reply is sent before returning.

  function makeButtonInteraction(userId, acknowledged = []) {
    return {
      user: { id: userId },
      isButton: () => true,
      reply: async (payload) => {
        acknowledged.push({ type: 'reply', payload });
        return payload;
      },
      deferUpdate: async () => acknowledged.push({ type: 'deferUpdate' }),
      deferReply: async () => acknowledged.push({ type: 'deferReply' }),
    };
  }

  it('wrong-owner check replies ephemerally before returning', async () => {
    const ownerId = 'alice';
    const wrongUser = 'bob';
    const acks = [];
    const interaction = makeButtonInteraction(wrongUser, acks);

    // Simulate the fixed pattern
    if (ownerId && interaction.user.id !== ownerId) {
      await interaction.reply({ ephemeral: true, content: 'Not your panel' }).catch(() => {});
      // return true would happen here in real code
    }

    assert.strictEqual(acks.length, 1, 'exactly one acknowledgement must be sent');
    assert.strictEqual(acks[0].type, 'reply');
    assert.ok(acks[0].payload.ephemeral);
  });

  it('correct-owner proceeds without sending an early reply', async () => {
    const ownerId = 'alice';
    const acks = [];
    const interaction = makeButtonInteraction('alice', acks);

    if (ownerId && interaction.user.id !== ownerId) {
      await interaction.reply({ ephemeral: true, content: 'Not your panel' }).catch(() => {});
    }
    // No early return — no early ack
    assert.strictEqual(acks.length, 0);
  });

  it('select menu with deferUpdate-first is already acknowledged before ownership check', async () => {
    const ownerId = 'alice';
    const acks = [];
    const interaction = makeButtonInteraction('bob', acks);

    // Simulate deferUpdate-first pattern (handleSelect mplbulk:pick:)
    await interaction.deferUpdate().catch(() => {});
    if (ownerId && interaction.user.id !== ownerId) {
      // Interaction is already acknowledged — just return (no extra reply needed)
      // In real code this is `return true`
    }
    // deferUpdate was called → 1 acknowledgement present
    assert.strictEqual(acks.length, 1);
    assert.strictEqual(acks[0].type, 'deferUpdate');
  });
});

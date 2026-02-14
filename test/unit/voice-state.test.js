import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { getTempChannelRecord, hasUserTempChannel } from '../../src/tools/voice/state.js';

describe('Voice state helpers', function () {
  it('reads temp channel records from voice state', function () {
    const voice = {
      tempChannels: {
        temp123: { ownerId: 'user1', lobbyId: 'lobby1', createdAt: Date.now() }
      }
    };

    const record = getTempChannelRecord('guild-a', 'temp123', voice);
    assert.ok(record);
    assert.equal(record.ownerId, 'user1');
    assert.equal(record.lobbyId, 'lobby1');
  });

  it('checks whether a user owns any temp channel', function () {
    const voice = {
      tempChannels: {
        tempA: { ownerId: 'user1', lobbyId: 'lobby1', createdAt: Date.now() },
        tempB: { ownerId: 'user2', lobbyId: 'lobby2', createdAt: Date.now() }
      }
    };

    assert.equal(hasUserTempChannel('guild-b', 'user1', voice), true);
    assert.equal(hasUserTempChannel('guild-b', 'missing', voice), false);
  });
});

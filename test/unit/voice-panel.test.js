import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { ensurePanelConfig, resolvePanelDelivery } from '../../src/tools/voice/panel.js';

describe('Voice panel delivery defaults', function () {
  it('initializes panel config when missing', function () {
    const voice = {};
    ensurePanelConfig(voice);
    assert.ok(voice.panel);
    assert.ok(voice.panel.guildDefault);
    assert.equal(voice.panel.guildDefault.mode, 'temp');
  });

  it('resolves guild default when user has no override', function () {
    const voice = {
      panel: {
        guildDefault: { mode: 'dm', channelId: null, autoSendOnCreate: true },
        userDefaults: {}
      }
    };
    const resolved = resolvePanelDelivery(voice, 'u1');
    assert.equal(resolved.mode, 'dm');
    assert.equal(resolved.autoSendOnCreate, true);
  });

  it('prefers user override when present', function () {
    const voice = {
      panel: {
        guildDefault: { mode: 'temp', channelId: 'c1', autoSendOnCreate: true },
        userDefaults: {
          u1: { mode: 'both', channelId: 'c2', autoSendOnCreate: false }
        }
      }
    };
    const resolved = resolvePanelDelivery(voice, 'u1');
    assert.equal(resolved.mode, 'both');
    assert.equal(resolved.channelId, 'c2');
    assert.equal(resolved.autoSendOnCreate, false);
  });
});

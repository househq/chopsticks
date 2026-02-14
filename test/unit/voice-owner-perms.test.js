import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import {
  coerceOwnerPermissions,
  applyOwnerPermissionPatch,
  describeOwnerPermissions,
  ownerPermissionOverwrite
} from '../../src/tools/voice/ownerPerms.js';

describe('Voice owner permission templates', function () {
  it('applies safe defaults', function () {
    const perms = coerceOwnerPermissions(null);
    assert.equal(perms.manageChannels, true);
    assert.equal(perms.moveMembers, true);
    assert.equal(perms.muteMembers, false);
  });

  it('merges partial patches', function () {
    const current = coerceOwnerPermissions(null);
    const next = applyOwnerPermissionPatch(current, { muteMembers: true, moveMembers: false });
    assert.equal(next.manageChannels, true);
    assert.equal(next.moveMembers, false);
    assert.equal(next.muteMembers, true);
  });

  it('builds overwrite object from enabled permissions', function () {
    const overwrite = ownerPermissionOverwrite({ manageChannels: true, moveMembers: false, muteMembers: true });
    assert.equal(overwrite.ManageChannels, true);
    assert.equal(overwrite.MuteMembers, true);
    assert.equal(Object.hasOwn(overwrite, 'MoveMembers'), false);
  });

  it('describes enabled permission labels', function () {
    const text = describeOwnerPermissions({ manageChannels: true, moveMembers: true, deafenMembers: true });
    assert.ok(text.includes('Manage Channels'));
    assert.ok(text.includes('Move Members'));
    assert.ok(text.includes('Deafen Members'));
  });
});

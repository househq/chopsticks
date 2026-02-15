import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { data as helpCommand } from '../../src/commands/help.js';

describe('Help command definition', function () {
  it('supports command query and all listing options', function () {
    const json = helpCommand.toJSON();
    const optionMap = new Map((json.options || []).map(o => [o.name, o]));

    assert.ok(optionMap.has('command'));
    assert.ok(optionMap.has('all'));
    assert.equal(optionMap.get('command').autocomplete, true);
  });
});

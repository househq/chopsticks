import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { data as helpCommand, handleSelect } from '../../src/commands/help.js';

describe('Help command definition', function () {
  it('is a single /help command with no options', function () {
    const json = helpCommand.toJSON();
    const options = json.options || [];
    assert.equal(json.name, 'help');
    assert.equal(options.length, 0);
  });

  it('exports select handler for help dropdown', function () {
    assert.equal(typeof handleSelect, 'function');
  });
});

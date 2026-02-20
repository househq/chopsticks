import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { data as helpCommand, handleSelect } from '../../src/commands/help.js';

describe('Help command definition', function () {
  it('has subcommands for browse, search, and command', function () {
    const json = helpCommand.toJSON();
    const options = json.options || [];
    assert.equal(json.name, 'help');
    assert.equal(options.length, 3, 'Should have 3 subcommands');
    
    const subcommandNames = options.map(opt => opt.name);
    assert.ok(subcommandNames.includes('browse'), 'Should have browse subcommand');
    assert.ok(subcommandNames.includes('search'), 'Should have search subcommand');
    assert.ok(subcommandNames.includes('command'), 'Should have command subcommand');
  });

  it('exports select handler for help dropdown', function () {
    assert.equal(typeof handleSelect, 'function');
  });
});

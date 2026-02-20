// test/unit/help-registry.test.js
// Unit tests for help registry

import assert from 'assert';
import {
  registerCommand,
  getCommands,
  getCommand,
  getAllCommandNames,
  clearRegistry
} from '../../src/utils/helpRegistry.js';

describe('Help Registry', function() {
  beforeEach(function() {
    clearRegistry();
  });
  
  describe('registerCommand', function() {
    it('should register a command with metadata', function() {
      const metadata = {
        name: 'testcmd',
        category: 'test',
        description: 'Test command',
        usage: '/testcmd',
        examples: ['/testcmd'],
        permissions: [],
        context: ['guild'],
        keywords: ['test']
      };
      
      registerCommand(metadata);
      const retrieved = getCommand('testcmd');
      
      assert.strictEqual(retrieved.name, 'testcmd');
      assert.strictEqual(retrieved.category, 'test');
    });
    
    it('should throw error if name is missing', function() {
      assert.throws(() => {
        registerCommand({ category: 'test' });
      }, /must include 'name' field/);
    });
  });
  
  describe('getCommands', function() {
    beforeEach(function() {
      registerCommand({
        name: 'balance',
        category: 'economy',
        description: 'Check balance',
        permissions: [],
        context: ['guild']
      });
      
      registerCommand({
        name: 'ban',
        category: 'moderation',
        description: 'Ban user',
        permissions: ['BanMembers'],
        context: ['guild']
      });
    });
    
    it('should return all commands when no filter', function() {
      const commands = getCommands();
      assert.ok(commands.length >= 2);
    });
    
    it('should filter by category', function() {
      const ecoCommands = getCommands({ category: 'economy' });
      assert.strictEqual(ecoCommands.length, 1);
      assert.strictEqual(ecoCommands[0].name, 'balance');
    });
    
    it('should filter by required permission', function() {
      const adminCommands = getCommands({ requiresPermission: 'BanMembers' });
      assert.strictEqual(adminCommands.length, 1);
      assert.strictEqual(adminCommands[0].name, 'ban');
    });
  });
  
  describe('getAllCommandNames', function() {
    it('should return array of command names', function() {
      registerCommand({ name: 'test1', category: 'test' });
      registerCommand({ name: 'test2', category: 'test' });
      
      const names = getAllCommandNames();
      assert.ok(names.includes('test1'));
      assert.ok(names.includes('test2'));
    });
  });
  
  describe('getCommand', function() {
    it('should return command metadata by name', function() {
      registerCommand({
        name: 'balance',
        category: 'economy',
        description: 'Check balance'
      });
      
      const cmd = getCommand('balance');
      assert.strictEqual(cmd.name, 'balance');
      assert.strictEqual(cmd.category, 'economy');
    });
    
    it('should be case-insensitive', function() {
      registerCommand({
        name: 'Balance',
        category: 'economy',
        description: 'Check balance'
      });
      
      const cmd = getCommand('BALANCE');
      assert.ok(cmd);
      assert.strictEqual(cmd.name, 'Balance');
    });
    
    it('should return null for unknown command', function() {
      const cmd = getCommand('nonexistent');
      assert.strictEqual(cmd, null);
    });
  });
});

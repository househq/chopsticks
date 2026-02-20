// test/unit/help-search.test.js
// Unit tests for help search functionality

import assert from 'assert';
import { searchCommands, getAutocompleteSuggestions, isExactOrPrefixMatch } from '../../src/utils/helpSearch.js';
import { registerCommand, clearRegistry } from '../../src/utils/helpRegistry.js';

describe('Help Search', function() {
  beforeEach(function() {
    clearRegistry();
    
    // Register test commands
    registerCommand({
      name: 'balance',
      category: 'economy',
      description: 'Check your Credit balance',
      keywords: ['balance', 'credits', 'money']
    });
    
    registerCommand({
      name: 'ban',
      category: 'moderation',
      description: 'Ban a user from the server',
      keywords: ['ban', 'remove', 'kick']
    });
    
    registerCommand({
      name: 'play',
      category: 'music',
      description: 'Play music in voice channel',
      keywords: ['play', 'music', 'audio']
    });
  });
  
  describe('searchCommands', function() {
    it('should find exact match', function() {
      const results = searchCommands('balance');
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].name, 'balance');
    });
    
    it('should find fuzzy match', function() {
      const results = searchCommands('balanc'); // Missing 'e'
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].name, 'balance');
    });
    
    it('should match by keyword', function() {
      const results = searchCommands('credits');
      assert.ok(results.length > 0);
      assert.ok(results.some(r => r.name === 'balance'));
    });
    
    it('should return empty array for no matches', function() {
      const results = searchCommands('xyzabc');
      assert.strictEqual(results.length, 0);
    });
    
    it('should limit results', function() {
      const results = searchCommands('a', 2);
      assert.ok(results.length <= 2);
    });
    
    it('should return empty for short query', function() {
      const results = searchCommands('a');
      assert.strictEqual(results.length, 0);
    });
  });
  
  describe('getAutocompleteSuggestions', function() {
    it('should return popular commands for empty query', function() {
      const suggestions = getAutocompleteSuggestions('');
      assert.ok(suggestions.length > 0);
      assert.ok(suggestions.every(s => s.name && s.value));
    });
    
    it('should return search results for query', function() {
      const suggestions = getAutocompleteSuggestions('ban');
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0].value, 'ban');
    });
    
    it('should format for Discord autocomplete', function() {
      const suggestions = getAutocompleteSuggestions('balance');
      assert.ok(suggestions[0].name.includes('balance'));
      assert.ok(suggestions[0].name.includes('Check your Credit balance'));
    });
  });
  
  describe('isExactOrPrefixMatch', function() {
    it('should match exact', function() {
      assert.strictEqual(isExactOrPrefixMatch('balance', 'balance'), true);
    });
    
    it('should match prefix', function() {
      assert.strictEqual(isExactOrPrefixMatch('balance', 'bal'), true);
    });
    
    it('should be case-insensitive', function() {
      assert.strictEqual(isExactOrPrefixMatch('Balance', 'BALANCE'), true);
    });
    
    it('should not match non-prefix', function() {
      assert.strictEqual(isExactOrPrefixMatch('balance', 'lance'), false);
    });
  });
});

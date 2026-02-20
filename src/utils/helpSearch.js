// src/utils/helpSearch.js
// Fuzzy search for help system using Fuse.js

import Fuse from 'fuse.js';
import { getAllCommandNames, getCommand } from './helpRegistry.js';

/**
 * Create Fuse.js instance for command search
 * @param {Array} commands - Array of command metadata objects
 * @returns {Fuse}
 */
function createSearchIndex(commands) {
  const fuseOptions = {
    keys: ['name', 'description', 'keywords'],
    threshold: 0.3, // Lower = stricter matching
    includeScore: true,
    minMatchCharLength: 2
  };
  
  return new Fuse(commands, fuseOptions);
}

let searchIndex = null;
let lastIndexUpdate = 0;
const INDEX_TTL_MS = 60000; // Re-index every 60 seconds

/**
 * Get or create search index
 * @returns {Fuse}
 */
function getSearchIndex() {
  const now = Date.now();
  if (!searchIndex || (now - lastIndexUpdate) > INDEX_TTL_MS) {
    const commandNames = getAllCommandNames();
    const commands = commandNames.map(name => getCommand(name)).filter(Boolean);
    searchIndex = createSearchIndex(commands);
    lastIndexUpdate = now;
  }
  return searchIndex;
}

/**
 * Search commands with fuzzy matching
 * @param {string} query - Search query
 * @param {number} limit - Max results to return (default: 10)
 * @returns {Array} Array of {name, score, metadata}
 */
export function searchCommands(query, limit = 10) {
  if (!query || typeof query !== 'string') {
    return [];
  }
  
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }
  
  const index = getSearchIndex();
  const results = index.search(trimmed, { limit });
  
  // Transform results
  return results.map(result => ({
    name: result.item.name,
    score: result.score,
    metadata: result.item
  }));
}

/**
 * Get autocomplete suggestions for Discord
 * @param {string} query - User's current input
 * @param {number} limit - Max suggestions (Discord max is 25)
 * @returns {Array} Array of {name, value}
 */
export function getAutocompleteSuggestions(query, limit = 25) {
  // Empty or very short query - return popular commands
  if (!query || query.trim().length < 2) {
    const popularCommands = ['help', 'ping', 'balance', 'play', 'ban', 'purge'];
    return popularCommands.slice(0, limit).map(name => ({
      name: name,
      value: name
    }));
  }
  
  const results = searchCommands(query, limit);
  
  // Format for Discord autocomplete
  return results.map(result => ({
    name: `${result.name} - ${result.metadata.description.slice(0, 80)}`,
    value: result.name
  }));
}

/**
 * Check if a command name matches query (for exact/prefix matching)
 * @param {string} commandName - Command name
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function isExactOrPrefixMatch(commandName, query) {
  const cmd = commandName.toLowerCase();
  const q = query.toLowerCase().trim();
  return cmd === q || cmd.startsWith(q);
}

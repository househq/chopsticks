// src/utils/helpRegistry.js
// Centralized command metadata registry for help system

/**
 * Command metadata schema
 * @typedef {Object} CommandMetadata
 * @property {string} name - Command name
 * @property {string} category - Category key
 * @property {string} description - Short description
 * @property {string} usage - Usage syntax
 * @property {string[]} examples - Example invocations
 * @property {string[]} permissions - Required permissions
 * @property {string[]} context - Contexts where command works (guild/dm)
 * @property {string[]} keywords - Search keywords
 * @property {string[]} aliases - Command aliases
 */

const commandRegistry = new Map();

/**
 * Register command metadata
 * @param {CommandMetadata} metadata 
 */
export function registerCommand(metadata) {
  if (!metadata || !metadata.name) {
    throw new Error("Command metadata must include 'name' field");
  }
  commandRegistry.set(metadata.name.toLowerCase(), metadata);
}

/**
 * Get all commands matching filter
 * @param {Object} filter
 * @param {string} filter.category - Filter by category
 * @param {string} filter.requiresPermission - Filter by permission
 * @param {boolean} filter.dmSupported - Filter DM-supported commands
 * @returns {CommandMetadata[]}
 */
export function getCommands(filter = {}) {
  let commands = Array.from(commandRegistry.values());
  
  if (filter.category) {
    commands = commands.filter(cmd => cmd.category === filter.category);
  }
  
  if (filter.requiresPermission) {
    commands = commands.filter(cmd => 
      cmd.permissions?.includes(filter.requiresPermission)
    );
  }
  
  if (filter.dmSupported !== undefined) {
    commands = commands.filter(cmd => 
      cmd.context?.includes('dm') === filter.dmSupported
    );
  }
  
  return commands;
}

/**
 * Get command metadata by name
 * @param {string} name - Command name
 * @returns {CommandMetadata|null}
 */
export function getCommand(name) {
  return commandRegistry.get(name.toLowerCase()) || null;
}

/**
 * Get all registered command names
 * @returns {string[]}
 */
export function getAllCommandNames() {
  return Array.from(commandRegistry.keys());
}

/**
 * Export registry as JSON for debugging
 * @returns {Object}
 */
export function exportRegistry() {
  return Object.fromEntries(commandRegistry);
}

/**
 * Clear registry (for testing)
 */
export function clearRegistry() {
  commandRegistry.clear();
}

// Register core commands with metadata
const coreCommands = [
  {
    name: 'help',
    category: 'core',
    description: 'Show the Chopsticks help center with category navigation',
    usage: '/help',
    examples: ['/help', '/help (then select a category)'],
    permissions: [],
    context: ['guild', 'dm'],
    keywords: ['help', 'commands', 'guide', 'docs', 'documentation']
  },
  {
    name: 'ping',
    category: 'core',
    description: 'Check bot latency and API response time',
    usage: '/ping',
    examples: ['/ping'],
    permissions: [],
    context: ['guild', 'dm'],
    keywords: ['ping', 'latency', 'lag', 'speed', 'status']
  },
  {
    name: 'balance',
    category: 'economy',
    description: 'Check your Credit balance and vault holdings',
    usage: '/balance [user:@mention]',
    examples: [
      '/balance',
      '/balance user:@JohnDoe'
    ],
    permissions: [],
    context: ['guild'],
    keywords: ['balance', 'credits', 'money', 'currency', 'wealth']
  },
  {
    name: 'ban',
    category: 'moderation',
    description: 'Ban a user from the server',
    usage: '/ban user:<@user> [reason:<text>] [delete_days:<0-7>]',
    examples: [
      '/ban user:@SpamBot reason:Posting spam',
      '/ban user:@Troll delete_days:7 reason:Repeated violations'
    ],
    permissions: ['BanMembers'],
    context: ['guild'],
    keywords: ['ban', 'remove', 'kick', 'punishment', 'moderation']
  },
  {
    name: 'play',
    category: 'music',
    description: 'Play or queue a track in your voice channel',
    usage: '/music play query:<search or URL>',
    examples: [
      '/music play query:Never Gonna Give You Up',
      '/music play query:https://youtube.com/watch?v=...'
    ],
    permissions: [],
    context: ['guild'],
    keywords: ['play', 'music', 'song', 'audio', 'youtube', 'spotify']
  },
  {
    name: 'purge',
    category: 'moderation',
    description: 'Bulk delete messages with filters',
    usage: '/purge count:<1-100> [user:@mention] [contains:<text>]',
    examples: [
      '/purge count:50',
      '/purge count:100 user:@SpamBot',
      '/purge count:20 contains:http'
    ],
    permissions: ['ManageMessages'],
    context: ['guild'],
    keywords: ['purge', 'delete', 'clear', 'cleanup', 'bulk', 'messages']
  }
];

// Auto-register core commands
coreCommands.forEach(cmd => registerCommand(cmd));

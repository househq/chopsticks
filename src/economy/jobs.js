// src/economy/jobs.js
// Job definitions and work cooldown — shared by /game and the prefix !work command.

export const WORK_COOLDOWN = 30 * 60 * 1000; // 30 minutes

export const JOBS = [
  {
    id: "programmer",
    name: "Code Review",
    emoji: "💻",
    description: "Debug legacy code for a tech startup",
    baseReward: 300,
    variance: 100,
    itemChance: 0.15,
    possibleItems: ["data_fragment", "corrupted_file"]
  },
  {
    id: "musician",
    name: "DJ Gig",
    emoji: "🎵",
    description: "Perform at a virtual nightclub",
    baseReward: 250,
    variance: 80,
    itemChance: 0.1,
    possibleItems: ["data_fragment"]
  },
  {
    id: "miner",
    name: "Data Mining",
    emoji: "⛏️",
    description: "Extract valuable data from abandoned servers",
    baseReward: 350,
    variance: 120,
    itemChance: 0.2,
    possibleItems: ["data_fragment", "encryption_key", "neural_chip"]
  },
  {
    id: "trader",
    name: "Market Trading",
    emoji: "📈",
    description: "Flip items on the marketplace",
    baseReward: 400,
    variance: 150,
    itemChance: 0.05,
    possibleItems: ["hologram_badge"]
  }
];

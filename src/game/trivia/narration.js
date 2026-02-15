// src/game/trivia/narration.js

const OPENERS = [
  "A lantern flares. The Dungeon Master speaks:",
  "The air crackles with static. The Dungeon Master declares:",
  "A parchment unrolls across the table. The Dungeon Master intones:",
  "A clockwork raven lands nearby. The Dungeon Master announces:"
];

const PROMPTS = [
  "Answer wisely. The opponent is watching.",
  "Pick fast. Hesitation is a tax.",
  "Choose carefully. One option is the true rune.",
  "No pressure. Only glory."
];

export function pickDmIntro() {
  const a = OPENERS[Math.floor(Math.random() * OPENERS.length)] || OPENERS[0];
  const b = PROMPTS[Math.floor(Math.random() * PROMPTS.length)] || PROMPTS[0];
  return `${a}\n${b}`;
}

export function pickAgentThinkingLine(agentTag = "Agent") {
  const LINES = [
    `${agentTag} hums quietly...`,
    `${agentTag} scans the choices...`,
    `${agentTag} taps the table in a perfect rhythm...`,
    `${agentTag} calculates probabilities...`
  ];
  return LINES[Math.floor(Math.random() * LINES.length)] || `${agentTag} is thinking...`;
}


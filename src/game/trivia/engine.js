// src/game/trivia/engine.js
import { randomUUID } from "node:crypto";

export function makeTriviaSessionId() {
  // Short, URL-safe.
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function shuffleChoices(choices, answerIndex) {
  const arr = choices.map((text, i) => ({ text: String(text), i }));
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    const tmp = arr[j];
    arr[j] = arr[k];
    arr[k] = tmp;
  }
  const shuffled = arr.map(x => x.text);
  const correctIndex = Math.max(0, arr.findIndex(x => x.i === answerIndex));
  return { shuffled, correctIndex };
}

export function agentAccuracyForDifficulty(difficulty) {
  const d = String(difficulty || "normal").toLowerCase();
  if (d === "easy") return 0.55;
  if (d === "hard") return 0.85;
  if (d === "nightmare") return 0.95;
  return 0.7; // normal
}

export function agentDelayRangeMs(difficulty) {
  const d = String(difficulty || "normal").toLowerCase();
  if (d === "easy") return [2500, 5500];
  if (d === "hard") return [1100, 3500];
  if (d === "nightmare") return [800, 2500];
  return [1600, 4200];
}

export function pickAgentAnswer({ correctIndex, choicesLen, difficulty }) {
  const n = Math.max(2, Math.trunc(Number(choicesLen) || 4));
  const p = agentAccuracyForDifficulty(difficulty);
  const correct = Math.random() < p;
  if (correct) return correctIndex;

  // Wrong answer: uniform among the other indices.
  const pool = [];
  for (let i = 0; i < n; i++) {
    if (i !== correctIndex) pool.push(i);
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? 0;
}

export function computeReward({ difficulty, result, answeredBeforeAgent = false }) {
  const d = String(difficulty || "normal").toLowerCase();
  const baseCredits = d === "easy" ? 45 : d === "hard" ? 110 : d === "nightmare" ? 190 : 75;
  const baseXp = d === "easy" ? 12 : d === "hard" ? 28 : d === "nightmare" ? 45 : 18;

  // result: win | lose | tie
  if (result === "win") {
    const speedBonus = answeredBeforeAgent ? 0.25 : 0.1;
    return {
      credits: Math.max(1, Math.round(baseCredits * (1 + speedBonus))),
      xp: Math.max(1, Math.round(baseXp * (1 + speedBonus)))
    };
  }
  if (result === "tie") {
    return {
      credits: Math.max(1, Math.round(baseCredits * 0.35)),
      xp: Math.max(1, Math.round(baseXp * 0.35))
    };
  }
  // lose
  return {
    credits: Math.max(0, Math.round(baseCredits * 0.05)),
    xp: Math.max(1, Math.round(baseXp * 0.15))
  };
}

export function formatDifficulty(difficulty) {
  const d = String(difficulty || "normal").toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  if (d === "nightmare") return "Nightmare";
  return "Normal";
}


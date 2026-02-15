// src/game/trivia/session.js
import { getCache, setCache, delCache } from "../../utils/redis.js";

function sessKey(sessionId) {
  return `trivia:sess:${sessionId}`;
}

function activeKey(guildId, channelId, userId) {
  return `trivia:active:${guildId}:${channelId}:${userId}`;
}

export async function getActiveTriviaSessionId({ guildId, channelId, userId }) {
  return await getCache(activeKey(guildId, channelId, userId));
}

export async function setActiveTriviaSessionId({ guildId, channelId, userId, sessionId, ttlSeconds }) {
  return await setCache(activeKey(guildId, channelId, userId), String(sessionId), ttlSeconds);
}

export async function clearActiveTriviaSessionId({ guildId, channelId, userId }) {
  return await delCache(activeKey(guildId, channelId, userId));
}

export async function loadTriviaSession(sessionId) {
  const s = await getCache(sessKey(sessionId));
  if (!s || typeof s !== "object") return null;
  return s;
}

export async function saveTriviaSession(sessionId, session, ttlSeconds) {
  return await setCache(sessKey(sessionId), session, ttlSeconds);
}

export async function deleteTriviaSession(sessionId) {
  return await delCache(sessKey(sessionId));
}


// src/tools/music/domain.js
// RUNTIME-ONLY CONTROL DISPATCH
// NO IO / NO ENV ACCESS AT IMPORT TIME

import WebSocket from "ws";

let ws = null;

function requireControlUrl() {
  const url = process.env.CONTROL_URL;
  if (!url) {
    throw new Error("CONTROL_URL missing at runtime");
  }
  return url;
}

function getSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

  const url = requireControlUrl();
  ws = new WebSocket(url);
  return ws;
}

export function sendControl(payload) {
  const socket = getSocket();

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return;
  }

  socket.once("open", () => {
    socket.send(JSON.stringify(payload));
  });
}

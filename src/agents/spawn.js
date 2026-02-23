// src/agents/spawn.js
import { spawn } from "node:child_process";
import { botLogger } from "../utils/modernLogger.js";

export function spawnAgentsProcess() {
  // Prevent recursion if agentRunner ever imports main
  if (process.env.CHOPSTICKS_AGENT_CHILD === "1") return null;

  const child = spawn(process.execPath, ["src/agents/agentRunner.js"], {
    stdio: "inherit",
    env: { ...process.env, CHOPSTICKS_AGENT_CHILD: "1" }
  });

  const stop = () => {
    try {
      child.kill("SIGTERM");
    } catch {}
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.once("exit", stop);

  child.on("exit", code => {
    if (code && code !== 0) {
      botLogger.error({ code }, "[agents] process exited with code %d", code);
    }
  });

  return child;
}

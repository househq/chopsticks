import pino from "pino";

// Corporate-grade structured logging with Pino (40x faster than Winston)
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
      singleLine: false
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: {
    env: process.env.NODE_ENV || "development",
    service: "chopsticks-bot",
  },
},
// U3: In-memory error buffer — used by /api/monitor/errors dashboard endpoint
{
  write(msg) {
    process.stdout.write(msg);
    try {
      const parsed = JSON.parse(msg);
      if (parsed.level === "ERROR" || parsed.level === "WARN") {
        if (!global._recentErrors) global._recentErrors = [];
        global._recentErrors.push({
          ts: parsed.time || Date.now(),
          level: parsed.level,
          msg: parsed.msg,
          module: parsed.module,
          err: parsed.err?.message ?? null,
        });
        // Cap at 500 entries
        if (global._recentErrors.length > 500) global._recentErrors.shift();
      }
    } catch { /* never fail on log parse */ }
  }
});

// Specific loggers for different subsystems
export const botLogger = logger.child({ module: "bot" });
export const musicLogger = logger.child({ module: "music" });
export const economyLogger = logger.child({ module: "economy" });
export const securityLogger = logger.child({ module: "security" });
export const poolLogger = logger.child({ module: "agent-pool" });
export const dashboardLogger = logger.child({ module: "dashboard" });

export default logger;

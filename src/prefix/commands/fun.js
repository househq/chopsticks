import { reply, parseIntSafe } from "../helpers.js";
import { clampIntensity } from "../../fun/variants.js";
import {
  getFunCatalog,
  randomFunFromRuntime,
  renderFunFromRuntime,
  resolveVariantId
} from "../../fun/runtime.js";

function parseFunIntensity(args) {
  let intensity = 3;
  const next = [];

  for (const token of args) {
    const match =
      /^--?intensity=(\d+)$/i.exec(token) ||
      /^-i=(\d+)$/i.exec(token) ||
      /^(\d)$/.exec(token);
    if (match) {
      intensity = clampIntensity(Number(match[1]));
      continue;
    }
    next.push(token);
  }

  return { intensity, args: next };
}

export default [
  {
    name: "roll",
    description: "Roll a die",
    rateLimit: 2000,
    async execute(message, args) {
      const sides = parseIntSafe(args[0] || "6", 2, 100) || 6;
      const roll = Math.floor(Math.random() * sides) + 1;
      await reply(message, `🎲 ${roll} (d${sides})`);
    }
  },
  {
    name: "coinflip",
    description: "Flip a coin",
    rateLimit: 2000,
    async execute(message) {
      await reply(message, Math.random() < 0.5 ? "Heads" : "Tails");
    }
  },
  {
    name: "8ball",
    description: "Magic 8-ball",
    rateLimit: 3000,
    async execute(message) {
      const answers = ["Yes.", "No.", "Maybe.", "Ask again later.", "Definitely.", "Unlikely."];
      await reply(message, `🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
    }
  },
  {
    name: "fun",
    description: "Run fun variants (220 total)",
    rateLimit: 5000,
    async execute(message, args) {
      const { intensity, args: normalizedArgs } = parseFunIntensity(args);
      const sub = (normalizedArgs[0] || "random").toLowerCase();

      if (sub === "list" || sub === "catalog") {
        const query = normalizedArgs.slice(1).join(" ");
        const payload = await getFunCatalog({ query, limit: 20 });
        const stats = payload?.stats || { total: payload?.total || 0, themes: "?", styles: "?" };
        const hits = Array.isArray(payload?.matches) ? payload.matches : [];
        const head = `Fun variants: ${stats.total} (${stats.themes} themes x ${stats.styles} styles)`;
        const source = payload?.source ? ` [${payload.source}]` : "";
        if (!hits.length) return reply(message, `${head}\nNo variants found for query: ${query || "(empty)"}`);
        const lines = hits.map(v => `${v.id} -> ${v.label}`);
        return reply(message, `${head}${source}\n${lines.join("\n")}`.slice(0, 1900));
      }

      let target = "";
      let result = null;
      if (sub === "random" || sub === "r") {
        target = normalizedArgs.slice(1).join(" ");
        result = await randomFunFromRuntime({
          actorTag: message.author.username,
          target: target || message.author.username,
          intensity
        });
      } else {
        const variantId = resolveVariantId(sub);
        if (!variantId) {
          return reply(message, "Unknown fun variant. Use `fun list` to browse ids.");
        }
        target = normalizedArgs.slice(1).join(" ");
        result = await renderFunFromRuntime({
          variantId,
          actorTag: message.author.username,
          target: target || message.author.username,
          intensity
        });
      }

      if (!result.ok) return reply(message, "Unable to render variant.");
      const source = result.source ? ` [${result.source}]` : "";
      return reply(message, `${result.text}\n${result.metaLine}${source}`);
    }
  }
];

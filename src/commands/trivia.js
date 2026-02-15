import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from "discord.js";

import { Colors, replyError } from "../utils/discordOutput.js";
import { pickTriviaQuestion, listTriviaCategories } from "../game/trivia/bank.js";
import { makeTriviaSessionId, shuffleChoices, pickAgentAnswer, agentDelayRangeMs, computeReward, formatDifficulty } from "../game/trivia/engine.js";
import { pickDmIntro, pickAgentThinkingLine } from "../game/trivia/narration.js";
import {
  getActiveTriviaSessionId,
  setActiveTriviaSessionId,
  clearActiveTriviaSessionId,
  loadTriviaSession,
  saveTriviaSession,
  deleteTriviaSession
} from "../game/trivia/session.js";
import { addCredits } from "../economy/wallet.js";
import { addGameXp } from "../game/profile.js";

const SESSION_TTL_SECONDS = 15 * 60;
const QUESTION_TIME_LIMIT_MS = 30_000;

function formatAgentTextError(reasonOrErr) {
  const msg = String(reasonOrErr?.message ?? reasonOrErr);
  if (msg === "no-agents-in-guild") {
    return "❌ No agents deployed in this guild.\n💡 Fix: `/agents deploy 5`";
  }
  if (msg === "no-free-agents") {
    return "⏳ All agents are currently busy.\n💡 Try again in a few seconds or deploy more agents with `/agents deploy <count>`.";
  }
  if (msg === "agents-not-ready") return "⏳ Agents are starting up. Try again in 10-15 seconds.";
  if (msg === "agent-offline") return "❌ Agent disconnected. Try again.";
  if (msg === "agent-timeout") return "⏱️ Agent timed out. Try again.";
  return "❌ Trivia failed.";
}

function buildQuestionEmbed({ session, agentTag }) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const lines = session.choices.map((c, idx) => `**${letters[idx]}.** ${c}`);
  const yourPick = Number.isFinite(Number(session.userPick)) ? letters[Number(session.userPick)] : null;
  const agentPick = Number.isFinite(Number(session.agentPick)) ? letters[Number(session.agentPick)] : null;
  const locked = Boolean(session.userLockedAt);

  const e = new EmbedBuilder()
    .setTitle("🧩 Trivia Duel")
    .setColor(Colors.INFO)
    .setDescription(pickDmIntro())
    .addFields(
      { name: "Category", value: String(session.category || "Any"), inline: true },
      { name: "Opponent", value: `${agentTag}`, inline: true },
      { name: "Difficulty", value: formatDifficulty(session.difficulty), inline: true },
      { name: "Question", value: String(session.prompt || "…"), inline: false },
      { name: "Choices", value: lines.join("\n").slice(0, 1024), inline: false }
    )
    .setFooter({ text: locked ? "Locked in. Waiting for the opponent…" : "Pick an answer, then Lock In." })
    .setTimestamp();

  if (yourPick || agentPick) {
    e.addFields({
      name: "Picks",
      value: [
        yourPick ? `You: **${yourPick}**` : "You: _not locked_",
        agentPick ? `${agentTag}: **${agentPick}**` : `${agentTag}: _thinking_`
      ].join("\n"),
      inline: false
    });
  }

  return e;
}

function buildComponents(sessionId, { disabled = false } = {}) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`trivia:sel:${sessionId}`)
    .setPlaceholder("Choose your answer…")
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(Boolean(disabled))
    .addOptions(
      { label: "A", value: "0" },
      { label: "B", value: "1" },
      { label: "C", value: "2" },
      { label: "D", value: "3" }
    );

  const row1 = new ActionRowBuilder().addComponents(menu);

  const lockBtn = new ButtonBuilder()
    .setCustomId(`trivia:btn:${sessionId}:lock`)
    .setLabel("Lock In")
    .setStyle(ButtonStyle.Success)
    .setDisabled(Boolean(disabled));

  const forfeitBtn = new ButtonBuilder()
    .setCustomId(`trivia:btn:${sessionId}:forfeit`)
    .setLabel("Forfeit")
    .setStyle(ButtonStyle.Danger);

  const row2 = new ActionRowBuilder().addComponents(lockBtn, forfeitBtn);
  return [row1, row2];
}

async function sendViaAgent({ agent, guildId, channelId, actorUserId, content, embeds }) {
  const mgr = global.agentManager;
  if (!mgr) throw new Error("agents-not-ready");
  return await mgr.request(agent, "discordSend", {
    guildId,
    textChannelId: channelId,
    actorUserId,
    content,
    embeds
  });
}

async function finalizeSession(client, sessionId, { reason = "completed" } = {}) {
  const session = await loadTriviaSession(sessionId);
  if (!session || session.endedAt) return false;

  const letters = ["A", "B", "C", "D", "E", "F"];
  const correct = session.correctIndex;
  const userPick = Number.isFinite(Number(session.userPick)) ? Number(session.userPick) : null;
  const agentPick = Number.isFinite(Number(session.agentPick)) ? Number(session.agentPick) : null;

  const userCorrect = userPick !== null && userPick === correct;
  const agentCorrect = agentPick !== null && agentPick === correct;

  let result = "tie";
  if (userCorrect && !agentCorrect) result = "win";
  else if (!userCorrect && agentCorrect) result = "lose";
  else if (userCorrect && agentCorrect) {
    const uAt = Number(session.userLockedAt || 0);
    const aAt = Number(session.agentLockedAt || 0);
    if (uAt && aAt) result = uAt < aAt ? "win" : uAt > aAt ? "lose" : "tie";
    else result = "tie";
  }

  const answeredBeforeAgent = Boolean(session.userLockedAt && session.agentLockedAt && session.userLockedAt < session.agentLockedAt);
  const reward = computeReward({ difficulty: session.difficulty, result, answeredBeforeAgent });

  // Apply rewards (best-effort, but do not fail final output).
  try {
    if (reward.credits > 0) await addCredits(session.userId, reward.credits, `Trivia (${session.difficulty}): ${result}`);
  } catch {}
  let xpRes = null;
  try {
    xpRes = await addGameXp(session.userId, reward.xp, { reason: `trivia:${result}` });
  } catch {}

  session.endedAt = Date.now();
  session.endReason = reason;
  await deleteTriviaSession(sessionId);
  await clearActiveTriviaSessionId({ guildId: session.guildId, channelId: session.channelId, userId: session.userId });

  // Release agent lease (best-effort).
  try {
    const mgr = global.agentManager;
    if (mgr) mgr.releaseTextSession(session.guildId, session.channelId, { ownerUserId: session.userId, kind: "trivia" });
  } catch {}

  const category = String(session.category || "Any");
  const agentTag = session.agentTag || `Agent ${session.agentId || ""}`.trim();

  const e = new EmbedBuilder()
    .setTitle("🧩 Trivia Results")
    .setColor(result === "win" ? Colors.SUCCESS : result === "lose" ? Colors.ERROR : Colors.INFO)
    .setDescription(
      result === "win" ? "You won the duel." : result === "lose" ? "You lost the duel." : "It's a tie."
    )
    .addFields(
      { name: "Category", value: category, inline: true },
      { name: "Difficulty", value: formatDifficulty(session.difficulty), inline: true },
      { name: "Correct", value: `**${letters[correct]}**`, inline: true },
      { name: "Your Pick", value: userPick === null ? "_none_" : `**${letters[userPick]}**`, inline: true },
      { name: `${agentTag} Pick`, value: agentPick === null ? "_none_" : `**${letters[agentPick]}**`, inline: true },
      { name: "Rewards", value: `+${reward.credits.toLocaleString()} Credits • +${reward.xp.toLocaleString()} XP`, inline: false }
    )
    .setTimestamp();

  if (session.explanation) {
    e.addFields({ name: "Why", value: String(session.explanation).slice(0, 400), inline: false });
  }
  if (xpRes?.granted?.length) {
    const crates = xpRes.granted.slice(0, 3).map(g => `Lv ${g.level}: \`${g.crateId}\``).join("\n");
    const more = xpRes.granted.length > 3 ? `\n...and ${xpRes.granted.length - 3} more.` : "";
    e.addFields({ name: "Level Rewards", value: crates + more, inline: false });
  }

  try {
    const channel = await client.channels.fetch(session.channelId).catch(() => null);
    if (channel?.isTextBased?.()) {
      const msg = await channel.messages.fetch(session.messageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [e], components: [] }).catch(() => {});
      } else {
        await channel.send({ embeds: [e] }).catch(() => {});
      }
    }
  } catch {}

  return true;
}

async function maybeRunAgentAnswer(client, sessionId) {
  const session = await loadTriviaSession(sessionId);
  if (!session || session.endedAt) return;
  if (session.agentPick !== null && session.agentPick !== undefined) return;

  const now = Date.now();
  const dueAt = Number(session.agentDueAt || 0);
  if (dueAt && now < dueAt) return;

  const agentPick = pickAgentAnswer({
    correctIndex: session.correctIndex,
    choicesLen: session.choices?.length || 4,
    difficulty: session.difficulty
  });
  session.agentPick = agentPick;
  session.agentLockedAt = now;
  await saveTriviaSession(sessionId, session, SESSION_TTL_SECONDS);

  // Announce from the agent identity.
  try {
    if (!session.publicMode) throw new Error("private-mode");
    const mgr = global.agentManager;
    const agent = mgr?.liveAgents?.get?.(session.agentId) || null;
    if (mgr && agent?.ready) {
      const letters = ["A", "B", "C", "D"];
      const agentTag = session.agentTag || `Agent ${session.agentId || ""}`.trim();
      await sendViaAgent({
        agent,
        guildId: session.guildId,
        channelId: session.channelId,
        actorUserId: session.userId,
        content: `${agentTag} locks in: **${letters[agentPick] || "?"}**`
      });
    }
  } catch {}

  // If user already locked, finalize immediately.
  if (session.userLockedAt) {
    await finalizeSession(client, sessionId, { reason: "completed" });
  }
}

export const data = new SlashCommandBuilder()
  .setName("trivia")
  .setDescription("Play a trivia duel against a deployed agent")
  .addSubcommand(sub =>
    sub
      .setName("start")
      .setDescription("Start a trivia duel")
      .addStringOption(o =>
        o
          .setName("difficulty")
          .setDescription("Opponent difficulty (affects speed + accuracy)")
          .setRequired(false)
          .addChoices(
            { name: "Easy", value: "easy" },
            { name: "Normal", value: "normal" },
            { name: "Hard", value: "hard" },
            { name: "Nightmare", value: "nightmare" }
          )
      )
      .addStringOption(o =>
        o
          .setName("category")
          .setDescription("Question category")
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addBooleanOption(o =>
        o
          .setName("public")
          .setDescription("Post the duel publicly in this channel (default true)")
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("stop")
      .setDescription("Forfeit your current trivia duel in this channel")
  );

export default {
  data,
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused?.name !== "category") return await interaction.respond([]);
    const q = String(focused.value || "").toLowerCase();
    const opts = listTriviaCategories()
      .filter(c => c.toLowerCase().includes(q))
      .slice(0, 25)
      .map(c => ({ name: c, value: c }));
    await interaction.respond(opts);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    if (!guildId) {
      return await replyError(interaction, "Guild Only", "Trivia duels can only be played in a server.", true);
    }

    if (sub === "stop") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const active = await getActiveTriviaSessionId({ guildId, channelId, userId: interaction.user.id });
      if (!active) {
        return await replyError(interaction, "No Active Duel", "You have no active trivia duel in this channel.", true);
      }
      await finalizeSession(interaction.client, String(active), { reason: "forfeit" });
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.SUCCESS).setTitle("Forfeited").setDescription("Your trivia duel has been ended.")] });
    }

    await interaction.deferReply();

    // Enforce single active duel per user per channel.
    const existing = await getActiveTriviaSessionId({ guildId, channelId, userId: interaction.user.id });
    if (existing) {
      const still = await loadTriviaSession(String(existing));
      if (still) {
        return await replyError(
          interaction,
          "Duel Already Running",
          "You already have an active trivia duel in this channel.\nUse `/trivia stop` to forfeit it.",
          true
        );
      }
    }

    const mgr = global.agentManager;
    if (!mgr) {
      return await replyError(interaction, "Agents Not Ready", formatAgentTextError("agents-not-ready"), true);
    }

    const difficulty = interaction.options.getString("difficulty") || "normal";
    const category = interaction.options.getString("category") || "Any";
    const isPublic = interaction.options.getBoolean("public");
    const publicMode = isPublic === null ? true : Boolean(isPublic);
    if (!publicMode) {
      return await replyError(
        interaction,
        "Not Supported Yet",
        "Private trivia duels are not supported yet.\nUse `/trivia start public:true` for now.",
        true
      );
    }

    const lease = await mgr.ensureTextSessionAgent(guildId, channelId, {
      ownerUserId: interaction.user.id,
      kind: "trivia"
    });
    if (!lease.ok) {
      return await replyError(interaction, "Trivia Error", formatAgentTextError(lease.reason), true);
    }

    const q = pickTriviaQuestion({ difficulty, category });
    if (!q) {
      mgr.releaseTextSession(guildId, channelId, { ownerUserId: interaction.user.id, kind: "trivia" });
      return await replyError(interaction, "No Questions", "No trivia questions are available for that filter.", true);
    }

    const { shuffled, correctIndex } = shuffleChoices(q.choices, q.answerIndex);
    const sessionId = makeTriviaSessionId();

    const [minDelay, maxDelay] = agentDelayRangeMs(difficulty);
    const agentDueAt = Date.now() + Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
    const expiresAt = Date.now() + QUESTION_TIME_LIMIT_MS;

    const agentTag = lease.agent.tag ? lease.agent.tag : `Agent ${lease.agent.agentId}`;

    const session = {
      sessionId,
      guildId,
      channelId,
      userId: interaction.user.id,
      difficulty,
      category: q.category,
      prompt: q.prompt,
      explanation: q.explanation || null,
      choices: shuffled.slice(0, 4),
      correctIndex,
      createdAt: Date.now(),
      expiresAt,
      agentDueAt,
      agentId: lease.agent.agentId,
      agentTag,
      agentPick: null,
      agentLockedAt: null,
      userPick: null,
      userLockedAt: null,
      messageId: null,
      agentLeaseKey: lease.key,
      publicMode: true
    };

    await saveTriviaSession(sessionId, session, SESSION_TTL_SECONDS);
    await setActiveTriviaSessionId({ guildId, channelId, userId: interaction.user.id, sessionId, ttlSeconds: SESSION_TTL_SECONDS });

    const embed = buildQuestionEmbed({ session, agentTag });
    const components = buildComponents(sessionId, { disabled: false });

    const payload = {
      embeds: [embed],
      components,
      flags: publicMode ? undefined : MessageFlags.Ephemeral,
      fetchReply: true
    };

    const msg = await interaction.editReply(payload);
    session.messageId = msg?.id || null;
    await saveTriviaSession(sessionId, session, SESSION_TTL_SECONDS);

    // Best-effort: show "thinking" from agent, then answer at due time.
    try {
      await sendViaAgent({
        agent: lease.agent,
        guildId,
        channelId,
        actorUserId: interaction.user.id,
        content: pickAgentThinkingLine(agentTag)
      });
    } catch {}

    setTimeout(() => {
      maybeRunAgentAnswer(interaction.client, sessionId).catch(() => {});
    }, Math.max(250, agentDueAt - Date.now()));

    setTimeout(() => {
      (async () => {
        const s = await loadTriviaSession(sessionId);
        if (!s || s.endedAt) return;
        // Time's up: if user didn't lock, forfeit with minimal rewards.
        if (!s.userLockedAt) {
          s.userLockedAt = Date.now();
          s.userPick = null;
          await saveTriviaSession(sessionId, s, SESSION_TTL_SECONDS);
        }
        await maybeRunAgentAnswer(interaction.client, sessionId);
        await finalizeSession(interaction.client, sessionId, { reason: "timeout" });
      })().catch(() => {});
    }, Math.max(1_000, expiresAt - Date.now() + 250));
  }
};

export async function handleSelect(interaction) {
  const id = String(interaction.customId || "");
  if (!id.startsWith("trivia:sel:")) return false;
  const sessionId = id.split(":").slice(2).join(":");
  const session = await loadTriviaSession(sessionId);
  if (!session) {
    await interaction.reply({ content: "This duel expired. Run `/trivia start` again.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: "This duel belongs to another user.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (session.userLockedAt) {
    await interaction.reply({ content: "Already locked in.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const v = interaction.values?.[0];
  const pick = Math.max(0, Math.min(3, Math.trunc(Number(v))));
  session.userPick = pick;
  await saveTriviaSession(sessionId, session, SESSION_TTL_SECONDS);

  const embed = buildQuestionEmbed({ session, agentTag: session.agentTag || "Agent" });
  await interaction.update({ embeds: [embed], components: buildComponents(sessionId, { disabled: false }) });
  return true;
}

export async function handleButton(interaction) {
  const id = String(interaction.customId || "");
  if (!id.startsWith("trivia:btn:")) return false;
  const parts = id.split(":");
  const sessionId = parts[2];
  const action = parts[3];

  const session = await loadTriviaSession(sessionId);
  if (!session) {
    await interaction.reply({ content: "This duel expired. Run `/trivia start` again.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: "This duel belongs to another user.", flags: MessageFlags.Ephemeral });
    return true;
  }

  if (action === "forfeit") {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.INFO).setTitle("Forfeited").setDescription("Ending duel…")], components: [] });
    await finalizeSession(interaction.client, sessionId, { reason: "forfeit" });
    return true;
  }

  if (action === "lock") {
    if (session.userLockedAt) {
      await interaction.reply({ content: "Already locked in.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (session.userPick === null || session.userPick === undefined) {
      await interaction.reply({ content: "Pick A/B/C/D first.", flags: MessageFlags.Ephemeral });
      return true;
    }
    session.userLockedAt = Date.now();
    await saveTriviaSession(sessionId, session, SESSION_TTL_SECONDS);

    const embed = buildQuestionEmbed({ session, agentTag: session.agentTag || "Agent" });
    await interaction.update({ embeds: [embed], components: buildComponents(sessionId, { disabled: true }) });

    // If agent already answered, finalize now. Otherwise finalize when agent answers.
    await maybeRunAgentAnswer(interaction.client, sessionId);
    const updated = await loadTriviaSession(sessionId);
    if (updated?.agentPick !== null && updated?.agentPick !== undefined) {
      await finalizeSession(interaction.client, sessionId, { reason: "completed" });
    }
    return true;
  }

  await interaction.reply({ content: "Unknown trivia action.", flags: MessageFlags.Ephemeral });
  return true;
}

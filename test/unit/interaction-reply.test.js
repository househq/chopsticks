import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { replyInteraction, replyInteractionIfFresh } from "../../src/utils/interactionReply.js";

describe("interactionReply helper", function () {
  it("edits deferred replies instead of following up", async function () {
    let edited = false;
    let followed = false;
    const interaction = {
      deferred: true,
      replied: false,
      editReply: async () => {
        edited = true;
      },
      followUp: async () => {
        followed = true;
      }
    };

    await replyInteraction(interaction, { content: "ok" }, { ephemeral: true });
    assert.equal(edited, true);
    assert.equal(followed, false);
  });

  it("follows up when already replied", async function () {
    let followed = false;
    const interaction = {
      deferred: false,
      replied: true,
      followUp: async () => {
        followed = true;
      }
    };
    await replyInteraction(interaction, { content: "ok" }, { ephemeral: true });
    assert.equal(followed, true);
  });

  it("replyInteractionIfFresh skips deferred/replied interactions", async function () {
    const deferred = await replyInteractionIfFresh({ deferred: true, replied: false }, { content: "x" });
    const replied = await replyInteractionIfFresh({ deferred: false, replied: true }, { content: "x" });
    assert.equal(deferred, false);
    assert.equal(replied, false);
  });

  it("wraps plain content in an embed for consistent UI", async function () {
    let body = null;
    const interaction = {
      deferred: false,
      replied: false,
      reply: async (b) => { body = b; }
    };
    await replyInteraction(interaction, { content: "Agent control not started." }, { ephemeral: true });
    assert.ok(Array.isArray(body.embeds));
    assert.equal(body.embeds.length, 1);
    assert.equal(body.content, undefined);
  });

  it("keeps code block payloads as plain content", async function () {
    let body = null;
    const interaction = {
      deferred: false,
      replied: false,
      reply: async (b) => { body = b; }
    };
    await replyInteraction(interaction, { content: "```json\n{\"ok\":true}\n```" }, { ephemeral: true });
    assert.equal(typeof body.content, "string");
    assert.equal(Array.isArray(body.embeds), false);
  });
});

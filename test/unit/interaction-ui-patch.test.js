import { describe, it } from "mocha";
import { strict as assert } from "assert";
import { patchInteractionUiMethods } from "../../src/utils/interactionUiPatch.js";

describe("interaction UI patch", function () {
  it("wraps reply/followUp/editReply/update with UI payload preparation", async function () {
    const calls = [];
    const interaction = {
      reply: async (body) => { calls.push(["reply", body]); },
      followUp: async (body) => { calls.push(["followUp", body]); },
      editReply: async (body) => { calls.push(["editReply", body]); },
      update: async (body) => { calls.push(["update", body]); }
    };

    patchInteractionUiMethods(interaction);

    await interaction.reply({ content: "Agent control not started." });
    await interaction.followUp({ content: "Completed successfully." });
    await interaction.editReply({ content: "Warning: limit approaching." });
    await interaction.update({ content: "UI refreshed." });

    assert.equal(calls.length, 4);
    for (const [, body] of calls) {
      assert.ok(Array.isArray(body.embeds));
      assert.equal(body.embeds.length, 1);
      assert.equal(body.content, undefined);
    }
  });

  it("does not convert poll payloads", async function () {
    let body = null;
    const interaction = {
      reply: async (b) => { body = b; }
    };
    patchInteractionUiMethods(interaction);
    await interaction.reply({ content: "Choose one", poll: { question: { text: "Q" }, answers: [{ text: "A" }] } });
    assert.equal(typeof body.content, "string");
    assert.equal(Array.isArray(body.embeds), false);
    assert.ok(body.poll);
  });
});


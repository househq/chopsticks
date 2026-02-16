import { prepareUiPayload } from "./interactionReply.js";

const UI_PATCH_MARK = Symbol.for("chopsticks.uiPatch.v1");

function wrapInteractionMethod(interaction, methodName) {
  const fn = interaction?.[methodName];
  if (typeof fn !== "function") return;

  const original = fn.bind(interaction);
  interaction[methodName] = async function uiPatched(payload, ...rest) {
    if (payload === undefined || payload === null) {
      return await original(payload, ...rest);
    }

    try {
      const prepared = await prepareUiPayload(payload);
      return await original(prepared, ...rest);
    } catch {
      // Never break the interaction lifecycle because of UI decoration.
      return await original(payload, ...rest);
    }
  };
}

export function patchInteractionUiMethods(interaction) {
  if (!interaction || interaction[UI_PATCH_MARK]) return interaction;
  interaction[UI_PATCH_MARK] = true;

  wrapInteractionMethod(interaction, "reply");
  wrapInteractionMethod(interaction, "followUp");
  wrapInteractionMethod(interaction, "editReply");
  wrapInteractionMethod(interaction, "update");
  return interaction;
}


import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  MOD_LOG_ACTIONS,
  normalizeModLogConfig,
  isModLogActionEnabled
} from "../../src/utils/modLogs.js";

describe("modLogs utils", function () {
  it("normalizes defaults safely", function () {
    const cfg = normalizeModLogConfig(null);
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.channelId, null);
    assert.equal(cfg.includeFailures, true);
    for (const action of MOD_LOG_ACTIONS) {
      assert.equal(cfg.events[action], true);
    }
  });

  it("honors explicit event and failure filters", function () {
    const cfg = normalizeModLogConfig({
      enabled: true,
      channelId: "123",
      includeFailures: false,
      events: { kick: false, ban: true }
    });

    assert.equal(isModLogActionEnabled(cfg, "ban", { ok: true }), true);
    assert.equal(isModLogActionEnabled(cfg, "kick", { ok: true }), false);
    assert.equal(isModLogActionEnabled(cfg, "ban", { ok: false }), false);
  });
});

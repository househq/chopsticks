import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  normalizeTicketsConfig,
  buildTicketTopic,
  parseTicketTopic,
  formatTicketChannelName,
  parseUiId,
  uiId
} from "../../src/utils/tickets.js";

describe("ticket utils", function () {
  it("normalizes default config safely", function () {
    const out = normalizeTicketsConfig({});
    const cfg = out.tickets;
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.categoryId, null);
    assert.equal(cfg.panelChannelId, null);
    assert.equal(cfg.transcriptOnClose, true);
    assert.equal(cfg.counter, 0);
  });

  it("round-trips ticket topic metadata", function () {
    const topic = buildTicketTopic({ ownerId: "123456789012345678", status: "open", createdAt: 12345, type: "billing" });
    const parsed = parseTicketTopic(topic);
    assert.ok(parsed);
    assert.equal(parsed.ownerId, "123456789012345678");
    assert.equal(parsed.status, "open");
    assert.equal(parsed.createdAt, 12345);
    assert.equal(parsed.type, "billing");
  });

  it("formats ticket channel names deterministically", function () {
    assert.equal(formatTicketChannelName(7, "support"), "ticket-support-0007");
  });

  it("parses UI ids", function () {
    const id = uiId("open");
    const parsed = parseUiId(id);
    assert.ok(parsed);
    assert.equal(parsed.action, "open");
  });
});

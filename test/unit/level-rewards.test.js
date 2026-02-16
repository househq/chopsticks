import { describe, it } from "mocha";
import { strict as assert } from "assert";
import {
  listLevelRoleRewards,
  setLevelRoleReward,
  removeLevelRoleReward
} from "../../src/game/levelRewards.js";

describe("level rewards helpers", function () {
  it("sets and lists rewards in ascending order", function () {
    const data = { levels: { roleRewards: {} } };
    setLevelRoleReward(data, 10, "123456789012345678");
    setLevelRoleReward(data, 5, "223456789012345678");
    const rows = listLevelRoleRewards(data);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].level, 5);
    assert.equal(rows[1].level, 10);
  });

  it("removes configured reward", function () {
    const data = { levels: { roleRewards: { "7": "323456789012345678" } } };
    const removed = removeLevelRoleReward(data, 7);
    assert.equal(removed, true);
    assert.equal(listLevelRoleRewards(data).length, 0);
  });
});

/**
 * E2E Contract Test: Agent Online Walkthrough (C2f)
 *
 * Mocks the full lifecycle:
 *   add_token → (contribute → approve) → agentRunner start → sendHello → liveAgents
 *
 * Verifies no silent failure at any step and all state transitions are correct.
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { strict as assert } from 'assert';
import { EventEmitter } from 'events';

// ── Minimal mocks ─────────────────────────────────────────────────────────────

class MockAgentDB {
  constructor() {
    this.agents = new Map();
    this.pools = new Map([
      ['pool_owner', { pool_id: 'pool_owner', owner_user_id: 'owner1', name: 'Test Pool', visibility: 'private', max_agents: 10 }],
      ['pool_public', { pool_id: 'pool_public', owner_user_id: 'owner2', name: 'Public Pool', visibility: 'public', max_agents: 10 }],
    ]);
  }

  insertAgent(agentId, clientId, tag, poolId, contributedBy, status = 'active') {
    this.agents.set(agentId, { agent_id: agentId, client_id: clientId, tag, pool_id: poolId, status, contributed_by: contributedBy, created_at: Date.now() });
    return { operation: 'inserted' };
  }

  getAgent(agentId) { return this.agents.get(agentId) ?? null; }

  updateStatus(agentId, status) {
    const a = this.agents.get(agentId);
    if (!a) throw new Error(`Agent ${agentId} not found`);
    a.status = status;
    return true;
  }

  getActiveAgents() {
    return Array.from(this.agents.values()).filter(a => a.status === 'active');
  }

  getPool(poolId) { return this.pools.get(poolId) ?? null; }
}

class MockAgentManager extends EventEmitter {
  constructor() {
    super();
    this.liveAgents = new Map();
    this.discordClient = null;
  }

  /** Simulate sendHello from a connected agent. */
  registerAgent(agentId, { tag, botUserId, poolId, guildIds = [] }) {
    const agent = {
      agentId,
      tag,
      botUserId,
      poolId,
      ready: true,
      guildIds: new Set(guildIds),
      startedAt: Date.now(),
    };
    this.liveAgents.set(agentId, agent);
    this.emit('agent:online', agent);
    return agent;
  }

  /** Simulate agent joining a guild (OAuth invite clicked). */
  agentJoinGuild(agentId, guildId) {
    const a = this.liveAgents.get(agentId);
    if (!a) throw new Error(`Agent ${agentId} not in liveAgents`);
    a.guildIds.add(guildId);
    this.emit('agent:guild_joined', { agentId, guildId });
  }

  /** Simulate agent disconnect. */
  disconnectAgent(agentId) {
    this.liveAgents.delete(agentId);
    this.emit('agent:offline', agentId);
  }

  isOnline(agentId) { return this.liveAgents.has(agentId); }
  isInGuild(agentId, guildId) { return this.liveAgents.get(agentId)?.guildIds?.has(guildId) ?? false; }
  listAgents() { return Array.from(this.liveAgents.values()); }
}

/** Minimal agentRunner poll simulation. */
function simulateRunnerPoll(db, mgr, activeAgentSet) {
  const dbActive = db.getActiveAgents();
  const started = [];
  for (const agent of dbActive) {
    if (!activeAgentSet.has(agent.agent_id)) {
      // Runner would start the agent's Discord.js client here
      // We simulate by directly calling registerAgent (= sendHello arrived)
      mgr.registerAgent(agent.agent_id, {
        tag: agent.tag,
        botUserId: agent.client_id,
        poolId: agent.pool_id,
        guildIds: [],
      });
      activeAgentSet.add(agent.agent_id);
      started.push(agent.agent_id);
    }
  }
  return started;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('E2E: Agent Online Walkthrough', function () {
  this.timeout(5000);

  let db, mgr, activeAgentSet;

  beforeEach(function () {
    db = new MockAgentDB();
    mgr = new MockAgentManager();
    activeAgentSet = new Set();
  });

  // ── Scenario 1: Owner adds token → agent starts → joins guild ───────────────
  describe('Scenario 1: Owner adds to own pool', function () {
    it('agent becomes active immediately after add_token', function () {
      const result = db.insertAgent('agent_c1', 'client_c1', 'Bot#1001', 'pool_owner', 'owner1', 'active');
      assert.equal(result.operation, 'inserted');
      assert.equal(db.getAgent('agent_c1').status, 'active');
    });

    it('runner poll starts the agent (registers in liveAgents)', function () {
      db.insertAgent('agent_c1', 'client_c1', 'Bot#1001', 'pool_owner', 'owner1', 'active');
      const started = simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.ok(started.includes('agent_c1'));
      assert.ok(mgr.isOnline('agent_c1'), 'Agent should be in liveAgents after runner poll');
    });

    it('agent is NOT in guild before OAuth invite', function () {
      db.insertAgent('agent_c1', 'client_c1', 'Bot#1001', 'pool_owner', 'owner1', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.ok(!mgr.isInGuild('agent_c1', 'guild123'), 'Agent must not be in guild before invite click');
    });

    it('agent joins guild after OAuth invite click', function () {
      db.insertAgent('agent_c1', 'client_c1', 'Bot#1001', 'pool_owner', 'owner1', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      mgr.agentJoinGuild('agent_c1', 'guild123');
      assert.ok(mgr.isInGuild('agent_c1', 'guild123'), 'Agent should be in guild after invite');
    });

    it('runner does NOT re-start already-running agents on second poll', function () {
      db.insertAgent('agent_c1', 'client_c1', 'Bot#1001', 'pool_owner', 'owner1', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      const secondStart = simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.equal(secondStart.length, 0, 'Second poll should start nothing new');
    });
  });

  // ── Scenario 2: Contribution to public pool → pending → approve → online ───
  describe('Scenario 2: Contribution to public pool', function () {
    it('contributed agent starts as pending', function () {
      db.insertAgent('agent_c2', 'client_c2', 'Bot#2001', 'pool_public', 'contrib1', 'pending');
      assert.equal(db.getAgent('agent_c2').status, 'pending');
    });

    it('runner poll does NOT start pending agents', function () {
      db.insertAgent('agent_c2', 'client_c2', 'Bot#2001', 'pool_public', 'contrib1', 'pending');
      const started = simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.equal(started.length, 0, 'Pending agents must not be started');
      assert.ok(!mgr.isOnline('agent_c2'));
    });

    it('after approval agent becomes active and runner starts it', function () {
      db.insertAgent('agent_c2', 'client_c2', 'Bot#2001', 'pool_public', 'contrib1', 'pending');
      simulateRunnerPoll(db, mgr, activeAgentSet); // no-op

      // Pool owner approves
      db.updateStatus('agent_c2', 'active');
      assert.equal(db.getAgent('agent_c2').status, 'active');

      // Runner next poll starts it
      const started = simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.ok(started.includes('agent_c2'));
      assert.ok(mgr.isOnline('agent_c2'));
    });

    it('full flow: pending → approve → online → in-guild', function () {
      db.insertAgent('agent_c2', 'client_c2', 'Bot#2001', 'pool_public', 'contrib1', 'pending');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      db.updateStatus('agent_c2', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      mgr.agentJoinGuild('agent_c2', 'guild_abc');

      assert.equal(db.getAgent('agent_c2').status, 'active', 'DB status: active');
      assert.ok(mgr.isOnline('agent_c2'), 'liveAgents: online');
      assert.ok(mgr.isInGuild('agent_c2', 'guild_abc'), 'guildIds: in guild');
    });
  });

  // ── Scenario 3: Corrupt token → marked failed, not retried endlessly ────────
  describe('Scenario 3: Token corruption handling', function () {
    it('agent marked corrupt is not started by runner', function () {
      db.insertAgent('agent_c3', 'client_c3', 'Bot#3001', 'pool_owner', 'owner1', 'active');
      // Simulate token decrypt failure → mark corrupt
      db.updateStatus('agent_c3', 'corrupt');
      const started = simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.equal(started.length, 0, 'Corrupt agent must not be started');
    });
  });

  // ── Scenario 4: Agent disconnect + auto-retry ────────────────────────────────
  describe('Scenario 4: Disconnect and retry', function () {
    it('disconnected agent is removed from liveAgents', function () {
      db.insertAgent('agent_c4', 'client_c4', 'Bot#4001', 'pool_owner', 'owner1', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.ok(mgr.isOnline('agent_c4'));

      mgr.disconnectAgent('agent_c4');
      assert.ok(!mgr.isOnline('agent_c4'), 'Should be offline after disconnect');
    });

    it('after disconnect + activeAgentSet cleared, runner restarts agent on next poll', function () {
      db.insertAgent('agent_c4', 'client_c4', 'Bot#4001', 'pool_owner', 'owner1', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);
      mgr.disconnectAgent('agent_c4');
      activeAgentSet.delete('agent_c4'); // Runner removes from tracking set

      const restarted = simulateRunnerPoll(db, mgr, activeAgentSet);
      assert.ok(restarted.includes('agent_c4'), 'Agent should be restarted after disconnect');
      assert.ok(mgr.isOnline('agent_c4'));
    });
  });

  // ── Scenario 5: Multiple agents — only desired-pool agents started ───────────
  describe('Scenario 5: Multi-agent pool isolation', function () {
    it('agents from different pools are tracked independently', function () {
      db.insertAgent('agent_p1', 'client_p1', 'Bot#5001', 'pool_owner', 'owner1', 'active');
      db.insertAgent('agent_p2', 'client_p2', 'Bot#5002', 'pool_public', 'owner2', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);

      assert.ok(mgr.isOnline('agent_p1'));
      assert.ok(mgr.isOnline('agent_p2'));
      assert.equal(mgr.listAgents().length, 2);
    });

    it('suspending one agent does not affect others', function () {
      db.insertAgent('agent_p1', 'client_p1', 'Bot#5001', 'pool_owner', 'owner1', 'active');
      db.insertAgent('agent_p2', 'client_p2', 'Bot#5002', 'pool_public', 'owner2', 'active');
      simulateRunnerPoll(db, mgr, activeAgentSet);

      db.updateStatus('agent_p1', 'suspended');
      // Runner would stop suspended agents — simulate
      mgr.disconnectAgent('agent_p1');
      activeAgentSet.delete('agent_p1');

      assert.ok(!mgr.isOnline('agent_p1'), 'Suspended agent offline');
      assert.ok(mgr.isOnline('agent_p2'), 'Other agent still online');
    });
  });
});

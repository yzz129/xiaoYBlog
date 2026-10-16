const assert = require("assert/strict");
const { EventEmitter } = require("events");

const { DistributedProviderCircuitBreaker } = require("../agents/core/provider-health");
const { withAgentSpan } = require("../agents/core/telemetry");
const { DurableTaskQueue } = require("../agents/pet-agent/task-queue");

class SharedCircuitStore {
    constructor() {
        this.states = new Map();
    }

    async load(names) {
        return Object.fromEntries(names.map((name) => [name, { ...(this.states.get(name) || { consecutiveFailures: 0, openedAt: 0, openUntil: 0, lastErrorCode: "" }) }]));
    }

    async clear(name) {
        this.states.delete(name);
    }

    async recordFailure(name, errorCode, options) {
        const state = this.states.get(name) || { consecutiveFailures: 0, openedAt: 0, openUntil: 0, lastErrorCode: "" };
        state.consecutiveFailures += 1;
        state.lastErrorCode = errorCode;
        if (state.consecutiveFailures >= options.failureThreshold) {
            state.openedAt = options.now;
            state.openUntil = options.now + options.openMs;
        }
        this.states.set(name, state);
        return { ...state };
    }
}

class FakeQueue {
    constructor() {
        this.jobs = [];
        FakeQueue.instance = this;
    }

    async waitUntilReady() {}
    async add(name, data, options) { this.jobs.push({ name, data, options }); }
    async close() {}
}

class FakeWorker extends EventEmitter {
    constructor(_name, handler) {
        super();
        this.handler = handler;
        FakeWorker.instance = this;
    }

    async waitUntilReady() {}
    async close() {}
}

async function main() {
    let now = 1_000;
    const sharedStore = new SharedCircuitStore();
    const breakerA = new DistributedProviderCircuitBreaker({ failureThreshold: 2, openMs: 5000, clock: () => now, store: sharedStore });
    const breakerB = new DistributedProviderCircuitBreaker({ failureThreshold: 2, openMs: 5000, clock: () => now, store: sharedStore });
    const providers = [{ name: "primary" }];

    await breakerA.recordFailure("primary", { code: "ETIMEDOUT" });
    assert.equal((await breakerB.select(providers)).length, 1);
    await breakerB.recordFailure("primary", { status: 503 });
    assert.equal((await breakerA.select(providers)).length, 0, "circuit state must be shared across workers");
    now += 5001;
    assert.equal((await breakerA.select(providers)).length, 1, "shared circuit must recover after cooldown");
    await breakerA.recordSuccess("primary");
    assert.equal(breakerA.snapshot().primary.status, "closed");

    const handled = [];
    const queue = new DurableTaskQueue({ driver: "redis", QueueClass: FakeQueue, WorkerClass: FakeWorker, connectTimeoutMs: 500 });
    assert.equal(await queue.start(async (taskId) => handled.push(taskId)), true);
    assert.equal(await queue.enqueue("task-42"), true);
    assert.equal(FakeQueue.instance.jobs[0].options.attempts >= 1, true);
    await FakeWorker.instance.handler({ data: { taskId: "task-42" } });
    assert.deepEqual(handled, ["task-42"]);
    await queue.close();

    assert.equal(await withAgentSpan("agent.test", { "agent.test": true }, async () => "ok"), "ok");
    await assert.rejects(() => withAgentSpan("agent.test.failure", {}, async () => { throw new Error("expected"); }), /expected/);

    console.log("Agent platform tests passed: distributed circuit state, durable queue contract, and OpenTelemetry spans.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

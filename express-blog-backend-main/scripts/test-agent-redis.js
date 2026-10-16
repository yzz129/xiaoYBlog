const assert = require("assert/strict");
const crypto = require("crypto");

const { DistributedProviderCircuitBreaker, RedisCircuitStateStore } = require("../agents/core/provider-health");
const { OptionalRedisClient } = require("../agents/core/redis-client");
const { DurableTaskQueue } = require("../agents/pet-agent/task-queue");

function timeout(ms, message) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

async function main() {
    const suffix = crypto.randomUUID().replace(/-/g, "");
    const queue = new DurableTaskQueue({ driver: "redis", name: `agent-test-${suffix}`, prefix: `agent-test-${suffix}`, connectTimeoutMs: 3000 });
    const handled = [];
    let resolveHandled;
    const handledPromise = new Promise((resolve) => { resolveHandled = resolve; });
    const ready = await queue.start(async (taskId) => {
        handled.push(taskId);
        resolveHandled();
    });

    if (!ready) {
        if (process.env.REQUIRE_REDIS_TEST === "1") throw new Error(`Redis integration is required: ${queue.lastError}`);
        console.log("Agent Redis integration skipped: Redis is unavailable.");
        return;
    }

    const redis = new OptionalRedisClient({ connectTimeoutMs: 3000, retryAfterMs: 1000 });
    const circuitStore = new RedisCircuitStateStore({ redis, prefix: `agent-test:${suffix}:circuit:` });
    const breakerA = new DistributedProviderCircuitBreaker({ failureThreshold: 2, openMs: 2000, store: circuitStore });
    const breakerB = new DistributedProviderCircuitBreaker({ failureThreshold: 2, openMs: 2000, store: circuitStore });

    try {
        assert.equal(await queue.enqueue("redis-task"), true);
        await Promise.race([handledPromise, timeout(5000, "BullMQ task was not delivered")]);
        assert.deepEqual(handled, ["redis-task"]);

        await breakerA.recordFailure("integration", { code: "ETIMEDOUT" });
        await breakerB.recordFailure("integration", { status: 503 });
        assert.equal((await breakerA.select([{ name: "integration" }])).length, 0);
        await breakerA.recordSuccess("integration");
        assert.equal((await breakerB.select([{ name: "integration" }])).length, 1);

        console.log("Agent Redis integration passed: BullMQ delivery and cross-instance circuit state.");
    } finally {
        await circuitStore.clear("integration");
        await queue.queue?.obliterate?.({ force: true }).catch(() => undefined);
        await queue.close();
        await redis.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

const assert = require("assert/strict");

const store = require("../agents/pet-agent/task-store");
const dbUtils = require("../utils/db");

async function main() {
    let taskId = null;
    try {
        await store.ensureTables();
        const created = await store.createTask({
            userId: 0,
            title: "Agent reliability test",
            goal: "Verify database task lease behavior",
        });
        taskId = created.id;

        const firstClaim = await store.claimTask(taskId, "test-worker-a", 30);
        assert.equal(firstClaim?.status, "running");
        assert.equal(firstClaim?.lockedBy, "test-worker-a");

        const duplicateClaim = await store.claimTask(taskId, "test-worker-b", 30);
        assert.equal(duplicateClaim, null, "a live lease must reject a second worker");
        assert.equal(await store.heartbeatTask(taskId, "test-worker-a", 30), true);

        await store.releaseClaim(taskId, "test-worker-a", { status: "queued" });
        const secondClaim = await store.claimTask(taskId, "test-worker-b", 30);
        assert.equal(secondClaim?.lockedBy, "test-worker-b");
        await store.releaseClaim(taskId, "test-worker-b", { status: "completed", completedAt: new Date() });

        const completed = await store.getTask(taskId);
        assert.equal(completed.status, "completed");
        assert.equal(completed.lockedBy, "");
        assert.equal(completed.attemptCount, 2);
        console.log("Pet Agent reliability test passed: atomic claim, duplicate prevention, heartbeat, release, and reclaim.");
    } finally {
        if (taskId) {
            await dbUtils.query({ sql: "DELETE FROM agent_task WHERE id = ?", values: [taskId] }).catch(() => undefined);
        }
        await dbUtils.pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

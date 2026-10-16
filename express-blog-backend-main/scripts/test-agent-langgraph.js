const assert = require("assert/strict");
const { Command, MemorySaver } = require("@langchain/langgraph");
const { createAgentGraph, createApprovedActionExecutor, mergeReceipts } = require("../agents/pet-agent/langgraph-runner");
const { MySqlTaskSaver } = require("../agents/pet-agent/mysql-checkpointer");
const { isGraphTask, selectExecution } = require("../agents/pet-agent/execution-policy");

// No application config, real database, network, model, or scheduler is imported.
function harness(checkpointer = new MemorySaver(), options = {}) {
    const task = { id: options.id || "test-graph", userId: 7, goal: "写一篇博客并发布" };
    const effects = { drafted: 0, published: 0, events: [], saved: [] };
    const context = { execution: { engine: "langgraph", version: 1 }, observations: [], artifacts: {}, plan: [], budget: {} };
    const dependencies = {
        checkpointer, task,
        guard: options.guard || (async () => {}),
        save: async (patch) => effects.saved.push(patch),
        event: async (event) => effects.events.push(event),
        normalizePlan: (items = []) => items.map((item, index) => ({ id: item.id || `step_${index}`, status: item.status || "pending", ...item })),
        decide: options.decide || (async ({ context: current }) => {
            if (!current.artifacts.draft) return { kind: "tool", tool: "draft_blog", args: {}, reason: "撰写草稿" };
            if (!current.observations.some((item) => item.tool === "publish_blog")) return { kind: "tool", tool: "publish_blog", args: {}, reason: "准备发布" };
            return { kind: "complete", summary: "文章已发布" };
        }),
        execute: async (name) => {
            if (name === "draft_blog") {
                effects.drafted++;
                return { summary: "草稿完成", contextPatch: { artifacts: { draft: { title: "测试文章", content: "测试正文" } } } };
            }
            assert.equal(name, "publish_blog");
            return { requiresApproval: true, summary: "等待发布确认", action: { type: name, label: "发布测试文章", payload: { title: "测试文章", content: "测试正文" } } };
        },
        perform: async () => { effects.published++; return { summary: "发布完成", data: { articleId: 42 }, receipts: [] }; },
    };
    return { task, context, effects, dependencies, graph: createAgentGraph(dependencies), config: { configurable: { thread_id: task.id }, durability: "sync", recursionLimit: 80 } };
}

/** Minimal SQL storage double, shared by new saver instances to simulate worker reconstruction. */
function fakeDatabase() {
    const checkpoints = new Map();
    const writes = new Map();
    const state = { owned: true, rollbacks: 0, releases: 0 };
    const key = (values) => JSON.stringify(values);
    const execute = async (sql, values = []) => {
        if (/CREATE TABLE/.test(sql)) return { affectedRows: 0 };
        if (/SELECT id FROM agent_task/.test(sql)) return state.owned ? [{ id: "test-graph" }] : [];
        if (/INSERT INTO agent_graph_checkpoint/.test(sql)) {
            const [task_id, namespace, checkpoint_id, parent_id, checkpoint_type, checkpoint, metadata_type, metadata] = values;
            checkpoints.set(key(values.slice(0, 3)), { task_id, namespace, checkpoint_id, parent_id, checkpoint_type, checkpoint, metadata_type, metadata });
            return { affectedRows: 1 };
        }
        if (/INSERT.*INTO agent_graph_write/.test(sql)) {
            const [task_id, namespace, checkpoint_id, node_task_id, write_idx, channel, value_type, value] = values;
            const id = key(values.slice(0, 5));
            if (!/INSERT IGNORE/.test(sql) || !writes.has(id)) writes.set(id, { task_id, namespace, checkpoint_id, node_task_id, write_idx, channel, value_type, value });
            return { affectedRows: 1 };
        }
        if (/SELECT \* FROM agent_graph_write/.test(sql)) return [...writes.values()].filter((row) => row.task_id === values[0] && row.namespace === values[1] && row.checkpoint_id === values[2])
            .sort((a, b) => a.node_task_id.localeCompare(b.node_task_id) || a.write_idx - b.write_idx);
        if (/SELECT \* FROM agent_graph_checkpoint/.test(sql)) return [...checkpoints.values()].filter((row) => row.task_id === values[0] && row.namespace === values[1] && (values.length < 3 || row.checkpoint_id === values[2]))
            .sort((a, b) => b.checkpoint_id.localeCompare(a.checkpoint_id)).slice(0, 1);
        if (/SELECT checkpoint_id FROM agent_graph_checkpoint/.test(sql)) return [...checkpoints.values()].filter((row) => row.task_id === values[0] && row.namespace === values[1]
            && (!/checkpoint_id < \?/.test(sql) || row.checkpoint_id < values[2])).sort((a, b) => b.checkpoint_id.localeCompare(a.checkpoint_id)).slice(0, values.at(-1));
        throw new Error(`Unexpected SQL in isolated test: ${sql}`);
    };
    const db = {
        query: async ({ sql, values }) => ({ results: await execute(sql, values) }),
        pool: { getConnection: async () => ({ beginTransaction: async () => {}, commit: async () => {},
            rollback: async () => state.rollbacks++, release: () => state.releases++, query: async (sql, values) => [await execute(sql, values)] }) },
    };
    return { db, state };
}

async function approvalRoundTrip(useSql) {
    const storage = fakeDatabase();
    const makeSaver = () => new MySqlTaskSaver({ db: storage.db, taskId: "test-graph", workerId: "test-worker", generation: 1 });
    const checkpointer = useSql ? makeSaver() : new MemorySaver();
    if (useSql) await checkpointer.setup();
    const h = harness(checkpointer);
    const result = await h.graph.invoke({ data: { context: h.context } }, h.config);
    assert.ok(result.__interrupt__?.length, "publishing must interrupt before any side effect");
    assert.equal(h.effects.drafted, 1);
    assert.equal(h.effects.published, 0);
    const snapshot = await h.graph.getState(h.config);
    assert.equal(snapshot.values.data.phase, "approval");
    const approval = { kind: "approval", key: snapshot.values.data.pendingAction.idempotencyKey, approved: true };
    // New graph AND saver objects use the same stored SQL data, not old process-local graph state.
    const resumed = createAgentGraph({ ...h.dependencies, checkpointer: useSql ? makeSaver() : checkpointer });
    await resumed.invoke(new Command({ resume: approval }), h.config);
    const completed = await resumed.getState(h.config);
    assert.equal(completed.values.data.phase, "completed");
    assert.equal(h.effects.drafted, 1, "resume must not regenerate the draft");
    assert.equal(h.effects.published, 1);
    await resumed.invoke(null, h.config);
    assert.equal(h.effects.published, 1, "recovering the completed checkpoint must not republish");
    if (useSql) {
        storage.state.owned = false;
        await assert.rejects(() => makeSaver().put(h.config, { id: "stale", v: 4, ts: "", channel_values: {}, channel_versions: {}, versions_seen: {} }, {}), { code: "GRAPH_EXECUTION_STOPPED" });
        assert.equal(storage.state.rollbacks, 1);
        assert.ok(storage.state.releases > 0);
        await assert.rejects(() => makeSaver().getTuple({ configurable: { thread_id: "someone-else" } }), /scope/);
    }
}

async function main() {
    assert.equal(selectExecution("写一篇 Vue 博客", true).engine, "langgraph");
    assert.equal(selectExecution("写一篇 Vue 博客", false).engine, "legacy");
    assert.equal(selectExecution("关注这个作者", true).engine, "legacy");
    assert.equal(isGraphTask({ context: {} }), false, "existing tasks must remain on the legacy engine");
    const action = { type: "publish_blog", idempotencyKey: "receipt-test" };
    let stored = { context: {}, pendingAction: action };
    let writes = 0;
    const actionDependencies = { task: { id: "receipt-task", userId: 7 }, load: async () => stored,
        save: async (patch) => { stored = { ...stored, ...patch }; },
        performAction: async () => { writes++; return { summary: "published", data: { articleId: 42 } }; } };
    const perform = createApprovedActionExecutor(actionDependencies);
    await perform(action, {});
    assert.equal(stored.context.approvalReceipts[0].status, "completed");
    assert.equal((await perform(action, {})).data.articleId, 42);
    assert.equal(writes, 1, "completed receipt must prevent repeating the business write");
    assert.equal(mergeReceipts(stored.context.approvalReceipts, [{ key: action.idempotencyKey, status: "executing" }])[0].status, "completed",
        "stale graph context must not downgrade a completed receipt");
    stored = { context: {}, pendingAction: action };
    const interruptedAction = createApprovedActionExecutor({ ...actionDependencies, performAction: async () => { throw new Error("connection lost after sending write"); } });
    await assert.rejects(() => interruptedAction(action, {}), /connection lost/);
    assert.equal(stored.context.approvalReceipts[0].status, "executing");
    await assert.rejects(() => perform(action, {}), { code: "GRAPH_ACTION_UNCERTAIN" });
    assert.equal(writes, 1, "unknown write outcome must not be automatically repeated");
    await approvalRoundTrip(false);
    await approvalRoundTrip(true);

    const rejected = harness(undefined, { id: "rejected" });
    await rejected.graph.invoke({ data: { context: rejected.context } }, rejected.config);
    const snapshot = await rejected.graph.getState(rejected.config);
    await rejected.graph.invoke(new Command({ resume: { kind: "approval", key: snapshot.values.data.pendingAction.idempotencyKey, approved: false } }), rejected.config);
    assert.equal((await rejected.graph.getState(rejected.config)).values.data.phase, "cancelled");
    assert.equal(rejected.effects.published, 0);

    const invalid = harness(undefined, { id: "invalid" });
    await invalid.graph.invoke({ data: { context: invalid.context } }, invalid.config);
    await assert.rejects(() => invalid.graph.invoke(new Command({ resume: { kind: "approval", key: "wrong-action", approved: true } }), invalid.config), /不匹配/);
    assert.equal(invalid.effects.published, 0);

    const asking = harness(undefined, { id: "input", decide: async ({ context }) => context.observations.some((item) => item.tool === "user_instruction")
        ? { kind: "complete", summary: "已收到补充要求" } : { kind: "ask_user", question: "希望写给谁看？" } });
    await asking.graph.invoke({ data: { context: asking.context } }, asking.config);
    await asking.graph.invoke(new Command({ resume: { kind: "input", content: "前端初学者" } }), asking.config);
    assert.equal((await asking.graph.getState(asking.config)).values.data.phase, "completed");

    const stopped = harness(undefined, { id: "stopped", guard: async () => { const error = new Error("cancelled"); error.code = "GRAPH_EXECUTION_STOPPED"; throw error; } });
    await assert.rejects(() => stopped.graph.invoke({ data: { context: stopped.context } }, stopped.config), /cancelled/);
    assert.equal(stopped.effects.drafted, 0);
    assert.equal(stopped.effects.published, 0);
    console.log("LangGraph isolated tests passed: routing, checkpoints, approval/resume, rejection, input, completion replay and lease refusal.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

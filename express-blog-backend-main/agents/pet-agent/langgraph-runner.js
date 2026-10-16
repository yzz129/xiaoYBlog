const crypto = require("crypto");
const { Annotation, StateGraph, START, END, interrupt, Command } = require("@langchain/langgraph");
const { beginRuntime, budgetViolation, chargeModelUsage, normalizeBudget } = require("../core/budget");

function stop(code, message) { const error = new Error(message); error.code = code; throw error; }
function checkBudget(context, resources) {
    const violation = budgetViolation(context.budget, { resources });
    if (violation) stop("AGENT_BUDGET_EXCEEDED", violation.message);
}
function observed(context, observation) {
    return { ...context, observations: [...(context.observations || []), observation].slice(-30) };
}

function mergeReceipts(current = [], incoming = []) {
    const receipts = new Map(current.map((receipt) => [receipt.key, receipt]));
    for (const receipt of incoming) {
        if (receipts.get(receipt.key)?.status !== "completed") receipts.set(receipt.key, receipt);
    }
    return [...receipts.values()].slice(-20);
}

function createApprovedActionExecutor({ task, load, save, performAction }) {
    return async (action, context) => {
        const current = await load();
        const receipts = current.context?.approvalReceipts || [];
        const receipt = receipts.find((item) => item.key === action.idempotencyKey);
        if (receipt?.status === "completed") return { ...receipt.result, receipts };
        if (receipt || current.pendingAction?.executionStartedAt) stop("GRAPH_ACTION_UNCERTAIN", "上次操作已经开始，执行结果需要人工核对，禁止自动重放");
        const marked = { ...action, executionStartedAt: new Date().toISOString() };
        const executing = [...receipts, { key: action.idempotencyKey, type: action.type, status: "executing", startedAt: marked.executionStartedAt }].slice(-20);
        // Persist intent before the side effect; a checkpoint alone cannot ensure exactly-once writes.
        await save({ context: { ...context, approvalReceipts: executing }, pendingAction: marked });
        const result = await performAction(action, { userId: task.userId, task: { ...task, context } });
        const completed = executing.map((item) => item.key === action.idempotencyKey ? { ...item, status: "completed", result, completedAt: new Date().toISOString() } : item);
        await save({ context: { ...context, approvalReceipts: completed }, pendingAction: marked });
        return { ...result, receipts: completed };
    };
}

/** Dependency-injected graph: importing this file never opens DB/model connections. */
function createAgentGraph({ checkpointer, task, decide, execute, perform, guard, save, event, normalizePlan }) {
    const State = Annotation.Root({ data: Annotation() });
    const graph = new StateGraph(State);
    graph.addNode("plan", async ({ data }) => {
        await guard();
        let context = { ...data.context, budget: beginRuntime(normalizeBudget(data.context.budget)) };
        checkBudget(context, ["steps", "tokens", "runtime"]);
        context = { ...context, iteration: Number(context.iteration || 0) + 1,
            budget: { ...context.budget, usedSteps: context.budget.usedSteps + 1 } };
        const decision = await decide({ ...task, context });
        await guard();
        context = { ...context, budget: chargeModelUsage(context.budget, decision.telemetry?.modelCall) };
        if (decision.kind === "tool") checkBudget(context, ["tools", "tokens", "runtime"]);
        if (decision.plan?.length && !context.plan?.length) context.plan = normalizePlan(decision.plan);
        await save({ context, pendingAction: null });
        await event({ type: "decision", title: decision.kind === "tool" ? `已选择工具 ${decision.tool}` : decision.kind === "ask_user" ? "需要用户补充信息" : "已决定完成任务",
            content: decision.reason || "", status: "completed", data: { kind: decision.kind, tool: decision.tool || null, telemetry: decision.telemetry } });
        return { data: { context, decision, phase: decision.kind === "tool" ? "execute" : decision.kind === "ask_user" ? "input" : "done", pendingAction: null } };
    });
    graph.addNode("execute", async ({ data }) => {
        await guard();
        const { decision } = data;
        let context = { ...data.context, budget: normalizeBudget(data.context.budget) };
        checkBudget(context, ["tools", "tokens", "runtime"]);
        const plan = normalizePlan(context.plan);
        let index = plan.findIndex((step) => ["pending", "running"].includes(step.status));
        if (index < 0) { index = plan.length; plan.push({ id: `step_${index + 1}`, title: decision.reason || decision.tool }); }
        plan[index] = { ...plan[index], status: "running", tool: decision.tool, startedAt: new Date().toISOString() };
        context = { ...context, plan, budget: { ...context.budget, usedToolCalls: context.budget.usedToolCalls + 1 } };
        await save({ context });
        await event({ type: "tool", title: decision.reason || decision.tool, status: "running", data: { tool: decision.tool } });
        const started = Date.now();
        const result = await execute(decision.tool, decision.args || {}, { userId: task.userId, task: { ...task, context } });
        await guard();
        if (result.requiresApproval) {
            const hash = crypto.createHash("sha256").update(JSON.stringify([context.iteration, decision.tool, decision.args])).digest("hex").slice(0, 24);
            const pendingAction = { ...result.action, idempotencyKey: `${task.id}:${hash}`, planStepId: plan[index].id };
            context = { ...context, plan: plan.map((step, i) => i === index ? { ...step, status: "waiting", summary: result.summary } : step) };
            await save({ context, pendingAction });
            await event({ type: "approval_required", title: "需要你的确认", content: result.summary, status: "waiting", data: { action: pendingAction } });
            return { data: { ...data, context, pendingAction, phase: "approval" } };
        }
        context = observed({ ...context, ...(result.contextPatch || {}),
            plan: plan.map((step, i) => i === index ? { ...step, status: "completed", summary: result.summary, completedAt: new Date().toISOString() } : step) },
        { tool: decision.tool, args: decision.args, summary: result.summary, data: result.data });
        await save({ context });
        if (result.event) await event(result.event);
        await event({ type: "tool_result", title: result.summary, status: "completed",
            data: { ...(result.data || {}), _telemetry: { tool: decision.tool, durationMs: Date.now() - started } } });
        return { data: { context, phase: "plan", pendingAction: null } };
    });
    // No side effects before interrupt: this node restarts when resumed.
    graph.addNode("approval", async ({ data }) => {
        await guard();
        const response = interrupt({ kind: "approval", key: data.pendingAction.idempotencyKey, action: data.pendingAction });
        if (response?.kind !== "approval" || response.key !== data.pendingAction.idempotencyKey || typeof response.approved !== "boolean") {
            stop("GRAPH_INVALID_RESUME", "审批响应与当前待确认动作不匹配");
        }
        return { data: { ...data, approved: response.approved } };
    });
    graph.addNode("apply_approval", async ({ data }) => {
        await guard();
        const action = data.pendingAction;
        if (!data.approved) {
            const context = observed(data.context, { tool: action.type, rejected: true, summary: "用户拒绝执行该动作" });
            await save({ context, pendingAction: null });
            await event({ type: "approval", title: "已拒绝执行，任务已停止", status: "failed" });
            return { data: { context, phase: "cancelled", pendingAction: null, result: { summary: "已按你的选择停止任务，未执行待审批操作" } } };
        }
        const result = await perform(action, data.context);
        const context = observed({ ...data.context, approvalReceipts: result.receipts,
            plan: normalizePlan(data.context.plan).map((step) => step.id === action.planStepId ? { ...step, status: "completed", summary: result.summary } : step) },
        { tool: action.type, summary: result.summary, data: result.data });
        await save({ context, pendingAction: null });
        await event({ type: "approval", title: result.summary, status: "completed", data: result.data });
        return { data: { context, phase: "plan", pendingAction: null } };
    });
    graph.addNode("input", async ({ data }) => {
        await guard();
        const response = interrupt({ kind: "input", question: data.decision.question });
        if (response?.kind !== "input" || typeof response.content !== "string" || !response.content.trim()) stop("GRAPH_INVALID_RESUME", "补充要求不能为空");
        const context = observed({ ...data.context, attachments: [...(data.context.attachments || []), ...(response.attachments || [])].slice(-6) },
            { tool: "user_instruction", summary: response.content, data: { content: response.content } });
        await save({ context });
        return { data: { context, phase: "plan", pendingAction: null } };
    });
    graph.addNode("done", async ({ data }) => {
        await guard();
        const context = { ...data.context, plan: normalizePlan(data.context.plan).map((step) => step.status === "completed" ? step : { ...step, status: "skipped" }) };
        return { data: { context, phase: "completed", pendingAction: null,
            result: { summary: data.decision.summary, artifacts: context.artifacts || {} } } };
    });
    graph.addEdge(START, "plan");
    graph.addConditionalEdges("plan", ({ data }) => data.phase, { execute: "execute", input: "input", done: "done" });
    graph.addConditionalEdges("execute", ({ data }) => data.phase, { approval: "approval", plan: "plan" });
    graph.addEdge("approval", "apply_approval");
    graph.addConditionalEdges("apply_approval", ({ data }) => data.phase, { plan: "plan", cancelled: END });
    graph.addEdge("input", "plan");
    graph.addEdge("done", END);
    return graph.compile({ checkpointer });
}

async function runGraphTask({ task, workerId, decide, normalizePlan, maxRetries = 3 }) {
    const store = require("./task-store");
    const db = require("../../utils/db");
    const { MySqlTaskSaver } = require("./mysql-checkpointer");
    const { executeTool, performApprovedAction } = require("./tools");
    const generation = task.attemptCount;
    const update = (patch) => store.updateGraphTask(task.id, workerId, generation, patch);
    const guard = async () => {
        const { results } = await db.query({ sql: `SELECT id FROM agent_task WHERE id = ? AND locked_by = ?
            AND attempt_count = ? AND status = 'running' AND lock_expires_at > NOW()`, values: [task.id, workerId, generation] });
        if (!results.length) stop("GRAPH_EXECUTION_STOPPED", "任务已停止或租约失效");
    };
    const save = async (patch) => {
        if (patch.context) {
            const current = await store.getTask(task.id);
            const { executionResume, ...context } = patch.context;
            patch = { ...patch, context: { ...context, executionRetries: current.context?.executionRetries || 0,
                approvalReceipts: mergeReceipts(current.context?.approvalReceipts, context.approvalReceipts) } };
        }
        return update(patch);
    };
    const event = async (value) => { await guard(); return store.addEvent(task.id, value); };
    const perform = createApprovedActionExecutor({ task, load: () => store.getTask(task.id), save, performAction: performApprovedAction });
    try {
        const checkpointer = new MySqlTaskSaver({ db, taskId: task.id, workerId, generation });
        await checkpointer.setup();
        const graph = createAgentGraph({ checkpointer, task, decide, execute: executeTool, perform, guard, save, event, normalizePlan });
        const config = { configurable: { thread_id: task.id }, durability: "sync", recursionLimit: 400 };
        const existing = await checkpointer.getTuple(config);
        let input = { data: { context: task.context, phase: "plan", pendingAction: null } };
        if (existing) {
            const snapshot = await graph.getState(config);
            const waiting = snapshot.tasks?.some((item) => item.interrupts?.length);
            input = waiting && task.context.executionResume ? new Command({ resume: task.context.executionResume }) : null;
            // A completed graph may have committed its checkpoint before the SQL view was updated.
            if (!snapshot.next.length) input = null;
        }
        await event({ type: "status", title: existing ? "LangGraph 恢复执行" : "LangGraph 开始执行", status: "running", data: { engine: "langgraph", attemptCount: generation } });
        await graph.invoke(input, config);
        const snapshot = await graph.getState(config);
        const data = snapshot.values.data;
        const waiting = snapshot.tasks?.some((item) => item.interrupts?.length);
        const status = waiting ? data.phase === "approval" ? "waiting_approval" : "waiting_input" : data.phase;
        if (!["waiting_approval", "waiting_input", "completed", "cancelled"].includes(status)) throw new Error("Graph stopped without a valid terminal or interrupt state");
        await save({ context: data.context, pendingAction: data.pendingAction || null });
        if (status === "waiting_input") await event({ type: "question", title: "还需要你补充一点", content: data.decision.question, status: "waiting" });
        if (status === "completed") await event({ type: "result", title: "任务完成", content: data.result.summary, status: "completed", data: data.result });
        await update({ status, result: data.result || null, lastError: "", lockedBy: null, lockExpiresAt: null, heartbeatAt: null,
            ...(["completed", "cancelled"].includes(status) ? { completedAt: new Date() } : {}) });
        // Broadcast after the SQL view changes so the existing UI sees the interrupt immediately.
        await store.addEvent(task.id, { type: "status", title: { waiting_approval: "等待你的确认", waiting_input: "等待补充信息", completed: "任务已完成", cancelled: "任务已停止" }[status],
            status: status.startsWith("waiting_") ? "waiting" : status === "completed" ? "completed" : "failed", data: { engine: "langgraph" } });
    } catch (error) {
        if (error.code === "GRAPH_EXECUTION_STOPPED") return;
        const current = await store.getTask(task.id);
        const uncertain = Boolean(current?.pendingAction?.executionStartedAt);
        const attempts = Number(current?.context?.executionRetries || 0) + 1;
        const retry = !uncertain && !["AGENT_BUDGET_EXCEEDED", "GRAPH_ACTION_UNCERTAIN", "GRAPH_INVALID_RESUME"].includes(error.code) && attempts < maxRetries;
        try {
            await event({ type: retry ? "retry" : "error", title: retry ? "执行暂时失败，将从检查点重试" : "LangGraph 执行停止", content: error.message, status: "failed", data: { code: error.code || "GRAPH_ERROR", attempt: attempts } });
            await update({ context: { ...current.context, executionRetries: attempts }, status: retry ? "queued" : "failed",
                lastError: uncertain ? "写操作执行结果未知，请人工核对；系统不会自动重放" : error.message,
                nextRetryAt: retry ? new Date(Date.now() + 5000 * 2 ** (attempts - 1)) : null,
                lockedBy: null, lockExpiresAt: null, heartbeatAt: null });
            await store.addEvent(task.id, { type: "status", title: retry ? "任务等待重试" : "任务执行失败", status: "failed", data: { engine: "langgraph" } });
        } catch (saveError) {
            if (saveError.code !== "GRAPH_EXECUTION_STOPPED") throw saveError;
        }
    }
}

module.exports = { createAgentGraph, createApprovedActionExecutor, mergeReceipts, runGraphTask };

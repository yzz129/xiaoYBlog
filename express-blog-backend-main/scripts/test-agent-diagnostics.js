const assert = require("assert/strict");

const { aggregateTaskDiagnostics, summarizeTaskDiagnostics } = require("../agents/core/diagnostics");

const task = {
    id: "task-eval-1",
    status: "failed",
    lastError: "contract rejected",
    context: { budget: { maxSteps: 12, usedSteps: 4, maxToolCalls: 10, usedToolCalls: 1, maxTokens: 2000, usedTokens: 12, maxRuntimeMs: 60000, runtimeStartedAt: "2026-09-04T00:00:00.000Z" } },
    events: [
        { type: "decision", status: "completed", createdAt: "2026-09-04T00:00:00.000Z", data: { telemetry: {
            source: "model",
            trace: { traceId: "0123456789abcdef0123456789abcdef", spanId: "0123456789abcdef" },
            durationMs: 100,
            providerHealth: { primary: { status: "recovering", consecutiveFailures: 1, retryAfterMs: 0, lastErrorCode: "ETIMEDOUT" } },
            modelCall: {
                usage: { totalTokens: 12 },
                attempts: [
                    { provider: "primary", status: "failed", durationMs: 40 },
                    { provider: "fallback", status: "completed", durationMs: 60 },
                ],
            },
        } } },
        { type: "tool", status: "running", createdAt: "2026-09-04T00:00:01.000Z", data: { tool: "web_search" } },
        { type: "tool_result", status: "completed", createdAt: "2026-09-04T00:00:02.000Z", data: { _telemetry: { tool: "web_search", durationMs: 50 } } },
        { type: "approval_required", status: "waiting", createdAt: "2026-09-04T00:00:03.000Z" },
        { type: "approval", status: "completed", createdAt: "2026-09-04T00:00:04.000Z" },
        { type: "decision", status: "completed", createdAt: "2026-09-04T00:00:05.000Z", data: { telemetry: { source: "local_fallback", durationMs: 6 } } },
        { type: "error", status: "failed", createdAt: "2026-09-04T00:00:06.000Z", data: { code: "AGENT_CONTRACT_VIOLATION" } },
    ],
};

const report = summarizeTaskDiagnostics(task);
assert.equal(report.taskId, "task-eval-1");
assert.equal(report.lifecycle.totalEvents, 7);
assert.equal(report.lifecycle.durationMs, 6000);
assert.equal(report.decisions.total, 2);
assert.equal(report.decisions.model, 1);
assert.equal(report.decisions.localFallback, 1);
assert.equal(report.decisions.contractViolations, 1);
assert.equal(report.decisions.averageLatencyMs, 53);
assert.equal(report.models.calls, 1);
assert.equal(report.models.totalTokens, 12);
assert.equal(report.models.providers.primary.failed, 1);
assert.equal(report.models.providers.fallback.completed, 1);
assert.equal(report.models.circuitHealth.primary.status, "recovering");
assert.equal(report.observability.tracedEvents, 1);
assert.deepEqual(report.observability.traceIds, ["0123456789abcdef0123456789abcdef"]);
assert.equal(report.tools.started, 1);
assert.equal(report.tools.completed, 1);
assert.equal(report.tools.averageLatencyMs, 50);
assert.equal(report.approvals.requested, 1);
assert.equal(report.approvals.completed, 1);
assert.equal(report.budget.usedSteps, 4);
assert.equal(report.budget.usedTokens, 12);
assert.ok(report.warnings.length >= 3);

const healthyTask = {
    id: "task-eval-2",
    status: "completed",
    context: { budget: {} },
    events: [{ type: "result", status: "completed", createdAt: "2026-09-04T00:00:00.000Z" }],
};
const metrics = aggregateTaskDiagnostics([task, healthyTask]);
assert.equal(metrics.tasks.total, 2);
assert.equal(metrics.tasks.statuses.failed, 1);
assert.equal(metrics.tasks.statuses.completed, 1);
assert.equal(metrics.tasks.successRate, 0.5);
assert.equal(metrics.models.totalTokens, 12);
assert.equal(metrics.observability.tracedTasks, 1);
assert.equal(metrics.alerts.length, 1);

console.log("Agent diagnostics tests passed: lifecycle, model failover, tokens, tools, approvals, budgets, warnings.");

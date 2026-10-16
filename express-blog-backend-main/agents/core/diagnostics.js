function number(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function average(values) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + number(value), 0) / values.length);
}

function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = values.map(number).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function summarizeProviders(modelCalls) {
    const providers = {};
    modelCalls.flatMap((call) => call.attempts || []).forEach((attempt) => {
        const name = String(attempt.provider || "unknown");
        const current = providers[name] || { attempts: 0, completed: 0, failed: 0, durationMs: 0 };
        current.attempts += 1;
        current[attempt.status === "completed" ? "completed" : "failed"] += 1;
        current.durationMs += number(attempt.durationMs);
        providers[name] = current;
    });
    return providers;
}

function summarizeTaskDiagnostics(task) {
    const events = Array.isArray(task?.events) ? task.events : [];
    const decisions = events.filter((event) => event.type === "decision");
    const modelCalls = decisions.map((event) => event.data?.telemetry?.modelCall).filter(Boolean);
    const latestCircuitHealth = [...decisions].reverse().find((event) => event.data?.telemetry?.providerHealth)?.data?.telemetry?.providerHealth || {};
    const decisionLatencies = decisions.map((event) => event.data?.telemetry?.durationMs).filter(Number.isFinite);
    const toolStarts = events.filter((event) => event.type === "tool").length;
    const toolResults = events.filter((event) => event.type === "tool_result");
    const toolLatencies = toolResults.map((event) => event.data?._telemetry?.durationMs).filter(Number.isFinite);
    const errors = events.filter((event) => event.status === "failed" || event.type === "error");
    const approvals = events.filter((event) => event.type === "approval" || event.type === "approval_required");
    const contractViolations = errors.filter((event) => event.data?.code === "AGENT_CONTRACT_VIOLATION").length;
    const fallbackDecisions = decisions.filter((event) => event.data?.telemetry?.source === "local_fallback").length;
    const totalTokens = modelCalls.reduce((sum, call) => sum + number(call.usage?.totalTokens), 0);
    const traceContexts = events.map((event) => event.data?.telemetry?.trace || event.data?._telemetry?.trace || event.data?.trace).filter((item) => item?.traceId);
    const traceIds = [...new Set(traceContexts.map((item) => item.traceId))];
    const firstAt = events[0]?.createdAt || events[0]?.createTime || task?.createdAt || null;
    const lastAt = events.at(-1)?.createdAt || events.at(-1)?.createTime || task?.updatedAt || null;
    const durationMs = firstAt && lastAt ? Math.max(0, new Date(lastAt).getTime() - new Date(firstAt).getTime()) : 0;
    const warnings = [];
    if (contractViolations) warnings.push(`${contractViolations} 次模型决策未通过契约校验`);
    if (fallbackDecisions) warnings.push(`${fallbackDecisions} 次使用本地降级策略`);
    if (errors.length) warnings.push(`${errors.length} 个失败事件`);
    if (task?.status === "failed" && task?.lastError) warnings.push("任务最终状态为失败");

    return {
        taskId: task?.id || null,
        status: task?.status || "unknown",
        generatedAt: new Date().toISOString(),
        lifecycle: { firstEventAt: firstAt, lastEventAt: lastAt, durationMs, totalEvents: events.length },
        decisions: {
            total: decisions.length,
            model: decisions.length - fallbackDecisions,
            localFallback: fallbackDecisions,
            averageLatencyMs: average(decisionLatencies),
            p95LatencyMs: percentile(decisionLatencies, 0.95),
            contractViolations,
        },
        models: { calls: modelCalls.length, totalTokens, providers: summarizeProviders(modelCalls), circuitHealth: latestCircuitHealth },
        observability: { tracedEvents: traceContexts.length, traceIds },
        tools: {
            started: toolStarts,
            completed: toolResults.filter((event) => event.status === "completed").length,
            failed: toolResults.filter((event) => event.status === "failed").length,
            averageLatencyMs: average(toolLatencies),
            p95LatencyMs: percentile(toolLatencies, 0.95),
        },
        approvals: {
            requested: approvals.filter((event) => event.type === "approval_required").length,
            completed: approvals.filter((event) => event.type === "approval" && event.status === "completed").length,
            rejectedOrFailed: approvals.filter((event) => event.type === "approval" && event.status === "failed").length,
        },
        budget: {
            maxSteps: number(task?.context?.budget?.maxSteps),
            usedSteps: number(task?.context?.budget?.usedSteps),
            maxToolCalls: number(task?.context?.budget?.maxToolCalls),
            usedToolCalls: number(task?.context?.budget?.usedToolCalls),
            maxTokens: number(task?.context?.budget?.maxTokens),
            usedTokens: number(task?.context?.budget?.usedTokens),
            maxRuntimeMs: number(task?.context?.budget?.maxRuntimeMs),
            runtimeStartedAt: task?.context?.budget?.runtimeStartedAt || null,
        },
        warnings,
    };
}

function aggregateTaskDiagnostics(tasks) {
    const reports = (tasks || []).map(summarizeTaskDiagnostics);
    const statuses = {};
    const providers = {};
    reports.forEach((report) => {
        statuses[report.status] = (statuses[report.status] || 0) + 1;
        Object.entries(report.models.providers).forEach(([name, stats]) => {
            const current = providers[name] || { attempts: 0, completed: 0, failed: 0, durationMs: 0 };
            for (const key of Object.keys(current)) current[key] += number(stats[key]);
            providers[name] = current;
        });
    });
    const completed = number(statuses.completed);
    const failed = number(statuses.failed);
    const settled = completed + failed;
    return {
        generatedAt: new Date().toISOString(),
        tasks: { total: reports.length, statuses, successRate: settled ? Number((completed / settled).toFixed(4)) : null },
        models: {
            calls: reports.reduce((sum, report) => sum + report.models.calls, 0),
            totalTokens: reports.reduce((sum, report) => sum + report.models.totalTokens, 0),
            providers,
            circuitHealth: reports.find((report) => Object.keys(report.models.circuitHealth || {}).length)?.models.circuitHealth || {},
        },
        tools: {
            started: reports.reduce((sum, report) => sum + report.tools.started, 0),
            completed: reports.reduce((sum, report) => sum + report.tools.completed, 0),
            failed: reports.reduce((sum, report) => sum + report.tools.failed, 0),
        },
        approvals: {
            requested: reports.reduce((sum, report) => sum + report.approvals.requested, 0),
            completed: reports.reduce((sum, report) => sum + report.approvals.completed, 0),
            rejectedOrFailed: reports.reduce((sum, report) => sum + report.approvals.rejectedOrFailed, 0),
        },
        observability: {
            tracedTasks: reports.filter((report) => report.observability.traceIds.length).length,
            traceIds: [...new Set(reports.flatMap((report) => report.observability.traceIds))],
        },
        alerts: reports.filter((report) => report.warnings.length).map((report) => ({
            taskId: report.taskId,
            status: report.status,
            warnings: report.warnings,
        })),
    };
}

module.exports = { aggregateTaskDiagnostics, summarizeTaskDiagnostics };

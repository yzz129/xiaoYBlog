class AgentBudgetExceededError extends Error {
    constructor(kind, message, budget) {
        super(message);
        this.name = "AgentBudgetExceededError";
        this.code = "AGENT_BUDGET_EXCEEDED";
        this.kind = kind;
        this.budget = budget;
    }
}

function finite(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeBudget(value = {}, defaults = {}) {
    return {
        maxSteps: finite(value.maxSteps, finite(defaults.maxSteps, 24)),
        usedSteps: finite(value.usedSteps, 0),
        maxToolCalls: finite(value.maxToolCalls, finite(defaults.maxToolCalls, 24)),
        usedToolCalls: finite(value.usedToolCalls, 0),
        maxTokens: finite(value.maxTokens, finite(defaults.maxTokens, 100000)),
        usedTokens: finite(value.usedTokens, 0),
        maxRuntimeMs: finite(value.maxRuntimeMs, finite(defaults.maxRuntimeMs, 30 * 60 * 1000)),
        runtimeStartedAt: value.runtimeStartedAt || defaults.runtimeStartedAt || null,
    };
}

function beginRuntime(budget, now = new Date()) {
    const normalized = normalizeBudget(budget);
    if (!normalized.runtimeStartedAt) normalized.runtimeStartedAt = now.toISOString();
    return normalized;
}

function chargeModelUsage(budget, modelCall) {
    const normalized = normalizeBudget(budget);
    normalized.usedTokens += finite(modelCall?.usage?.totalTokens, 0);
    return normalized;
}

function budgetViolation(budget, options = {}) {
    const normalized = normalizeBudget(budget);
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const resources = new Set(options.resources || ["steps", "tools", "tokens", "runtime"]);
    if (resources.has("steps") && normalized.usedSteps >= normalized.maxSteps) {
        return { kind: "steps", message: `任务已使用 ${normalized.usedSteps}/${normalized.maxSteps} 个规划步骤` };
    }
    if (resources.has("tools") && normalized.usedToolCalls >= normalized.maxToolCalls) {
        return { kind: "tools", message: `任务已使用 ${normalized.usedToolCalls}/${normalized.maxToolCalls} 次工具调用` };
    }
    if (resources.has("tokens") && normalized.usedTokens >= normalized.maxTokens) {
        return { kind: "tokens", message: `任务已使用 ${normalized.usedTokens}/${normalized.maxTokens} 个模型 Token` };
    }
    if (resources.has("runtime") && normalized.runtimeStartedAt) {
        const elapsedMs = Math.max(0, now.getTime() - new Date(normalized.runtimeStartedAt).getTime());
        if (elapsedMs >= normalized.maxRuntimeMs) {
            return { kind: "runtime", message: `任务运行时间已达到 ${Math.round(elapsedMs / 1000)} 秒上限` };
        }
    }
    return null;
}

function assertBudgetAvailable(budget, options) {
    const violation = budgetViolation(budget, options);
    if (violation) throw new AgentBudgetExceededError(violation.kind, violation.message, normalizeBudget(budget));
    return normalizeBudget(budget);
}

module.exports = {
    AgentBudgetExceededError,
    assertBudgetAvailable,
    beginRuntime,
    budgetViolation,
    chargeModelUsage,
    normalizeBudget,
};

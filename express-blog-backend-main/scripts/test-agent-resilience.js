const assert = require("assert/strict");

const {
    AgentBudgetExceededError,
    assertBudgetAvailable,
    beginRuntime,
    budgetViolation,
    chargeModelUsage,
    normalizeBudget,
} = require("../agents/core/budget");
const { ProviderCircuitBreaker } = require("../agents/core/provider-health");

const startedAt = new Date("2026-09-04T00:00:00.000Z");
let budget = normalizeBudget({}, { maxSteps: 8, maxToolCalls: 6, maxTokens: 1000, maxRuntimeMs: 60000 });
budget = beginRuntime(budget, startedAt);
budget = chargeModelUsage(budget, { usage: { totalTokens: 750 } });
assert.equal(budget.usedTokens, 750);
assert.equal(budgetViolation(budget, { now: new Date("2026-09-04T00:00:30.000Z") }), null);
assert.equal(budgetViolation({ ...budget, usedToolCalls: 6 }, { resources: ["tools"] }).kind, "tools");
assert.equal(budgetViolation({ ...budget, usedTokens: 1000 }, { resources: ["tokens"] }).kind, "tokens");
assert.equal(budgetViolation(budget, { resources: ["runtime"], now: new Date("2026-09-04T00:01:00.000Z") }).kind, "runtime");
assert.throws(() => assertBudgetAvailable({ ...budget, usedSteps: 8 }), (error) => {
    assert.ok(error instanceof AgentBudgetExceededError);
    assert.equal(error.code, "AGENT_BUDGET_EXCEEDED");
    return true;
});

let now = 1000;
const breaker = new ProviderCircuitBreaker({ failureThreshold: 2, openMs: 5000, clock: () => now });
const providers = [{ name: "primary" }, { name: "fallback" }];
breaker.recordFailure("primary", { code: "ETIMEDOUT" });
assert.equal(breaker.isAvailable("primary"), true);
breaker.recordFailure("primary", { status: 503 });
assert.equal(breaker.isAvailable("primary"), false);
assert.deepEqual(breaker.select(providers).map((provider) => provider.name), ["fallback"]);
assert.equal(breaker.snapshot().primary.status, "open");
assert.equal(breaker.snapshot().primary.lastErrorCode, "503");
assert.equal(breaker.nextRetryAfterMs(providers), 5000);
now += 5000;
assert.equal(breaker.isAvailable("primary"), true);
breaker.recordSuccess("primary");
assert.equal(breaker.snapshot().primary.status, "closed");

console.log("Agent resilience tests passed: token/runtime/tool budgets and provider circuit recovery.");

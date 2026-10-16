const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");

const { validateAgentDecision } = require("../agents/core/contracts");
const { fallbackDecision } = require("../agents/pet-agent/runtime");
const { TOOL_DEFINITIONS } = require("../agents/pet-agent/tools");

const baseCases = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "agent-eval-cases.json"), "utf8"));
const goalVariants = [
    (goal) => goal,
    (goal) => `请${goal}`,
    (goal) => `麻烦你${goal}`,
    (goal) => `小Y，${goal}`,
    (goal) => `${goal}。`,
    (goal) => `现在${goal}`,
    (goal) => `请认真完成：${goal}`,
    (goal) => `用户明确要求：${goal}`,
    (goal) => `\n${goal}\n`,
    (goal) => `请按我的原意${goal}`,
];
const cases = baseCases.flatMap((testCase) => goalVariants.map((variant, index) => ({
    ...testCase,
    name: `${testCase.name} [variant ${index + 1}]`,
    task: { ...testCase.task, goal: variant(testCase.task.goal) },
})));
const failures = [];

for (const testCase of cases) {
    try {
        const decision = validateAgentDecision(fallbackDecision(testCase.task), TOOL_DEFINITIONS);
        assert.equal(decision.kind, testCase.expected.kind);
        if (testCase.expected.tool) assert.equal(decision.tool, testCase.expected.tool);
        for (const [key, value] of Object.entries(testCase.expected.args || {})) assert.deepEqual(decision.args?.[key], value);
    } catch (error) {
        failures.push({ name: testCase.name, error: error.message });
    }
}

const passed = cases.length - failures.length;
const score = Number((passed / cases.length).toFixed(4));
console.log(`Agent decision eval: ${passed}/${cases.length} passed (${(score * 100).toFixed(1)}%, ${baseCases.length} golden scenarios × ${goalVariants.length} language variants)`);
failures.forEach((failure) => console.error(`- ${failure.name}: ${failure.error}`));
assert.equal(score, 1, "Agent decision eval must remain at 100%");

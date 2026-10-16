const assert = require("assert");

const loop = require("../agents/pet-agent/agent-loop");
const store = require("../agents/pet-agent/agent-loop-store");

const baseProfile = {
    settings: {
        proactiveEnabled: true,
        humorLevel: 2,
        intervalMinutes: 60,
        quietStart: "23:00",
        quietEnd: "07:00",
        timezone: "Asia/Shanghai",
        dailyLimit: 4,
    },
    memory: { topics: { vue: 5 }, preferences: [], dislikes: [] },
    evolution: { variants: {}, feedback: {} },
    lastInteractionAt: null,
    dailyInteractionCount: 0,
    dailyInteractionDate: null,
};

assert.equal(loop.isQuietTime(baseProfile.settings, new Date("2026-08-20T16:30:00.000Z")), true, "00:30 should be quiet in Shanghai");
assert.equal(loop.isQuietTime(baseProfile.settings, new Date("2026-08-20T04:00:00.000Z")), false, "12:00 should be active in Shanghai");
assert.equal(loop.isDue(baseProfile, new Date("2026-08-20T04:00:00.000Z")), true, "new profile should be due outside quiet hours");
assert.equal(loop.isDue({ ...baseProfile, settings: { ...baseProfile.settings, proactiveEnabled: false } }), false, "disabled loop must not run");

const approval = loop.selectInteraction(baseProfile, [{ id: "task-1", title: "发布文章", status: "waiting_approval" }], new Date("2026-08-20T04:00:00.000Z"), () => 0);
assert.equal(approval.kind, "task_attention");
assert.equal(approval.metadata.taskId, "task-1");

const companion = loop.selectInteraction(baseProfile, [], new Date("2026-08-20T04:00:00.000Z"), () => 0.5);
assert.equal(companion.kind, "companion");
assert.ok(companion.content.length > 8);
assert.ok(companion.suggestion.length > 4);

const learned = store.extractLearning("我喜欢写 Vue 3 和前端性能优化文章");
assert.ok(learned.topics.includes("vue"));
const sensitive = store.extractLearning("我的 API key 是 sk-secret-123456789，请记住");
assert.deepEqual(sensitive.topics, []);
assert.equal(sensitive.preference, "");

console.log("agent loop tests passed");

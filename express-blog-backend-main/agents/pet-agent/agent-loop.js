const loopStore = require("./agent-loop-store");
const taskStore = require("./task-store");
const { emitAgentProactive, getActiveAgentUserIds } = require("../../utils/ws");

function numberInRange(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), min), max) : fallback;
}

const LOOP_INTERVAL_MS = numberInRange(process.env.PET_AGENT_LOOP_INTERVAL_MS, 30_000, 15_000, 300_000);
const LOOP_BATCH_SIZE = numberInRange(process.env.PET_AGENT_LOOP_BATCH_SIZE, 20, 1, 100);

let loopTimer = null;
let tickRunning = false;
const processingUsers = new Set();

function zonedParts(date = new Date(), timezone = "Asia/Shanghai") {
    let formatter;
    try {
        formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        });
    } catch (_error) {
        formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        });
    }
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return {
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
        hour: Number(parts.hour),
    };
}

function timeToMinutes(value) {
    const [hour, minute] = String(value || "00:00").split(":").map(Number);
    return hour * 60 + minute;
}

function isQuietTime(settings, date = new Date()) {
    const current = zonedParts(date, settings?.timezone).minutes;
    const start = timeToMinutes(settings?.quietStart);
    const end = timeToMinutes(settings?.quietEnd);
    if (start === end) return false;
    return start < end ? current >= start && current < end : current >= start || current < end;
}

function profileDateKey(profile, timezone) {
    const value = profile?.dailyInteractionDate;
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : zonedParts(parsed, timezone).dateKey;
}

function isDue(profile, date = new Date()) {
    const settings = profile?.settings || loopStore.DEFAULT_SETTINGS;
    if (!settings.proactiveEnabled || isQuietTime(settings, date)) return false;
    const nowParts = zonedParts(date, settings.timezone);
    const todayCount = profileDateKey(profile, settings.timezone) === nowParts.dateKey
        ? Number(profile?.dailyInteractionCount || 0)
        : 0;
    if (todayCount >= Number(settings.dailyLimit || 4)) return false;
    if (!profile?.lastInteractionAt) return true;
    const last = new Date(profile.lastInteractionAt).getTime();
    if (!Number.isFinite(last)) return true;
    return date.getTime() - last >= Number(settings.intervalMinutes || 60) * 60_000;
}

function taskCandidate(tasks = []) {
    const priorities = ["waiting_approval", "waiting_input", "failed", "running"];
    for (const status of priorities) {
        const task = tasks.find((item) => item.status === status);
        if (!task) continue;
        const taskName = String(task.title || task.goal || "这个任务").slice(0, 42);
        if (status === "waiting_approval") {
            return {
                kind: "task_attention",
                variantKey: "task.waiting_approval",
                content: `“${taskName}”已经走到需要你确认的步骤啦。我先把手放在按钮外面，等你点头。`,
                suggestion: `继续处理任务：${taskName}`,
                metadata: { taskId: task.id, taskStatus: status },
            };
        }
        if (status === "waiting_input") {
            return {
                kind: "task_attention",
                variantKey: "task.waiting_input",
                content: `“${taskName}”遇到一道只有你知道答案的选择题，补充一句我就能继续跑。`,
                suggestion: `为任务补充要求：${taskName}`,
                metadata: { taskId: task.id, taskStatus: status },
            };
        }
        if (status === "failed") {
            return {
                kind: "task_attention",
                variantKey: "task.failed",
                content: `“${taskName}”刚才摔了个小跟头。要不要我换条路线重新试一次？`,
                suggestion: `分析并重试失败任务：${taskName}`,
                metadata: { taskId: task.id, taskStatus: status },
            };
        }
        return {
            kind: "task_progress",
            variantKey: "task.running",
            content: `我还在盯着“${taskName}”，进度没有偷偷溜走。你可以继续忙，有变化我会来敲气泡。`,
            suggestion: `查看任务进度：${taskName}`,
            metadata: { taskId: task.id, taskStatus: status },
        };
    }
    return null;
}

const COMPANION_TEMPLATES = [
    {
        key: "generic.focus",
        topic: "",
        humor: 0,
        content: "我在线陪你。现在最想推进哪一件事？告诉我结果，我来拆步骤。",
        suggestion: "帮我规划并执行今天最重要的一件事",
    },
    {
        key: "generic.todo",
        topic: "效率",
        humor: 1,
        content: "待办清单刚才眨了一下眼，我怀疑它在等我们先消灭最小的那一项。",
        suggestion: "帮我整理当前待办，并从最容易完成的开始执行",
    },
    {
        key: "frontend.css",
        topic: "前端",
        humor: 2,
        content: "CSS 今天没闹脾气吧？要是闹了，把现场交给我，我带着放大镜去抓布局。",
        suggestion: "检查当前页面的布局和响应式问题",
    },
    {
        key: "vue.reactive",
        topic: "vue",
        humor: 2,
        content: "Vue 说一切皆响应式，我对你准备摸鱼这件事也响应得很快 👀",
        suggestion: "找一个 Vue 项目里值得立即优化的问题",
    },
    {
        key: "react.render",
        topic: "react",
        humor: 2,
        content: "我刚巡逻了一圈，希望组件只在该更新时更新，灵感倒是可以无限重渲染。",
        suggestion: "检查 React 页面里可能的重复渲染和性能问题",
    },
    {
        key: "backend.guard",
        topic: "后端",
        humor: 1,
        content: "接口、缓存和数据库都值得偶尔点名。要不要我帮你做一次小范围健康检查？",
        suggestion: "检查后端接口、数据库和缓存是否有明显风险",
    },
    {
        key: "writing.blank",
        topic: "写作",
        humor: 2,
        content: "空白文档不可怕，可怕的是它开始和你对视。给我一个主题，我先写出能改的第一版。",
        suggestion: "根据我最近关注的主题起草一篇博客",
    },
    {
        key: "learning.review",
        topic: "学习",
        humor: 1,
        content: "知识不会因为看过一遍就自动入住长期记忆。要不要我把今天学的内容压成一张复习卡？",
        suggestion: "把我今天学习的内容整理成复习提纲",
    },
    {
        key: "ai.loop",
        topic: "AI",
        humor: 3,
        content: "Agent Loop 已上线：你负责灵感，我负责让 TODO 失去隐身能力。",
        suggestion: "观察当前项目并主动提出一个可执行的改进任务",
    },
];

function weightedChoice(items, profile, random = Math.random) {
    const variants = profile?.evolution?.variants || {};
    const topics = profile?.memory?.topics || {};
    const preferences = (profile?.memory?.preferences || []).join(" ").toLowerCase();
    const dislikes = (profile?.memory?.dislikes || []).join(" ").toLowerCase();
    const weighted = items.map((item) => {
        const feedbackScore = Number(variants[item.key]?.score || 0);
        const topicScore = Number(topics[item.topic] || 0);
        const topic = String(item.topic || "").toLowerCase();
        const preferenceBoost = topic && preferences.includes(topic) ? 1.2 : 0;
        const dislikePenalty = topic && dislikes.includes(topic) ? 0.15 : 1;
        return {
            item,
            weight: Math.max(0.08, (1 + feedbackScore * 0.18 + Math.min(topicScore, 12) * 0.12 + preferenceBoost) * dislikePenalty),
        };
    });
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = random() * total;
    for (const entry of weighted) {
        cursor -= entry.weight;
        if (cursor <= 0) return entry.item;
    }
    return weighted[weighted.length - 1].item;
}

function selectInteraction(profile, tasks = [], date = new Date(), random = Math.random) {
    const task = taskCandidate(tasks);
    if (task) return task;
    const humorLevel = Number(profile?.settings?.humorLevel ?? loopStore.DEFAULT_SETTINGS.humorLevel);
    const available = COMPANION_TEMPLATES.filter((item) => item.humor <= humorLevel);
    const chosen = weightedChoice(available.length ? available : COMPANION_TEMPLATES.slice(0, 1), profile, random);
    const hour = zonedParts(date, profile?.settings?.timezone).hour;
    const greeting = hour < 11 ? "早上好，" : hour >= 18 ? "晚上好，" : "";
    return {
        kind: "companion",
        variantKey: chosen.key,
        content: `${greeting}${chosen.content}`,
        suggestion: chosen.suggestion,
        metadata: { topic: chosen.topic, humor: chosen.humor },
    };
}

function interactionDedupeKey(userId, interaction, profile, date) {
    const settings = profile.settings || loopStore.DEFAULT_SETTINGS;
    const parts = zonedParts(date, settings.timezone);
    const windowMinutes = Math.max(Number(settings.intervalMinutes || 60), 30);
    const bucket = Math.floor(parts.minutes / windowMinutes);
    return `agent-loop:${userId}:${interaction.variantKey}:${parts.dateKey}:${bucket}`;
}

async function processUser(userId, date = new Date()) {
    if (!userId || processingUsers.has(userId)) return null;
    processingUsers.add(userId);
    try {
        const profile = await loopStore.getProfile(userId);
        if (!isDue(profile, date)) return null;
        const tasks = await taskStore.listTasks(userId, 8);
        const proposal = selectInteraction(profile, tasks, date);
        const interaction = await loopStore.createInteraction({
            userId,
            ...proposal,
            dedupeKey: interactionDedupeKey(userId, proposal, profile, date),
        });
        if (interaction) emitAgentProactive(userId, interaction);
        return interaction;
    } finally {
        processingUsers.delete(userId);
    }
}

async function tick(date = new Date()) {
    if (tickRunning || process.env.PET_AGENT_LOOP_ENABLED === "false") return [];
    tickRunning = true;
    try {
        const userIds = (await getActiveAgentUserIds()).slice(0, LOOP_BATCH_SIZE);
        const results = await Promise.allSettled(userIds.map((id) => processUser(Number(id), date)));
        results.filter((result) => result.status === "rejected").forEach((result) => {
            console.error("[Pet Agent Loop] proactive interaction failed:", result.reason);
        });
        return results;
    } finally {
        tickRunning = false;
    }
}

function start() {
    if (loopTimer || process.env.PET_AGENT_LOOP_ENABLED === "false") return;
    loopStore.ensureTables()
        .then(() => tick())
        .catch((error) => console.error("[Pet Agent Loop] initialization failed:", error));
    loopTimer = setInterval(() => tick().catch((error) => console.error("[Pet Agent Loop] tick failed:", error)), LOOP_INTERVAL_MS);
    loopTimer.unref?.();
}

function stop() {
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = null;
}

module.exports = {
    COMPANION_TEMPLATES,
    isDue,
    isQuietTime,
    processUser,
    selectInteraction,
    start,
    stop,
    tick,
    zonedParts,
};

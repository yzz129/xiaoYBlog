const express = require("express");

const runtime = require("../agents/pet-agent/runtime");
const store = require("../agents/pet-agent/task-store");

const router = express.Router();

function userId(req) {
    return Number(req.currentUser?.id || req.currentUser?.userId || 0);
}

function sendError(res, message, code = "016001") {
    res.send({ code, msg: message });
}

function inferTitle(goal) {
    const text = String(goal || "").replace(/\s+/g, " ").trim();
    return text.length > 34 ? `${text.slice(0, 34)}…` : text || "新任务";
}

function normalizeAttachments(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 6).map((item) => {
        try {
            const url = new URL(String(item?.url || ""));
            if (!["http:", "https:"].includes(url.protocol)) return null;
            return { type: "image", url: url.toString(), name: String(item?.name || "图片").slice(0, 120) };
        } catch (_error) {
            return null;
        }
    }).filter(Boolean);
}

function parseNaturalSchedule(goal) {
    const text = String(goal || "");
    const dayOffset = /后天/.test(text) ? 2 : /明天|明日/.test(text) ? 1 : /今天|今日/.test(text) ? 0 : null;
    const timeMatch = text.match(/(上午|下午|晚上|今晚|中午)?\s*(\d{1,2})(?:[:：点时]\s*(\d{1,2})?)?/);
    if (dayOffset === null || !timeMatch) return null;
    let hour = Number(timeMatch[2]);
    const minute = Number(timeMatch[3] || 0);
    if (/下午|晚上|今晚/.test(timeMatch[1] || "") && hour < 12) hour += 12;
    if (/中午/.test(timeMatch[1] || "") && hour < 11) hour += 12;
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date;
}

router.post("/tasks", async (req, res) => {
    const goal = String(req.body?.message || req.body?.goal || "").trim();
    if (!goal) return sendError(res, "请告诉小Y要做什么");
    try {
        const ownerId = userId(req);
        const maxActiveTasks = Math.min(Math.max(Number(process.env.PET_AGENT_MAX_ACTIVE_TASKS_PER_USER) || 5, 1), 20);
        if (await store.countActiveTasks(ownerId) >= maxActiveTasks) {
            return sendError(res, `同时进行的任务不能超过 ${maxActiveTasks} 个，请先完成或取消已有任务`, "016429");
        }
        let scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : parseNaturalSchedule(goal);
        if (scheduledAt && Number.isNaN(scheduledAt.getTime())) scheduledAt = null;
        if (scheduledAt && scheduledAt.getTime() <= Date.now()) scheduledAt = null;
        const status = scheduledAt ? "scheduled" : "queued";
        const task = await store.createTask({
            userId: ownerId,
            title: inferTitle(goal),
            goal,
            scheduledAt,
            timezone: String(req.body?.timezone || "Asia/Shanghai").slice(0, 64),
            status,
            attachments: normalizeAttachments(req.body?.attachments),
        });
        await store.addEvent(task.id, {
            type: "status",
            title: scheduledAt ? "任务已安排" : "任务已进入队列",
            content: scheduledAt ? `将在 ${scheduledAt.toLocaleString("zh-CN", { hour12: false })} 开始执行` : "小Y 马上开始处理",
            status: scheduledAt ? "scheduled" : "running",
        });
        if (!scheduledAt) runtime.kick(task.id);
        res.send({ code: "0", data: await store.getTaskWithEvents(task.id, userId(req)) });
    } catch (error) {
        console.error(error);
        sendError(res, error.message || "创建任务失败");
    }
});

router.get("/tasks", async (req, res) => {
    try {
        res.send({ code: "0", data: await store.listTasks(userId(req), req.query.limit) });
    } catch (error) {
        sendError(res, error.message || "读取任务失败");
    }
});

router.get("/tasks/:id", async (req, res) => {
    try {
        const task = await store.getTaskWithEvents(req.params.id, userId(req));
        if (!task) return sendError(res, "任务不存在", "016404");
        res.send({ code: "0", data: task });
    } catch (error) {
        sendError(res, error.message || "读取任务失败");
    }
});

router.post("/tasks/:id/messages", async (req, res) => {
    const content = String(req.body?.content || "").trim();
    if (!content) return sendError(res, "补充要求不能为空");
    try {
        const task = await store.getTask(req.params.id, userId(req));
        if (!task) return sendError(res, "任务不存在", "016404");
        const attachments = normalizeAttachments(req.body?.attachments);
        const context = {
            ...(task.context || {}),
            attachments: [...(task.context?.attachments || []), ...attachments].slice(-6),
            observations: [...(task.context?.observations || []), { tool: "user_instruction", summary: content, data: { content } }],
        };
        await store.updateTask(task.id, { context, status: "queued", nextRetryAt: null, lastError: "" });
        await store.addEvent(task.id, { type: "message", title: "你补充了要求", content, status: "completed" });
        runtime.kick(task.id);
        res.send({ code: "0", data: await store.getTaskWithEvents(task.id, userId(req)) });
    } catch (error) {
        sendError(res, error.message || "发送补充要求失败");
    }
});

router.post("/tasks/:id/approval", async (req, res) => {
    try {
        const task = await store.getTask(req.params.id, userId(req));
        if (!task) return sendError(res, "任务不存在", "016404");
        await runtime.approveTask(task, Boolean(req.body?.approved));
        res.send({ code: "0", data: await store.getTaskWithEvents(task.id, userId(req)) });
    } catch (error) {
        sendError(res, error.message || "处理确认失败");
    }
});

router.post("/tasks/:id/pause", async (req, res) => {
    try {
        const task = await store.getTask(req.params.id, userId(req));
        if (!task) return sendError(res, "任务不存在", "016404");
        await store.updateTask(task.id, { status: "paused" });
        await store.addEvent(task.id, { type: "status", title: "任务已暂停", content: "你可以随时继续", status: "waiting" });
        res.send({ code: "0", data: await store.getTaskWithEvents(task.id, userId(req)) });
    } catch (error) {
        sendError(res, error.message || "暂停任务失败");
    }
});

router.post("/tasks/:id/resume", async (req, res) => {
    try {
        const task = await store.getTask(req.params.id, userId(req));
        if (!task) return sendError(res, "任务不存在", "016404");
        await store.updateTask(task.id, { status: "queued", nextRetryAt: null, lastError: "" });
        await store.addEvent(task.id, { type: "status", title: "任务已继续", content: "小Y 将从保存的进度继续", status: "running" });
        runtime.kick(task.id);
        res.send({ code: "0", data: await store.getTaskWithEvents(task.id, userId(req)) });
    } catch (error) {
        sendError(res, error.message || "继续任务失败");
    }
});

router.post("/tasks/:id/cancel", async (req, res) => {
    try {
        const task = await store.getTask(req.params.id, userId(req));
        if (!task) return sendError(res, "任务不存在", "016404");
        await store.updateTask(task.id, { status: "cancelled", pendingAction: null, completedAt: new Date() });
        await store.addEvent(task.id, { type: "status", title: "任务已取消", content: "已停止后续步骤", status: "failed" });
        res.send({ code: "0", data: await store.getTaskWithEvents(task.id, userId(req)) });
    } catch (error) {
        sendError(res, error.message || "取消任务失败");
    }
});

runtime.startScheduler();

module.exports = router;

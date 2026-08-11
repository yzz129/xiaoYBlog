const crypto = require("crypto");

const dbUtils = require("../../utils/db");

let tablesReadyPromise = null;

function parseJson(value, fallback) {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch (_error) {
        return fallback;
    }
}

function serialize(value) {
    return value === undefined || value === null ? null : JSON.stringify(value);
}

function mapTask(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: Number(row.user_id),
        title: row.title,
        goal: row.goal,
        status: row.status,
        scheduledAt: row.scheduled_at,
        timezone: row.timezone || "Asia/Shanghai",
        context: parseJson(row.context_json, {}),
        pendingAction: parseJson(row.pending_action_json, null),
        result: parseJson(row.result_json, null),
        lastError: row.last_error || "",
        createdAt: row.create_time,
        updatedAt: row.update_time,
        startedAt: row.started_at,
        completedAt: row.completed_at,
    };
}

function mapEvent(row) {
    return {
        id: Number(row.id),
        taskId: row.task_id,
        type: row.event_type,
        title: row.title || "",
        content: row.content || "",
        status: row.status || "info",
        data: parseJson(row.data_json, null),
        createdAt: row.create_time,
    };
}

async function ensureTables() {
    if (!tablesReadyPromise) {
        tablesReadyPromise = (async () => {
            await dbUtils.query({
                sql: `CREATE TABLE IF NOT EXISTS agent_task (
                    id VARCHAR(64) NOT NULL,
                    user_id INT NOT NULL,
                    title VARCHAR(160) NOT NULL,
                    goal LONGTEXT NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'queued',
                    scheduled_at DATETIME NULL,
                    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
                    context_json LONGTEXT NULL,
                    pending_action_json LONGTEXT NULL,
                    result_json LONGTEXT NULL,
                    last_error TEXT NULL,
                    started_at DATETIME NULL,
                    completed_at DATETIME NULL,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_agent_task_user_time (user_id, create_time),
                    KEY idx_agent_task_status_schedule (status, scheduled_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            });
            await dbUtils.query({
                sql: `CREATE TABLE IF NOT EXISTS agent_task_event (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    task_id VARCHAR(64) NOT NULL,
                    event_type VARCHAR(48) NOT NULL,
                    title VARCHAR(200) NULL,
                    content LONGTEXT NULL,
                    status VARCHAR(24) NOT NULL DEFAULT 'info',
                    data_json LONGTEXT NULL,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_agent_event_task_id (task_id, id),
                    CONSTRAINT fk_agent_event_task FOREIGN KEY (task_id) REFERENCES agent_task (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            });
        })().catch((error) => {
            tablesReadyPromise = null;
            throw error;
        });
    }

    return tablesReadyPromise;
}

async function createTask({ userId, title, goal, scheduledAt = null, timezone = "Asia/Shanghai", status = "queued", attachments = [] }) {
    await ensureTables();
    const id = `pet_${crypto.randomUUID()}`;
    const context = { iteration: 0, observations: [], artifacts: {}, plan: [], attachments };
    await dbUtils.query({
        sql: `INSERT INTO agent_task
              (id, user_id, title, goal, status, scheduled_at, timezone, context_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [id, userId, title, goal, status, scheduledAt, timezone, serialize(context)],
    });
    await addEvent(id, {
        type: "message",
        title: "你交代了一个任务",
        content: goal,
        status: "completed",
    });
    return getTask(id, userId);
}

async function getTask(id, userId = null) {
    await ensureTables();
    const values = [id];
    let sql = "SELECT * FROM agent_task WHERE id = ?";
    if (userId) {
        sql += " AND user_id = ?";
        values.push(userId);
    }
    sql += " LIMIT 1";
    const { results } = await dbUtils.query({ sql, values });
    return mapTask(results[0]);
}

async function getTaskWithEvents(id, userId = null) {
    const task = await getTask(id, userId);
    if (!task) return null;
    const { results } = await dbUtils.query({
        sql: "SELECT * FROM agent_task_event WHERE task_id = ? ORDER BY id ASC",
        values: [id],
    });
    return { ...task, events: results.map(mapEvent) };
}

async function listTasks(userId, limit = 20) {
    await ensureTables();
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const { results } = await dbUtils.query({
        sql: `SELECT * FROM agent_task WHERE user_id = ?
              ORDER BY FIELD(status, 'running', 'waiting_approval', 'queued', 'scheduled', 'paused', 'failed', 'completed', 'cancelled'),
              update_time DESC LIMIT ?`,
        values: [userId, safeLimit],
    });
    return results.map(mapTask);
}

async function listRunnableTasks(limit = 8) {
    await ensureTables();
    const { results } = await dbUtils.query({
        sql: `SELECT * FROM agent_task
              WHERE status = 'queued'
                 OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW())
                 OR (status = 'running' AND update_time < DATE_SUB(NOW(), INTERVAL 2 MINUTE))
              ORDER BY COALESCE(scheduled_at, create_time) ASC LIMIT ?`,
        values: [Math.min(Math.max(Number(limit) || 8, 1), 20)],
    });
    return results.map(mapTask);
}

async function updateTask(id, updates = {}) {
    await ensureTables();
    const columnMap = {
        title: "title",
        status: "status",
        scheduledAt: "scheduled_at",
        timezone: "timezone",
        context: "context_json",
        pendingAction: "pending_action_json",
        result: "result_json",
        lastError: "last_error",
        startedAt: "started_at",
        completedAt: "completed_at",
    };
    const jsonFields = new Set(["context", "pendingAction", "result"]);
    const assignments = [];
    const values = [];
    Object.entries(updates).forEach(([key, value]) => {
        if (!columnMap[key]) return;
        assignments.push(`${columnMap[key]} = ?`);
        values.push(jsonFields.has(key) ? serialize(value) : value);
    });
    if (!assignments.length) return getTask(id);
    values.push(id);
    await dbUtils.query({
        sql: `UPDATE agent_task SET ${assignments.join(", ")}, update_time = NOW() WHERE id = ?`,
        values,
    });
    return getTask(id);
}

async function addEvent(taskId, event) {
    await ensureTables();
    const { results } = await dbUtils.query({
        sql: `INSERT INTO agent_task_event
              (task_id, event_type, title, content, status, data_json)
              VALUES (?, ?, ?, ?, ?, ?)`,
        values: [
            taskId,
            event.type || "status",
            event.title || "",
            event.content || "",
            event.status || "info",
            serialize(event.data),
        ],
    });
    return Number(results.insertId || 0);
}

module.exports = {
    addEvent,
    createTask,
    ensureTables,
    getTask,
    getTaskWithEvents,
    listRunnableTasks,
    listTasks,
    updateTask,
};

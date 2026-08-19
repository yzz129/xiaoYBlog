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
        nextRetryAt: row.next_retry_at,
        lockedBy: row.locked_by || "",
        lockExpiresAt: row.lock_expires_at,
        heartbeatAt: row.heartbeat_at,
        attemptCount: Number(row.attempt_count || 0),
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
                    next_retry_at DATETIME NULL,
                    locked_by VARCHAR(160) NULL,
                    lock_expires_at DATETIME NULL,
                    heartbeat_at DATETIME NULL,
                    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_agent_task_user_time (user_id, create_time),
                    KEY idx_agent_task_status_schedule (status, scheduled_at),
                    KEY idx_agent_task_runnable (status, next_retry_at, lock_expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            });
            const { results: columns } = await dbUtils.query({ sql: "SHOW COLUMNS FROM agent_task" });
            const existingColumns = new Set(columns.map((column) => column.Field));
            const missingColumns = {
                next_retry_at: "DATETIME NULL",
                locked_by: "VARCHAR(160) NULL",
                lock_expires_at: "DATETIME NULL",
                heartbeat_at: "DATETIME NULL",
                attempt_count: "INT UNSIGNED NOT NULL DEFAULT 0",
            };
            for (const [name, definition] of Object.entries(missingColumns)) {
                if (!existingColumns.has(name)) {
                    try {
                        await dbUtils.query({ sql: `ALTER TABLE agent_task ADD COLUMN ${name} ${definition}` });
                    } catch (error) {
                        if (error.code !== "ER_DUP_FIELDNAME") throw error;
                    }
                }
            }
            const { results: indexes } = await dbUtils.query({ sql: "SHOW INDEX FROM agent_task" });
            if (!indexes.some((index) => index.Key_name === "idx_agent_task_runnable")) {
                try {
                    await dbUtils.query({ sql: "ALTER TABLE agent_task ADD KEY idx_agent_task_runnable (status, next_retry_at, lock_expires_at)" });
                } catch (error) {
                    if (error.code !== "ER_DUP_KEYNAME") throw error;
                }
            }
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
    const maxSteps = Math.min(Math.max(Number(process.env.PET_AGENT_MAX_STEPS) || 24, 8), 60);
    const context = {
        iteration: 0,
        observations: [],
        artifacts: {},
        plan: [],
        attachments,
        retryState: {},
        budget: { maxSteps, usedSteps: 0, maxToolCalls: maxSteps, usedToolCalls: 0 },
    };
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

async function countActiveTasks(userId) {
    await ensureTables();
    const { results } = await dbUtils.query({
        sql: `SELECT COUNT(*) AS total FROM agent_task
              WHERE user_id = ? AND status IN ('queued', 'scheduled', 'running', 'waiting_input', 'waiting_approval', 'paused')`,
        values: [userId],
    });
    return Number(results?.[0]?.total || 0);
}

async function listRunnableTasks(limit = 8) {
    await ensureTables();
    const { results } = await dbUtils.query({
        sql: `SELECT * FROM agent_task
              WHERE (status = 'queued' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
                 OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW())
                 OR (status = 'running' AND (lock_expires_at IS NULL OR lock_expires_at <= NOW()))
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
        nextRetryAt: "next_retry_at",
        lockedBy: "locked_by",
        lockExpiresAt: "lock_expires_at",
        heartbeatAt: "heartbeat_at",
        attemptCount: "attempt_count",
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

function safeLeaseSeconds(value) {
    return Math.min(Math.max(Number(value) || 90, 30), 600);
}

async function claimTask(id, workerId, leaseSeconds = 90) {
    await ensureTables();
    const lease = safeLeaseSeconds(leaseSeconds);
    const { results } = await dbUtils.query({
        sql: `UPDATE agent_task
              SET status = 'running', locked_by = ?, lock_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
                  heartbeat_at = NOW(), next_retry_at = NULL, attempt_count = attempt_count + 1,
                  started_at = COALESCE(started_at, NOW()), update_time = NOW()
              WHERE id = ?
                AND (
                    (status = 'queued' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
                    OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW())
                    OR (status = 'running' AND (lock_expires_at IS NULL OR lock_expires_at <= NOW()))
                )
                AND (locked_by IS NULL OR lock_expires_at IS NULL OR lock_expires_at <= NOW())`,
        values: [workerId, lease, id],
    });
    return Number(results.affectedRows || 0) === 1 ? getTask(id) : null;
}

async function claimApproval(id, workerId, leaseSeconds = 90) {
    await ensureTables();
    const lease = safeLeaseSeconds(leaseSeconds);
    const { results } = await dbUtils.query({
        sql: `UPDATE agent_task
              SET status = 'running', locked_by = ?, lock_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
                  heartbeat_at = NOW(), update_time = NOW()
              WHERE id = ? AND status = 'waiting_approval' AND pending_action_json IS NOT NULL
                AND (locked_by IS NULL OR lock_expires_at IS NULL OR lock_expires_at <= NOW())`,
        values: [workerId, lease, id],
    });
    return Number(results.affectedRows || 0) === 1 ? getTask(id) : null;
}

async function heartbeatTask(id, workerId, leaseSeconds = 90) {
    await ensureTables();
    const { results } = await dbUtils.query({
        sql: `UPDATE agent_task
              SET heartbeat_at = NOW(), lock_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND), update_time = NOW()
              WHERE id = ? AND status = 'running' AND locked_by = ?`,
        values: [safeLeaseSeconds(leaseSeconds), id, workerId],
    });
    return Number(results.affectedRows || 0) === 1;
}

async function releaseClaim(id, workerId, updates = {}) {
    await ensureTables();
    const columnMap = {
        status: "status",
        context: "context_json",
        pendingAction: "pending_action_json",
        result: "result_json",
        lastError: "last_error",
        nextRetryAt: "next_retry_at",
        completedAt: "completed_at",
    };
    const jsonFields = new Set(["context", "pendingAction", "result"]);
    const assignments = ["locked_by = NULL", "lock_expires_at = NULL", "heartbeat_at = NULL"];
    const values = [];
    Object.entries(updates).forEach(([key, value]) => {
        if (!columnMap[key]) return;
        assignments.push(`${columnMap[key]} = ?`);
        values.push(jsonFields.has(key) ? serialize(value) : value);
    });
    values.push(id, workerId);
    await dbUtils.query({
        sql: `UPDATE agent_task SET ${assignments.join(", ")}, update_time = NOW() WHERE id = ? AND locked_by = ?`,
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
    claimApproval,
    claimTask,
    countActiveTasks,
    createTask,
    ensureTables,
    getTask,
    getTaskWithEvents,
    heartbeatTask,
    listRunnableTasks,
    listTasks,
    releaseClaim,
    updateTask,
};

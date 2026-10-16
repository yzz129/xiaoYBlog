const crypto = require("crypto");

const dbUtils = require("../../utils/db");

const DEFAULT_SETTINGS = Object.freeze({
    proactiveEnabled: true,
    humorLevel: 2,
    intervalMinutes: 60,
    quietStart: "23:00",
    quietEnd: "07:00",
    timezone: "Asia/Shanghai",
    dailyLimit: 4,
});

const TOPIC_RULES = [
    ["vue", /\bvue(?:\.js)?\b|vue\s*3/i],
    ["react", /\breact\b|next\.js/i],
    ["前端", /前端|css|html|typescript|javascript|vite/i],
    ["后端", /后端|node\.js|express|mysql|redis|接口|数据库/i],
    ["AI", /\bai\b|agent|模型|提示词|大模型/i],
    ["写作", /博客|文章|写作|文案|草稿|发布/i],
    ["学习", /学习|课程|复习|考试|作业/i],
    ["效率", /效率|计划|todo|任务|日程|专注/i],
];

let tablesReadyPromise = null;

function parseJson(value, fallback) {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function serialize(value) {
    return JSON.stringify(value ?? {});
}

function clampNumber(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), min), max) : fallback;
}

function normalizeTime(value, fallback) {
    const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour <= 23 && minute <= 59 ? `${match[1]}:${match[2]}` : fallback;
}

function normalizeSettings(value = {}) {
    return {
        proactiveEnabled: value.proactiveEnabled !== false,
        humorLevel: clampNumber(value.humorLevel, DEFAULT_SETTINGS.humorLevel, 0, 3),
        intervalMinutes: clampNumber(value.intervalMinutes, DEFAULT_SETTINGS.intervalMinutes, 30, 240),
        quietStart: normalizeTime(value.quietStart, DEFAULT_SETTINGS.quietStart),
        quietEnd: normalizeTime(value.quietEnd, DEFAULT_SETTINGS.quietEnd),
        timezone: String(value.timezone || DEFAULT_SETTINGS.timezone).slice(0, 64),
        dailyLimit: clampNumber(value.dailyLimit, DEFAULT_SETTINGS.dailyLimit, 1, 8),
    };
}

function mapProfile(row) {
    const settings = normalizeSettings(parseJson(row?.settings_json, {}));
    const memory = parseJson(row?.memory_json, { topics: {}, preferences: [], dislikes: [] });
    const evolution = parseJson(row?.evolution_json, { variants: {}, feedback: { liked: 0, disliked: 0, dismissed: 0 } });
    return {
        userId: Number(row?.user_id || 0),
        settings,
        memory,
        evolution,
        lastInteractionAt: row?.last_interaction_at || null,
        dailyInteractionCount: Number(row?.daily_interaction_count || 0),
        dailyInteractionDate: row?.daily_interaction_date || null,
        totalFeedback: Number(row?.total_feedback || 0),
        feedbackScore: Number(row?.feedback_score || 0),
        updatedAt: row?.update_time || null,
    };
}

function mapInteraction(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: Number(row.user_id),
        kind: row.kind,
        variantKey: row.variant_key,
        content: row.content,
        suggestion: row.suggestion || "",
        status: row.status,
        feedback: row.feedback || "",
        metadata: parseJson(row.metadata_json, {}),
        createdAt: row.create_time,
        seenAt: row.seen_at,
        feedbackAt: row.feedback_at,
    };
}

async function ensureTables() {
    if (!tablesReadyPromise) {
        tablesReadyPromise = (async () => {
            await dbUtils.query({
                sql: `CREATE TABLE IF NOT EXISTS agent_user_profile (
                    user_id INT NOT NULL,
                    settings_json LONGTEXT NULL,
                    memory_json LONGTEXT NULL,
                    evolution_json LONGTEXT NULL,
                    last_interaction_at DATETIME NULL,
                    daily_interaction_count INT UNSIGNED NOT NULL DEFAULT 0,
                    daily_interaction_date DATE NULL,
                    total_feedback INT UNSIGNED NOT NULL DEFAULT 0,
                    feedback_score INT NOT NULL DEFAULT 0,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            });
            await dbUtils.query({
                sql: `CREATE TABLE IF NOT EXISTS agent_proactive_interaction (
                    id VARCHAR(64) NOT NULL,
                    user_id INT NOT NULL,
                    kind VARCHAR(40) NOT NULL,
                    variant_key VARCHAR(80) NOT NULL,
                    content VARCHAR(600) NOT NULL,
                    suggestion VARCHAR(300) NULL,
                    status VARCHAR(24) NOT NULL DEFAULT 'unseen',
                    feedback VARCHAR(24) NULL,
                    metadata_json LONGTEXT NULL,
                    dedupe_key VARCHAR(160) NOT NULL,
                    seen_at DATETIME NULL,
                    feedback_at DATETIME NULL,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_agent_interaction_dedupe (dedupe_key),
                    KEY idx_agent_interaction_user_time (user_id, create_time),
                    KEY idx_agent_interaction_user_status (user_id, status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            });
        })().catch((error) => {
            tablesReadyPromise = null;
            throw error;
        });
    }
    return tablesReadyPromise;
}

async function getProfile(userId) {
    await ensureTables();
    await dbUtils.query({
        sql: `INSERT IGNORE INTO agent_user_profile
              (user_id, settings_json, memory_json, evolution_json)
              VALUES (?, ?, ?, ?)`,
        values: [
            userId,
            serialize(DEFAULT_SETTINGS),
            serialize({ topics: {}, preferences: [], dislikes: [] }),
            serialize({ variants: {}, feedback: { liked: 0, disliked: 0, dismissed: 0 } }),
        ],
    });
    const { results } = await dbUtils.query({ sql: "SELECT * FROM agent_user_profile WHERE user_id = ? LIMIT 1", values: [userId] });
    return mapProfile(results[0]);
}

async function updateSettings(userId, updates = {}) {
    const profile = await getProfile(userId);
    const settings = normalizeSettings({ ...profile.settings, ...updates });
    await dbUtils.query({ sql: "UPDATE agent_user_profile SET settings_json = ?, update_time = NOW() WHERE user_id = ?", values: [serialize(settings), userId] });
    return { ...profile, settings };
}

function containsSensitiveMemory(text) {
    return /(?:password|passwd|密码|密钥|secret|token|api[-_ ]?key|sk-[a-z0-9_-]{8,}|\b\d{11,}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(text);
}

function extractLearning(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 2000);
    if (!clean || containsSensitiveMemory(clean)) return { topics: [], preference: "", dislike: "" };
    const topics = TOPIC_RULES.filter(([, pattern]) => pattern.test(clean)).map(([topic]) => topic);
    const preferenceMatch = clean.match(/(?:我喜欢|我偏好|以后(?:请)?|希望你)([^。！？\n]{2,60})/);
    const dislikeMatch = clean.match(/(?:我不喜欢|不要再|别再|避免)([^。！？\n]{2,60})/);
    return {
        topics,
        preference: preferenceMatch ? preferenceMatch[0].slice(0, 80) : "",
        dislike: dislikeMatch ? dislikeMatch[0].slice(0, 80) : "",
    };
}

async function learnFromText(userId, text) {
    const learned = extractLearning(text);
    if (!learned.topics.length && !learned.preference && !learned.dislike) return null;
    const profile = await getProfile(userId);
    const memory = {
        topics: { ...(profile.memory.topics || {}) },
        preferences: [...(profile.memory.preferences || [])],
        dislikes: [...(profile.memory.dislikes || [])],
        lastLearnedAt: new Date().toISOString(),
    };
    learned.topics.forEach((topic) => { memory.topics[topic] = Math.min(Number(memory.topics[topic] || 0) + 1, 100); });
    if (learned.preference && !memory.preferences.includes(learned.preference)) memory.preferences.push(learned.preference);
    if (learned.dislike && !memory.dislikes.includes(learned.dislike)) memory.dislikes.push(learned.dislike);
    memory.preferences = memory.preferences.slice(-12);
    memory.dislikes = memory.dislikes.slice(-12);
    await dbUtils.query({ sql: "UPDATE agent_user_profile SET memory_json = ?, update_time = NOW() WHERE user_id = ?", values: [serialize(memory), userId] });
    return memory;
}

async function getRecentInteractions(userId, limit = 10) {
    await ensureTables();
    const safeLimit = clampNumber(limit, 10, 1, 30);
    const { results } = await dbUtils.query({
        sql: "SELECT * FROM agent_proactive_interaction WHERE user_id = ? ORDER BY create_time DESC LIMIT ?",
        values: [userId, safeLimit],
    });
    return results.map(mapInteraction);
}

async function createInteraction({ userId, kind, variantKey, content, suggestion = "", metadata = {}, dedupeKey }) {
    await ensureTables();
    const id = `pro_${crypto.randomUUID()}`;
    const { results } = await dbUtils.query({
        sql: `INSERT IGNORE INTO agent_proactive_interaction
              (id, user_id, kind, variant_key, content, suggestion, metadata_json, dedupe_key)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [id, userId, kind, variantKey, String(content).slice(0, 600), String(suggestion).slice(0, 300), serialize(metadata), dedupeKey],
    });
    if (!results.affectedRows) return null;
    await dbUtils.query({
        sql: `UPDATE agent_user_profile
              SET last_interaction_at = NOW(),
                  daily_interaction_count = IF(daily_interaction_date = CURRENT_DATE, daily_interaction_count + 1, 1),
                  daily_interaction_date = CURRENT_DATE, update_time = NOW()
              WHERE user_id = ?`,
        values: [userId],
    });
    const { results: rows } = await dbUtils.query({ sql: "SELECT * FROM agent_proactive_interaction WHERE id = ?", values: [id] });
    return mapInteraction(rows[0]);
}

async function setInteractionState(userId, interactionId, state) {
    await ensureTables();
    const allowed = new Set(["seen", "dismissed"]);
    if (!allowed.has(state)) throw new Error("不支持的互动状态");
    await dbUtils.query({
        sql: `UPDATE agent_proactive_interaction
              SET status = ?, seen_at = COALESCE(seen_at, NOW())
              WHERE id = ? AND user_id = ?`,
        values: [state, interactionId, userId],
    });
    const { results } = await dbUtils.query({ sql: "SELECT * FROM agent_proactive_interaction WHERE id = ? AND user_id = ?", values: [interactionId, userId] });
    return mapInteraction(results[0]);
}

async function recordFeedback(userId, interactionId, feedback) {
    await ensureTables();
    const allowed = new Set(["liked", "disliked", "dismissed"]);
    if (!allowed.has(feedback)) throw new Error("不支持的反馈类型");
    const { results } = await dbUtils.query({ sql: "SELECT * FROM agent_proactive_interaction WHERE id = ? AND user_id = ? LIMIT 1", values: [interactionId, userId] });
    const interaction = mapInteraction(results[0]);
    if (!interaction) return null;
    if (interaction.feedback === feedback) return interaction;

    const profile = await getProfile(userId);
    const evolution = { ...profile.evolution, variants: { ...(profile.evolution.variants || {}) }, feedback: { ...(profile.evolution.feedback || {}) } };
    const variant = { shown: 0, score: 0, ...(evolution.variants[interaction.variantKey] || {}) };
    const delta = feedback === "liked" ? 2 : feedback === "disliked" ? -2 : -1;
    variant.shown += interaction.feedback ? 0 : 1;
    variant.score = Math.min(Math.max(variant.score + delta, -20), 20);
    evolution.variants[interaction.variantKey] = variant;
    evolution.feedback[feedback] = Number(evolution.feedback[feedback] || 0) + 1;
    await dbUtils.query({
        sql: `UPDATE agent_proactive_interaction SET status = ?, feedback = ?, feedback_at = NOW(), seen_at = COALESCE(seen_at, NOW()) WHERE id = ? AND user_id = ?`,
        values: [feedback === "dismissed" ? "dismissed" : "seen", feedback, interactionId, userId],
    });
    await dbUtils.query({
        sql: `UPDATE agent_user_profile SET evolution_json = ?, total_feedback = total_feedback + 1,
              feedback_score = feedback_score + ?, update_time = NOW() WHERE user_id = ?`,
        values: [serialize(evolution), delta, userId],
    });
    return { ...interaction, feedback, status: feedback === "dismissed" ? "dismissed" : "seen" };
}

async function getUserName(userId) {
    const { results } = await dbUtils.query({ sql: "SELECT COALESCE(NULLIF(nick_name, ''), username) AS name FROM user WHERE id = ? LIMIT 1", values: [userId] });
    return String(results[0]?.name || "").slice(0, 32);
}

module.exports = {
    DEFAULT_SETTINGS,
    createInteraction,
    ensureTables,
    extractLearning,
    getProfile,
    getRecentInteractions,
    getUserName,
    learnFromText,
    normalizeSettings,
    recordFeedback,
    setInteractionState,
    updateSettings,
};

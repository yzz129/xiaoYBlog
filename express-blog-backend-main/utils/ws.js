const crypto = require("crypto");
const socketIo = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const config = require("../config");
const dbUtils = require("./db");
const { moderateContent } = require("./content-moderation");
const { createRedisDuplicate, getRedisClient } = require("./redis");

const CHATROOM_NAMESPACE = "/chatroom";
const NOTIFY_NAMESPACE = "/notify";
const HISTORY_KEY = "blog:chat:history";
const PRESENCE_KEY = "blog:chat:presence";

function numberInRange(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), min), max) : fallback;
}

const MAX_HISTORY = numberInRange(process.env.CHAT_HISTORY_LIMIT, 100, 10, 1000);
const PRESENCE_TTL_SECONDS = numberInRange(process.env.CHAT_PRESENCE_TTL_SECONDS, 45, 15, 300);
const SOCKET_RATE_WINDOW_SECONDS = numberInRange(process.env.CHAT_RATE_WINDOW_SECONDS, 10, 1, 60);
const SOCKET_RATE_LIMIT = numberInRange(process.env.CHAT_RATE_LIMIT, 8, 1, 100);

let io;

function normalizeAllowedOrigins() {
    return (config.allowClient || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

function isAllowedOrigin(origin) {
    if (!origin) return true;
    try {
        const url = new URL(origin);
        const allowed = normalizeAllowedOrigins();
        return allowed.includes(url.host.toLowerCase()) || allowed.includes(url.origin.toLowerCase());
    } catch (_error) {
        return false;
    }
}

function sanitizeText(value, maxLength = 1000) {
    return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

async function getUserProfileById(userId) {
    const { results } = await dbUtils.query({ sql: "SELECT id, username, nick_name, avatar FROM user WHERE id = ? LIMIT 1", values: [userId] });
    return results[0] || null;
}

async function summarizeUnreadDirectMessages(userId) {
    if (!userId) return { total_unread: 0, conversations: [] };
    const { results } = await dbUtils.query({
        sql: `SELECT m.sender_id AS user_id, COALESCE(u.nick_name, u.username) AS nick_name,
                     u.username, u.avatar, COUNT(*) AS unread_count, MAX(m.create_time) AS latest_time
              FROM user_direct_message m INNER JOIN user u ON u.id = m.sender_id
              WHERE m.receiver_id = ? AND m.read_time IS NULL
              GROUP BY m.sender_id, u.nick_name, u.username, u.avatar ORDER BY latest_time DESC`,
        values: [userId],
    });
    return {
        total_unread: results.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
        conversations: results.map((item) => ({ user_id: Number(item.user_id), nick_name: item.nick_name || item.username || "", avatar: item.avatar || "", unread_count: Number(item.unread_count || 0), latest_time: item.latest_time })),
    };
}

async function loadUserProfile(socket) {
    const currentUser = socket.data.currentUser || {};
    const dbUser = await getUserProfileById(currentUser.id);
    return {
        userId: String(currentUser.id || ""),
        name: sanitizeText(dbUser?.nick_name || dbUser?.username || currentUser.nickName || currentUser.userName || currentUser.username, 32),
        avatar: sanitizeText(dbUser?.avatar, 500),
        joinedAt: new Date().toISOString(),
    };
}

const presenceSocketKey = (socketId) => `blog:chat:socket:${socketId}`;

async function touchPresence(profile, socketId) {
    const redis = await getRedisClient();
    const expiresAt = Date.now() + PRESENCE_TTL_SECONDS * 1000;
    await Promise.all([
        redis.setEx(presenceSocketKey(socketId), PRESENCE_TTL_SECONDS, JSON.stringify({ ...profile, socketId })),
        redis.zAdd(PRESENCE_KEY, [{ score: expiresAt, value: socketId }]),
    ]);
}

async function removePresence(socketId) {
    const redis = await getRedisClient();
    await Promise.all([redis.del(presenceSocketKey(socketId)), redis.zRem(PRESENCE_KEY, socketId)]);
}

async function serializeOnlineUsers() {
    const redis = await getRedisClient();
    await redis.zRemRangeByScore(PRESENCE_KEY, 0, Date.now());
    const socketIds = await redis.zRangeByScore(PRESENCE_KEY, Date.now(), "+inf");
    if (!socketIds.length) return [];
    const rawProfiles = await redis.mGet(socketIds.map(presenceSocketKey));
    const users = new Map();
    rawProfiles.filter(Boolean).forEach((raw) => {
        try {
            const profile = JSON.parse(raw);
            if (!users.has(profile.userId)) users.set(profile.userId, profile);
        } catch (_error) {}
    });
    return Array.from(users.values());
}

async function emitPresence(namespace) {
    namespace.emit("chat:presence", { onlineUsers: await serializeOnlineUsers() });
}

function emitSystemMessage(namespace, content) {
    namespace.emit("chat:system", { id: crypto.randomUUID(), content, createdAt: new Date().toISOString() });
}

async function loadHistory() {
    const redis = await getRedisClient();
    const values = await redis.lRange(HISTORY_KEY, -MAX_HISTORY, -1);
    return values.map((value) => { try { return JSON.parse(value); } catch (_error) { return null; } }).filter(Boolean);
}

async function pushHistory(message) {
    const redis = await getRedisClient();
    await redis.rPush(HISTORY_KEY, JSON.stringify(message));
    await redis.lTrim(HISTORY_KEY, -MAX_HISTORY, -1);
}

async function consumeSocketRate(userId) {
    const redis = await getRedisClient();
    const bucket = Math.floor(Date.now() / (SOCKET_RATE_WINDOW_SECONDS * 1000));
    const key = `blog:chat:rate:${userId}:${bucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, SOCKET_RATE_WINDOW_SECONDS + 2);
    return count <= SOCKET_RATE_LIMIT;
}

function requireSession(socket, next) {
    const currentUser = socket.request.session?.user;
    if (!currentUser?.id) return next(new Error("登录状态无效，请重新登录"));
    socket.data.currentUser = currentUser;
    next();
}

function chatRoomHandler() {
    const namespace = io.of(CHATROOM_NAMESPACE);
    namespace.use(requireSession);
    namespace.on("connection", async (socket) => {
        let heartbeat;
        try {
            const profile = await loadUserProfile(socket);
            if (!profile.userId) return socket.disconnect(true);
            socket.join(`user:${profile.userId}`);
            await touchPresence(profile, socket.id);
            socket.emit("chat:init", { selfId: profile.userId, history: await loadHistory(), onlineUsers: await serializeOnlineUsers() });
            emitSystemMessage(namespace, `${profile.name} 加入了聊天室`);
            await emitPresence(namespace);
            heartbeat = setInterval(() => touchPresence(profile, socket.id).catch(console.error), 15000);
            heartbeat.unref?.();

            socket.on("chat:send", async (payload, ack) => {
                try {
                    if (!(await consumeSocketRate(profile.userId))) return ack?.({ success: false, message: "消息发送过于频繁，请稍后再试" });
                    const moderation = moderateContent(payload?.content, { maxLength: 2000 });
                    if (!moderation.allowed) return ack?.({ success: false, message: moderation.reason });
                    const latestProfile = await loadUserProfile(socket);
                    const message = { id: crypto.randomUUID(), userId: latestProfile.userId, socketId: socket.id, userName: latestProfile.name, avatar: latestProfile.avatar, content: moderation.content, createdAt: new Date().toISOString() };
                    await pushHistory(message);
                    namespace.emit("chat:message", message);
                    ack?.({ success: true, message });
                } catch (error) {
                    console.error("[Socket chat] send failed:", error);
                    ack?.({ success: false, message: "消息发送失败，请稍后重试" });
                }
            });

            socket.on("disconnect", () => {
                if (heartbeat) clearInterval(heartbeat);
                setTimeout(async () => {
                    try {
                        await removePresence(socket.id);
                        const remaining = await serializeOnlineUsers();
                        if (!remaining.some((item) => String(item.userId) === profile.userId)) emitSystemMessage(namespace, `${profile.name} 离开了聊天室`);
                        await emitPresence(namespace);
                    } catch (error) { console.error("[Socket chat] disconnect cleanup failed:", error); }
                }, 5000);
            });
        } catch (error) {
            console.error("[Socket chat] connection failed:", error);
            if (heartbeat) clearInterval(heartbeat);
            socket.disconnect(true);
        }
    });
}

function notifyHandler() {
    const namespace = io.of(NOTIFY_NAMESPACE);
    namespace.use(requireSession);
    namespace.on("connection", async (socket) => {
        const userId = String(socket.data.currentUser.id);
        socket.join(`user:${userId}`);
        await emitUnreadSummaryToUser(userId);
    });
}

async function configureRedisAdapter() {
    const pubClient = await createRedisDuplicate();
    const subClient = await createRedisDuplicate();
    io.adapter(createAdapter(pubClient, subClient));
}

function startWs(server, sessionMiddleware) {
    io = socketIo(server, {
        cors: {
            origin(origin, callback) {
                const allowed = isAllowedOrigin(origin);
                callback(allowed ? null : new Error(`Socket.IO origin not allowed: ${origin}`), allowed);
            },
            methods: ["GET", "POST"], credentials: true,
        },
    });
    if (sessionMiddleware) io.engine.use(sessionMiddleware);
    configureRedisAdapter().catch((error) => console.error("[Socket.IO] Redis adapter unavailable:", error));
    chatRoomHandler();
    notifyHandler();
}

async function emitUnreadSummaryToUser(userId) {
    if (!io || !userId) return;
    io.of(NOTIFY_NAMESPACE).to(`user:${userId}`).emit("dm:unread-summary", await summarizeUnreadDirectMessages(Number(userId)));
}

function emitDirectMessageToUsers(userIds, messagePayload) {
    if (!io || !messagePayload) return;
    new Set(userIds.map(String)).forEach((userId) => io.of(NOTIFY_NAMESPACE).to(`user:${userId}`).emit("dm:new", messagePayload));
}

function emitAgentTaskUpdate(userId, payload) {
    if (!io || !userId) return;
    io.of(NOTIFY_NAMESPACE).to(`user:${userId}`).emit("agent:task", payload);
}

function disconnectUserSockets(userId) {
    if (!io || !userId) return;
    const room = `user:${userId}`;
    io.of(CHATROOM_NAMESPACE).in(room).disconnectSockets(true);
    io.of(NOTIFY_NAMESPACE).in(room).disconnectSockets(true);
}

module.exports = { disconnectUserSockets, emitAgentTaskUpdate, emitDirectMessageToUsers, emitUnreadSummaryToUser, startWs };

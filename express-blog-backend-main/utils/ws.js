const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");
const config = require("../config");
const dbUtils = require("./db");

const CHATROOM_NAMESPACE = "/chatroom";
const NOTIFY_NAMESPACE = "/notify";
const MAX_HISTORY = 100;
const RECONNECT_GRACE_MS = 5000;

const chatMessages = [];
const onlineUsers = new Map();
const socketToUser = new Map();
const disconnectTimers = new Map();
const notifyUsers = new Map();
const notifySocketToUser = new Map();

let io;

function normalizeAllowedOrigins() {
    return (config.allowClient || [])
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean);
}

function isAllowedOrigin(origin) {
    if (!origin) {
        return true;
    }

    try {
        const url = new URL(origin);
        const host = url.host.toLowerCase();
        const fullOrigin = url.origin.toLowerCase();
        const allowed = normalizeAllowedOrigins();
        return allowed.includes(host) || allowed.includes(fullOrigin);
    } catch (error) {
        return false;
    }
}

function sanitizeText(value, maxLength = 1000) {
    return String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim()
        .slice(0, maxLength);
}

function resolveTokenFromSocket(socket) {
    const tokenFromAuth = sanitizeText(socket.handshake.auth?.token, 2048);
    if (tokenFromAuth) {
        return tokenFromAuth;
    }
    return "";
}

async function getUserProfileById(userId) {
    if (!userId) {
        return null;
    }

    const { results } = await dbUtils.query({
        sql: "SELECT id, username, nick_name, avatar FROM user WHERE id = ? LIMIT 1",
        values: [userId],
    });

    return results[0] || null;
}

async function summarizeUnreadDirectMessages(userId) {
    if (!userId) {
        return {
            total_unread: 0,
            conversations: [],
        };
    }

    const { results } = await dbUtils.query({
        sql: `SELECT
                m.sender_id AS user_id,
                COALESCE(u.nick_name, u.username) AS nick_name,
                u.username,
                u.avatar,
                COUNT(*) AS unread_count,
                MAX(m.create_time) AS latest_time
              FROM user_direct_message m
              INNER JOIN user u ON u.id = m.sender_id
              WHERE m.receiver_id = ? AND m.read_time IS NULL
              GROUP BY m.sender_id, u.nick_name, u.username, u.avatar
              ORDER BY latest_time DESC`,
        values: [userId],
    });

    return {
        total_unread: results.reduce((total, item) => total + Number(item.unread_count || 0), 0),
        conversations: results.map((item) => ({
            user_id: Number(item.user_id),
            nick_name: item.nick_name || item.username || "",
            avatar: item.avatar || "",
            unread_count: Number(item.unread_count || 0),
            latest_time: item.latest_time,
        })),
    };
}

async function loadUserProfile(socket) {
    const currentUser = socket.data.currentUser || {};
    const dbUser = await getUserProfileById(currentUser.id);

    return {
        userId: String(currentUser.id || ""),
        name:
            sanitizeText(
                dbUser?.nick_name ||
                    dbUser?.username ||
                    currentUser.nick_name ||
                    currentUser.userName ||
                    currentUser.username,
                32
            ) || `用户-${socket.id.slice(0, 6)}`,
        avatar: sanitizeText(dbUser?.avatar, 500) || "",
    };
}

function buildChatMessage(profile, content, socketId) {
    return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: profile.userId,
        socketId,
        userName: profile.name,
        avatar: profile.avatar,
        content,
        createdAt: new Date().toISOString(),
    };
}

function pushHistory(message) {
    chatMessages.push(message);
    if (chatMessages.length > MAX_HISTORY) {
        chatMessages.splice(0, chatMessages.length - MAX_HISTORY);
    }
}

function serializeOnlineUsers() {
    return Array.from(onlineUsers.values()).map((user) => ({
        socketId: Array.from(user.socketIds)[0] || user.userId,
        userId: user.userId,
        name: user.name,
        avatar: user.avatar,
        joinedAt: user.joinedAt,
    }));
}

function emitPresence(namespace) {
    namespace.emit("chat:presence", {
        onlineUsers: serializeOnlineUsers(),
    });
}

function emitSystemMessage(namespace, content) {
    namespace.emit("chat:system", {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content,
        createdAt: new Date().toISOString(),
    });
}

function clearDisconnectTimer(userId) {
    const timer = disconnectTimers.get(userId);
    if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(userId);
    }
}

function upsertOnlineUser(profile, socketId) {
    const existing = onlineUsers.get(profile.userId);
    const isFirstOnline = !existing;

    if (existing) {
        existing.name = profile.name;
        existing.avatar = profile.avatar;
        existing.socketIds.add(socketId);
        return { user: existing, isFirstOnline: false };
    }

    const user = {
        userId: profile.userId,
        name: profile.name,
        avatar: profile.avatar,
        joinedAt: new Date().toISOString(),
        socketIds: new Set([socketId]),
    };

    onlineUsers.set(profile.userId, user);
    return { user, isFirstOnline };
}

function scheduleOffline(namespace, userId) {
    clearDisconnectTimer(userId);

    const timer = setTimeout(() => {
        disconnectTimers.delete(userId);
        const user = onlineUsers.get(userId);
        if (!user || user.socketIds.size > 0) {
            return;
        }

        onlineUsers.delete(userId);
        emitSystemMessage(namespace, `${user.name} 离开了聊天室`);
        emitPresence(namespace);
    }, RECONNECT_GRACE_MS);

    disconnectTimers.set(userId, timer);
}

function upsertNotifyUser(userId, socketId) {
    const normalizedUserId = String(userId || "");
    if (!normalizedUserId) {
        return;
    }

    const socketIds = notifyUsers.get(normalizedUserId) || new Set();
    socketIds.add(socketId);
    notifyUsers.set(normalizedUserId, socketIds);
    notifySocketToUser.set(socketId, normalizedUserId);
}

function removeNotifySocket(socketId) {
    const userId = notifySocketToUser.get(socketId);
    notifySocketToUser.delete(socketId);

    if (!userId) {
        return;
    }

    const socketIds = notifyUsers.get(userId);
    if (!socketIds) {
        return;
    }

    socketIds.delete(socketId);
    if (socketIds.size === 0) {
        notifyUsers.delete(userId);
    }
}

async function emitUnreadSummaryToUser(userId) {
    if (!io || !userId) {
        return;
    }

    const socketIds = notifyUsers.get(String(userId));
    if (!socketIds || socketIds.size === 0) {
        return;
    }

    const summary = await summarizeUnreadDirectMessages(Number(userId));
    for (const socketId of socketIds) {
        io.of(NOTIFY_NAMESPACE).to(socketId).emit("dm:unread-summary", summary);
    }
}

function emitDirectMessageToUsers(userIds, messagePayload) {
    if (!io || !Array.isArray(userIds) || !messagePayload) {
        return;
    }

    const notified = new Set();
    for (const userId of userIds.map((item) => String(item || "")).filter(Boolean)) {
        const socketIds = notifyUsers.get(userId);
        if (!socketIds) {
            continue;
        }

        for (const socketId of socketIds) {
            const dedupeKey = `${userId}:${socketId}`;
            if (notified.has(dedupeKey)) {
                continue;
            }

            notified.add(dedupeKey);
            io.of(NOTIFY_NAMESPACE).to(socketId).emit("dm:new", messagePayload);
        }
    }
}

function chatRoomHandler() {
    const namespace = io.of(CHATROOM_NAMESPACE);

    namespace.use((socket, next) => {
        const token = resolveTokenFromSocket(socket);
        if (!token) {
            next(new Error("未登录，无法进入聊天室"));
            return;
        }

        jwt.verify(token, config.jwt.secret, (error, payload) => {
            if (error) {
                next(new Error("登录状态无效，请重新登录"));
                return;
            }

            socket.data.currentUser = payload;
            next();
        });
    });

    namespace.on("connection", async (socket) => {
        try {
            const profile = await loadUserProfile(socket);
            if (!profile.userId) {
                socket.disconnect(true);
                return;
            }

            clearDisconnectTimer(profile.userId);
            const { user, isFirstOnline } = upsertOnlineUser(profile, socket.id);
            socketToUser.set(socket.id, profile.userId);

            socket.emit("chat:init", {
                selfId: profile.userId,
                history: chatMessages,
                onlineUsers: serializeOnlineUsers(),
            });

            if (isFirstOnline) {
                emitSystemMessage(namespace, `${user.name} 加入了聊天室`);
            }
            emitPresence(namespace);

            socket.on("chat:send", async (payload, ack) => {
                const content = sanitizeText(payload?.content, 2000);

                if (!content) {
                    if (typeof ack === "function") {
                        ack({ success: false, message: "消息内容不能为空" });
                    }
                    return;
                }

                const latestProfile = await loadUserProfile(socket);
                const latestUser = onlineUsers.get(latestProfile.userId);
                if (latestUser) {
                    latestUser.name = latestProfile.name;
                    latestUser.avatar = latestProfile.avatar;
                }

                emitPresence(namespace);

                const message = buildChatMessage(latestProfile, content, socket.id);
                pushHistory(message);
                namespace.emit("chat:message", message);

                if (typeof ack === "function") {
                    ack({ success: true, message });
                }
            });

            socket.on("disconnect", () => {
                const userId = socketToUser.get(socket.id);
                socketToUser.delete(socket.id);

                if (!userId) {
                    return;
                }

                const user = onlineUsers.get(userId);
                if (!user) {
                    return;
                }

                user.socketIds.delete(socket.id);

                if (user.socketIds.size > 0) {
                    emitPresence(namespace);
                    return;
                }

                scheduleOffline(namespace, userId);
            });
        } catch (error) {
            socket.disconnect(true);
        }
    });
}

function notifyHandler() {
    const namespace = io.of(NOTIFY_NAMESPACE);

    namespace.use((socket, next) => {
        const token = resolveTokenFromSocket(socket);
        if (!token) {
            next(new Error("未登录，无法接收私聊通知"));
            return;
        }

        jwt.verify(token, config.jwt.secret, (error, payload) => {
            if (error) {
                next(new Error("登录状态无效，请重新登录"));
                return;
            }

            socket.data.currentUser = payload;
            next();
        });
    });

    namespace.on("connection", async (socket) => {
        const currentUserId = String(socket.data.currentUser?.id || "");
        if (!currentUserId) {
            socket.disconnect(true);
            return;
        }

        upsertNotifyUser(currentUserId, socket.id);
        await emitUnreadSummaryToUser(currentUserId);

        socket.on("disconnect", () => {
            removeNotifySocket(socket.id);
        });
    });
}

function startWs(server) {
    io = socketIo(server, {
        cors: {
            origin(origin, callback) {
                if (isAllowedOrigin(origin)) {
                    callback(null, true);
                    return;
                }

                callback(new Error(`Socket.IO origin not allowed: ${origin}`));
            },
            methods: ["GET", "POST"],
        },
    });

    chatRoomHandler();
    notifyHandler();
}

module.exports = {
    startWs,
    emitDirectMessageToUsers,
    emitUnreadSummaryToUser,
};

const dbUtils = require("./db");
const { moderateContent } = require("./content-moderation");
const { emitDirectMessageToUsers, emitUnreadSummaryToUser } = require("./ws");

let schemaPromise = null;

function pair(userA, userB) {
    const values = [Number(userA), Number(userB)].sort((a, b) => a - b);
    return { low: values[0], high: values[1] };
}

async function ensureSocialSchema() {
    if (schemaPromise) return schemaPromise;
    schemaPromise = (async () => {
        await dbUtils.query({ sql: `CREATE TABLE IF NOT EXISTS user_friend_request (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            requester_id INT NOT NULL,
            recipient_id INT NOT NULL,
            status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
            message VARCHAR(255) NOT NULL DEFAULT '',
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_friend_request_pair (requester_id, recipient_id),
            KEY idx_friend_request_recipient_status (recipient_id, status),
            KEY idx_friend_request_requester_status (requester_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
        await dbUtils.query({ sql: `CREATE TABLE IF NOT EXISTS user_friendship (
            user_low_id INT NOT NULL,
            user_high_id INT NOT NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_low_id, user_high_id),
            KEY idx_friendship_high (user_high_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
        await dbUtils.query({ sql: `CREATE TABLE IF NOT EXISTS user_block (
            blocker_id INT NOT NULL,
            blocked_id INT NOT NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (blocker_id, blocked_id),
            KEY idx_user_block_blocked (blocked_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
        await dbUtils.query({ sql: `CREATE TABLE IF NOT EXISTS user_privacy (
            user_id INT NOT NULL,
            allow_friend_requests ENUM('everyone','following','none') NOT NULL DEFAULT 'everyone',
            allow_direct_messages ENUM('everyone','friends','none') NOT NULL DEFAULT 'friends',
            show_followers TINYINT(1) NOT NULL DEFAULT 1,
            show_following TINYINT(1) NOT NULL DEFAULT 1,
            update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
        await dbUtils.query({ sql: `CREATE TABLE IF NOT EXISTS user_direct_message (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            sender_id INT NOT NULL,
            receiver_id INT NOT NULL,
            content TEXT NOT NULL,
            read_time DATETIME NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_direct_message_sender (sender_id),
            KEY idx_direct_message_receiver (receiver_id),
            KEY idx_direct_message_pair_time (sender_id, receiver_id, create_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
        await dbUtils.query({ sql: `INSERT IGNORE INTO user_friendship (user_low_id, user_high_id, create_time)
            SELECT LEAST(a.follower_id, a.following_id), GREATEST(a.follower_id, a.following_id), GREATEST(a.create_time, b.create_time)
            FROM user_follow a INNER JOIN user_follow b
              ON a.follower_id = b.following_id AND a.following_id = b.follower_id
            WHERE a.follower_id < a.following_id` });
    })().catch((error) => {
        schemaPromise = null;
        throw error;
    });
    return schemaPromise;
}

async function getPrivacy(userId) {
    await ensureSocialSchema();
    const { results } = await dbUtils.query({ sql: "SELECT * FROM user_privacy WHERE user_id = ? LIMIT 1", values: [userId] });
    return results[0] || { user_id: Number(userId), allow_friend_requests: "everyone", allow_direct_messages: "friends", show_followers: 1, show_following: 1 };
}

async function isBlocked(userA, userB) {
    await ensureSocialSchema();
    const { results } = await dbUtils.query({
        sql: "SELECT 1 FROM user_block WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1",
        values: [userA, userB, userB, userA],
    });
    return results.length > 0;
}

async function areFriends(userA, userB) {
    await ensureSocialSchema();
    const { low, high } = pair(userA, userB);
    const { results } = await dbUtils.query({ sql: "SELECT 1 FROM user_friendship WHERE user_low_id = ? AND user_high_id = ? LIMIT 1", values: [low, high] });
    return results.length > 0;
}

async function canDirectMessage(senderId, recipientId) {
    if (await isBlocked(senderId, recipientId)) return { allowed: false, reason: "无法向该用户发送消息" };
    const privacy = await getPrivacy(recipientId);
    if (privacy.allow_direct_messages === "none") return { allowed: false, reason: "对方已关闭私信" };
    if (privacy.allow_direct_messages === "friends" && !(await areFriends(senderId, recipientId))) {
        return { allowed: false, reason: "仅好友可以向对方发送私信" };
    }
    return { allowed: true, reason: "" };
}

function socialActionError(code, message) {
    const error = new Error(message);
    error.socialCode = code;
    return error;
}

async function getUserSummary(userId) {
    const { results } = await dbUtils.query({
        sql: "SELECT id, username, nick_name, avatar FROM user WHERE id = ? LIMIT 1",
        values: [Number(userId)],
    });
    const user = results[0];
    return user ? {
        id: Number(user.id),
        username: user.username,
        name: user.nick_name || user.username,
        avatar: user.avatar || "",
    } : null;
}

async function sendFriendRequest(requesterId, recipientId, message = "") {
    requesterId = Number(requesterId);
    recipientId = Number(recipientId);
    const requestMessage = String(message || "").trim().slice(0, 255);
    if (!recipientId || requesterId === recipientId) throw socialActionError("001023", "好友申请对象无效");

    await ensureSocialSchema();
    const recipient = await getUserSummary(recipientId);
    if (!recipient) throw socialActionError("001011", "用户不存在");
    if (await isBlocked(requesterId, recipientId)) throw socialActionError("001024", "无法向该用户发送好友申请");
    if (await areFriends(requesterId, recipientId)) throw socialActionError("001025", "你们已经是好友");

    const privacy = await getPrivacy(recipientId);
    if (privacy.allow_friend_requests === "none") throw socialActionError("001026", "对方已关闭好友申请");
    if (privacy.allow_friend_requests === "following") {
        const { results } = await dbUtils.query({
            sql: "SELECT 1 FROM user_follow WHERE follower_id = ? AND following_id = ? LIMIT 1",
            values: [recipientId, requesterId],
        });
        if (!results.length) throw socialActionError("001027", "需要先关注对方才能发送好友申请");
    }

    await dbUtils.query({
        sql: `INSERT INTO user_friend_request (requester_id, recipient_id, status, message, create_time, update_time)
              VALUES (?, ?, 'pending', ?, ?, ?)
              ON DUPLICATE KEY UPDATE status = 'pending', message = VALUES(message), update_time = VALUES(update_time)`,
        values: [requesterId, recipientId, requestMessage, new Date(), new Date()],
    });
    return { recipient, message: requestMessage };
}

async function listFriendRequests(userId, box = "incoming") {
    await ensureSocialSchema();
    const normalizedBox = box === "outgoing" ? "outgoing" : "incoming";
    const ownerField = normalizedBox === "outgoing" ? "fr.requester_id" : "fr.recipient_id";
    const peerField = normalizedBox === "outgoing" ? "fr.recipient_id" : "fr.requester_id";
    const { results } = await dbUtils.query({
        sql: `SELECT fr.id, fr.requester_id, fr.recipient_id, fr.status, fr.message, fr.create_time, fr.update_time,
                     u.id AS user_id, u.username, u.nick_name, u.avatar, u.intro
              FROM user_friend_request fr INNER JOIN user u ON u.id = ${peerField}
              WHERE ${ownerField} = ? ORDER BY (fr.status = 'pending') DESC, fr.update_time DESC LIMIT 200`,
        values: [Number(userId)],
    });
    return { box: normalizedBox, items: results };
}

async function resolveFriendRequest(userId, requestId, status) {
    userId = Number(userId);
    requestId = Number(requestId);
    if (!requestId || !["accepted", "rejected"].includes(status)) {
        throw socialActionError("001030", "好友申请不存在或处理方式无效");
    }
    await ensureSocialSchema();
    const connection = await dbUtils.getConnection();
    try {
        await connection.beginTransaction();
        const { results } = await dbUtils.query({
            sql: `SELECT fr.*, u.username, u.nick_name
                  FROM user_friend_request fr
                  INNER JOIN user u ON u.id = fr.requester_id
                  WHERE fr.id = ? AND fr.recipient_id = ? AND fr.status = 'pending' FOR UPDATE`,
            values: [requestId, userId],
        }, connection, false);
        const request = results[0];
        if (!request) throw socialActionError("001030", "好友申请不存在或已处理");
        if (status === "accepted") {
            if (await isBlocked(request.requester_id, request.recipient_id)) {
                throw socialActionError("001024", "无法接受该好友申请");
            }
            const { low, high } = pair(request.requester_id, request.recipient_id);
            await dbUtils.query({
                sql: "INSERT IGNORE INTO user_friendship (user_low_id, user_high_id, create_time) VALUES (?, ?, ?)",
                values: [low, high, new Date()],
            }, connection, false);
        }
        await dbUtils.query({
            sql: "UPDATE user_friend_request SET status = ?, update_time = ? WHERE id = ?",
            values: [status, new Date(), requestId],
        }, connection, false);
        await connection.commit();
        return {
            requestId,
            status,
            requester: { id: Number(request.requester_id), name: request.nick_name || request.username },
        };
    } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
    } finally {
        connection.release();
    }
}

async function sendDirectMessage(senderId, recipientId, content) {
    senderId = Number(senderId);
    recipientId = Number(recipientId);
    const moderation = moderateContent(content, { maxLength: 2000 });
    if (!recipientId || senderId === recipientId) throw socialActionError("001014", "私聊对象无效");
    if (!moderation.allowed) throw socialActionError("001015", moderation.reason);

    const recipient = await getUserSummary(recipientId);
    if (!recipient) throw socialActionError("001011", "用户不存在");
    const permission = await canDirectMessage(senderId, recipientId);
    if (!permission.allowed) throw socialActionError("001040", permission.reason);
    await ensureSocialSchema();

    const { results: rateRows } = await dbUtils.query({
        sql: "SELECT COUNT(*) AS total FROM user_direct_message WHERE sender_id = ? AND create_time >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)",
        values: [senderId],
    });
    if (Number(rateRows[0]?.total || 0) >= 10) throw socialActionError("001041", "私信发送过于频繁，请稍后再试");

    const { results } = await dbUtils.query({
        sql: "INSERT INTO user_direct_message (sender_id, receiver_id, content, create_time) VALUES (?, ?, ?, ?)",
        values: [senderId, recipientId, moderation.content, new Date()],
    });
    const { results: messageRows } = await dbUtils.query({
        sql: `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.create_time,
                     su.username AS sender_username, su.nick_name AS sender_nick_name, su.avatar AS sender_avatar,
                     ru.username AS receiver_username, ru.nick_name AS receiver_nick_name, ru.avatar AS receiver_avatar
              FROM user_direct_message m
              LEFT JOIN user su ON su.id = m.sender_id
              LEFT JOIN user ru ON ru.id = m.receiver_id
              WHERE m.id = ? LIMIT 1`,
        values: [results.insertId],
    });
    const latestMessage = messageRows[0];
    if (latestMessage) {
        emitDirectMessageToUsers([senderId, recipientId], {
            id: latestMessage.id,
            sender_id: latestMessage.sender_id,
            receiver_id: latestMessage.receiver_id,
            content: latestMessage.content,
            create_time: latestMessage.create_time,
            sender_name: latestMessage.sender_nick_name || latestMessage.sender_username || "",
            sender_avatar: latestMessage.sender_avatar || "",
            receiver_name: latestMessage.receiver_nick_name || latestMessage.receiver_username || "",
            receiver_avatar: latestMessage.receiver_avatar || "",
        });
    }
    await emitUnreadSummaryToUser(recipientId);
    return { id: Number(results.insertId), recipient, content: moderation.content };
}

module.exports = {
    areFriends,
    canDirectMessage,
    ensureSocialSchema,
    getPrivacy,
    getUserSummary,
    isBlocked,
    listFriendRequests,
    pair,
    resolveFriendRequest,
    sendDirectMessage,
    sendFriendRequest,
};

const dbUtils = require("./db");

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

module.exports = { areFriends, canDirectMessage, ensureSocialSchema, getPrivacy, isBlocked, pair };

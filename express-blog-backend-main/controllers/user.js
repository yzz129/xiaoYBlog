const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const config = require("../config");
const dbUtils = require("../utils/db");
const emailHandler = require("../utils/email");
const { emitDirectMessageToUsers, emitUnreadSummaryToUser } = require("../utils/ws");

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

let socialTablesReadyPromise;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getPageParams = (query, defaultPageSize = DEFAULT_PAGE_SIZE) => ({
    pageNo: Math.max(toNumber(query.pageNo, DEFAULT_PAGE_NO), 1),
    pageSize: Math.min(Math.max(toNumber(query.pageSize, defaultPageSize), 1), MAX_PAGE_SIZE),
});

const normalizeString = (value) => String(value || "").trim();

const sendError = (res, code, msg, data = null, total = 0) => {
    res.send({
        code,
        msg,
        data,
        total,
    });
};

const handleServerError = (res, error, code, msg, data = null, total = 0) => {
    console.error(error);
    sendError(res, code, error?.message || msg, data, total);
};

const ensureColumnExists = async (tableName, columnName, columnDefinition) => {
    const { results } = await dbUtils.query({
        sql: `SELECT COLUMN_NAME
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
              LIMIT 1`,
        values: [tableName, columnName],
    });

    if (results.length > 0) {
        return;
    }

    await dbUtils.query({
        sql: `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
    });
};

const buildToken = (user) => {
    const roleName = user.role || "user";
    const roleId = roleName === "admin" ? 1 : 2;

    return jwt.sign(
        {
            id: user.id,
            userName: user.username,
            username: user.username,
            nick_name: user.nick_name || "",
            roleId,
            role_id: roleId,
            roleName,
            role_name: roleName,
        },
        config.jwt.secret,
        { expiresIn: `${config.jwt.expireDays}d` }
    );
};

const formatUserRecord = (user) => {
    if (!user) {
        return null;
    }

    const roleName = user.role || "user";
    const roleId = roleName === "admin" ? 1 : 2;

    return {
        id: user.id,
        username: user.username,
        user_name: user.username,
        nick_name: user.nick_name || "",
        avatar: user.avatar || "",
        email: user.email || "",
        intro: user.intro || "",
        role: roleName,
        role_id: roleId,
        role_name: roleName,
        create_time: user.create_time || null,
        update_time: user.update_time || null,
    };
};

const getTokenFromRequest = (req) => {
    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
        return authorization.replace("Bearer ", "");
    }

    return "";
};

const getOptionalAuthUser = (req) => {
    if (req.currentUser) {
        return req.currentUser;
    }

    const token = getTokenFromRequest(req);
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, config.jwt.secret);
    } catch (_error) {
        return null;
    }
};

const getCurrentUserId = (req) => toNumber(req.currentUser?.id, 0);

const getUserByUsername = async (connection, username) => {
    const { results } = await dbUtils.query(
        {
            sql: "SELECT id, username, password, nick_name, avatar, email, intro, role, create_time, update_time FROM user WHERE username = ? LIMIT 1",
            values: [username],
        },
        connection,
        false
    );

    return results[0] || null;
};

const getUserById = async (connection, userId) => {
    const { results } = await dbUtils.query(
        {
            sql: "SELECT id, username, nick_name, avatar, email, intro, role, create_time, update_time FROM user WHERE id = ? LIMIT 1",
            values: [userId],
        },
        connection,
        false
    );

    return results[0] || null;
};

const requireUserExists = async (userId) => {
    const { results } = await dbUtils.query({
        sql: "SELECT id FROM user WHERE id = ? LIMIT 1",
        values: [userId],
    });

    return results.length > 0;
};

const ensureSocialTables = async () => {
    if (!socialTablesReadyPromise) {
        socialTablesReadyPromise = Promise.all([
            dbUtils.query({
                sql: `CREATE TABLE IF NOT EXISTS user_follow (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    follower_id INT NOT NULL,
                    following_id INT NOT NULL,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_user_follow (follower_id, following_id),
                    KEY idx_user_follow_following (following_id),
                    KEY idx_user_follow_follower (follower_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            }),
            dbUtils.query({
                sql: `CREATE TABLE IF NOT EXISTS user_direct_message (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            }),
        ]);
    }

    await socialTablesReadyPromise;
    await ensureColumnExists("user_direct_message", "read_time", "DATETIME NULL");
    return socialTablesReadyPromise;
};

const buildPublicUserProfile = async (userId, currentUserId) => {
    await ensureSocialTables();

    const [{ results: users }, { results: statsRows }, { results: categories }] = await Promise.all([
        dbUtils.query({
            sql: "SELECT id, username, nick_name, avatar, intro, role, create_time FROM user WHERE id = ? LIMIT 1",
            values: [userId],
        }),
        dbUtils.query({
            sql: `SELECT
                    (SELECT COUNT(*) FROM article WHERE author_id = ? AND private = 0 AND deleted = 0) AS article_count,
                    (SELECT COUNT(*) FROM user_follow WHERE following_id = ?) AS follower_count,
                    (SELECT COUNT(*) FROM user_follow WHERE follower_id = ?) AS following_count`,
            values: [userId, userId, userId],
        }),
        dbUtils.query({
            sql: `SELECT c.id, c.category_name, COUNT(DISTINCT a.id) AS article_count
                  FROM article a
                  INNER JOIN article_category ac ON ac.article_id = a.id
                  INNER JOIN category c ON c.id = ac.category_id
                  WHERE a.author_id = ? AND a.private = 0 AND a.deleted = 0
                  GROUP BY c.id, c.category_name
                  ORDER BY article_count DESC, c.id ASC`,
            values: [userId],
        }),
    ]);

    const user = users[0];
    if (!user) {
        return null;
    }

    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
        const { results } = await dbUtils.query({
            sql: "SELECT id FROM user_follow WHERE follower_id = ? AND following_id = ? LIMIT 1",
            values: [currentUserId, userId],
        });
        isFollowing = results.length > 0;
    }

    const stats = statsRows[0] || {};

    return {
        id: user.id,
        user_name: user.username,
        username: user.username,
        nick_name: user.nick_name || "",
        avatar: user.avatar || "",
        intro: user.intro || "",
        role_name: user.role || "user",
        create_time: user.create_time || null,
        article_count: Number(stats.article_count || 0),
        follower_count: Number(stats.follower_count || 0),
        following_count: Number(stats.following_count || 0),
        is_following: isFollowing,
        categories: categories.map((item) => ({
            id: item.id,
            category_name: item.category_name,
            article_count: Number(item.article_count || 0),
        })),
    };
};

const getFollowUsers = async ({ userId, type, pageNo, pageSize }) => {
    await ensureSocialTables();

    const isFollowerList = type === "followers";
    const joinCondition = isFollowerList ? "uf.follower_id = u.id" : "uf.following_id = u.id";
    const whereField = isFollowerList ? "uf.following_id" : "uf.follower_id";

    const { results } = await dbUtils.query({
        sql: `SELECT SQL_CALC_FOUND_ROWS
                u.id,
                u.username AS user_name,
                u.username,
                u.nick_name,
                u.avatar,
                u.intro,
                u.role AS role_name,
                u.create_time,
                (SELECT COUNT(*) FROM article a WHERE a.author_id = u.id AND a.private = 0 AND a.deleted = 0) AS article_count,
                (SELECT COUNT(*) FROM user_follow f1 WHERE f1.following_id = u.id) AS follower_count,
                (SELECT COUNT(*) FROM user_follow f2 WHERE f2.follower_id = u.id) AS following_count,
                EXISTS(
                    SELECT 1
                    FROM user_follow mef
                    WHERE mef.follower_id = ? AND mef.following_id = u.id
                ) AS is_following
              FROM user_follow uf
              INNER JOIN user u ON ${joinCondition}
              WHERE ${whereField} = ?
              ORDER BY uf.create_time DESC, uf.id DESC
              LIMIT ?, ?;
              SELECT FOUND_ROWS() AS total;`,
        values: [userId, userId, (pageNo - 1) * pageSize, pageSize],
    });

    return {
        data: (results[0] || []).map((item) => ({
            id: item.id,
            user_name: item.user_name,
            username: item.username,
            nick_name: item.nick_name || "",
            avatar: item.avatar || "",
            intro: item.intro || "",
            role_name: item.role_name || "user",
            create_time: item.create_time || null,
            article_count: Number(item.article_count || 0),
            follower_count: Number(item.follower_count || 0),
            following_count: Number(item.following_count || 0),
            is_following: Boolean(item.is_following),
        })),
        total: Number(results[1]?.[0]?.total || 0),
    };
};

router.put("/login", async (req, res) => {
    const userName = normalizeString(req.body?.userName);
    const password = normalizeString(req.body?.password);

    if (!userName || !password) {
        sendError(res, "001003", "用户名或密码错误");
        return;
    }

    const connection = await dbUtils.getConnection(res);

    try {
        const user = await getUserByUsername(connection, userName);
        if (!user || user.password !== password) {
            sendError(res, "001003", "用户名或密码错误");
            return;
        }

        await dbUtils.query(
            {
                sql: "UPDATE user SET update_time = ? WHERE id = ?",
                values: [new Date(), user.id],
            },
            connection,
            false
        );

        const latestUser = await getUserById(connection, user.id);
        const token = buildToken(user);

        res.send({
            code: "0",
            data: {
                ...formatUserRecord(latestUser),
                token,
            },
        });
    } catch (error) {
        handleServerError(res, error, "001003", "登录失败");
    } finally {
        connection.release();
    }
});

router.put("/logout", (_req, res) => {
    res.send({ code: "0" });
});

router.get("/current", async (req, res) => {
    const connection = await dbUtils.getConnection(res);

    try {
        const user = await getUserById(connection, getCurrentUserId(req));
        if (!user) {
            sendError(res, "001005", "用户不存在");
            return;
        }

        res.send({
            code: "0",
            data: formatUserRecord(user),
        });
    } catch (error) {
        handleServerError(res, error, "001005", "获取当前用户失败");
    } finally {
        connection.release();
    }
});

router.get("/search", async (req, res) => {
    const keyword = normalizeString(req.query.keyword);
    const { pageNo, pageSize } = getPageParams(req.query);

    if (!keyword) {
        res.send({
            code: "0",
            data: [],
            total: 0,
        });
        return;
    }

    const likeKeyword = `%${keyword}%`;

    try {
        const { results } = await dbUtils.query({
            sql: `SELECT SQL_CALC_FOUND_ROWS
                    u.id,
                    u.username AS user_name,
                    u.username,
                    u.nick_name,
                    u.avatar,
                    u.intro,
                    u.role AS role_name,
                    u.create_time,
                    (SELECT COUNT(*) FROM article a WHERE a.author_id = u.id AND a.private = 0 AND a.deleted = 0) AS article_count,
                    (SELECT COUNT(*) FROM user_follow uf WHERE uf.following_id = u.id) AS follower_count,
                    (SELECT COUNT(*) FROM user_follow uf WHERE uf.follower_id = u.id) AS following_count
                  FROM user u
                  WHERE u.username LIKE ? OR u.nick_name LIKE ? OR u.intro LIKE ?
                  ORDER BY article_count DESC, u.create_time DESC
                  LIMIT ?, ?;
                  SELECT FOUND_ROWS() AS total;`,
            values: [likeKeyword, likeKeyword, likeKeyword, (pageNo - 1) * pageSize, pageSize],
        });

        res.send({
            code: "0",
            data: results[0] || [],
            total: Number(results[1]?.[0]?.total || 0),
        });
    } catch (error) {
        handleServerError(res, error, "001014", "搜索用户失败", [], 0);
    }
});

router.get("/public/:id", async (req, res) => {
    const userId = toNumber(req.params.id, 0);
    if (!userId) {
        sendError(res, "001011", "用户不存在");
        return;
    }

    try {
        const authUser = getOptionalAuthUser(req);
        const profile = await buildPublicUserProfile(userId, toNumber(authUser?.id, 0));

        if (!profile) {
            sendError(res, "001011", "用户不存在");
            return;
        }

        res.send({
            code: "0",
            data: profile,
        });
    } catch (error) {
        handleServerError(res, error, "001012", "获取用户详情失败");
    }
});

router.get("/follow/status/:id", async (req, res) => {
    const targetUserId = toNumber(req.params.id, 0);
    const currentUserId = getCurrentUserId(req);

    if (!targetUserId) {
        sendError(res, "001011", "用户不存在");
        return;
    }

    try {
        await ensureSocialTables();
        const { results } = await dbUtils.query({
            sql: "SELECT id FROM user_follow WHERE follower_id = ? AND following_id = ? LIMIT 1",
            values: [currentUserId, targetUserId],
        });

        res.send({
            code: "0",
            data: {
                is_following: results.length > 0,
            },
        });
    } catch (error) {
        handleServerError(res, error, "001013", "获取关注状态失败");
    }
});

router.post("/follow/:id", async (req, res) => {
    const targetUserId = toNumber(req.params.id, 0);
    const currentUserId = getCurrentUserId(req);

    if (!targetUserId || targetUserId === currentUserId) {
        sendError(res, "001013", "无法关注该用户");
        return;
    }

    try {
        if (!(await requireUserExists(targetUserId))) {
            sendError(res, "001011", "用户不存在");
            return;
        }

        await ensureSocialTables();
        await dbUtils.query({
            sql: "INSERT IGNORE INTO user_follow (follower_id, following_id, create_time) VALUES (?, ?, ?)",
            values: [currentUserId, targetUserId, new Date()],
        });

        res.send({
            code: "0",
            msg: "关注成功",
        });
    } catch (error) {
        handleServerError(res, error, "001013", "关注失败");
    }
});

router.delete("/follow/:id", async (req, res) => {
    const targetUserId = toNumber(req.params.id, 0);
    const currentUserId = getCurrentUserId(req);

    if (!targetUserId || targetUserId === currentUserId) {
        sendError(res, "001013", "无法取消关注该用户");
        return;
    }

    try {
        await ensureSocialTables();
        await dbUtils.query({
            sql: "DELETE FROM user_follow WHERE follower_id = ? AND following_id = ?",
            values: [currentUserId, targetUserId],
        });

        res.send({
            code: "0",
            msg: "已取消关注",
        });
    } catch (error) {
        handleServerError(res, error, "001013", "取消关注失败");
    }
});

router.get("/followers", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query, 20);
        const result = await getFollowUsers({
            userId: getCurrentUserId(req),
            type: "followers",
            pageNo,
            pageSize,
        });

        res.send({
            code: "0",
            data: result.data,
            total: result.total,
        });
    } catch (error) {
        handleServerError(res, error, "001016", "获取粉丝列表失败", [], 0);
    }
});

router.get("/following", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query, 20);
        const result = await getFollowUsers({
            userId: getCurrentUserId(req),
            type: "following",
            pageNo,
            pageSize,
        });

        res.send({
            code: "0",
            data: result.data,
            total: result.total,
        });
    } catch (error) {
        handleServerError(res, error, "001017", "获取关注列表失败", [], 0);
    }
});

router.get("/dm/unread/summary", async (req, res) => {
    try {
        const currentUserId = getCurrentUserId(req);
        await ensureSocialTables();

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
            values: [currentUserId],
        });

        res.send({
            code: "0",
            data: {
                total_unread: results.reduce((total, item) => total + Number(item.unread_count || 0), 0),
                conversations: results.map((item) => ({
                    user_id: Number(item.user_id),
                    nick_name: item.nick_name || item.username || "",
                    avatar: item.avatar || "",
                    unread_count: Number(item.unread_count || 0),
                    latest_time: item.latest_time,
                })),
            },
        });
    } catch (error) {
        handleServerError(res, error, "001018", "获取私聊未读汇总失败");
    }
});

router.get("/dm/:targetUserId", async (req, res) => {
    const targetUserId = toNumber(req.params.targetUserId, 0);
    const currentUserId = getCurrentUserId(req);

    if (!targetUserId || targetUserId === currentUserId) {
        sendError(res, "001014", "私聊对象无效");
        return;
    }

    try {
        await ensureSocialTables();
        const targetUser = await buildPublicUserProfile(targetUserId, currentUserId);
        if (!targetUser) {
            sendError(res, "001011", "用户不存在");
            return;
        }

        const { results } = await dbUtils.query({
            sql: `SELECT
                    m.id,
                    m.sender_id,
                    m.receiver_id,
                    m.content,
                    m.create_time,
                    su.username AS sender_username,
                    su.nick_name AS sender_nick_name,
                    su.avatar AS sender_avatar,
                    ru.username AS receiver_username,
                    ru.nick_name AS receiver_nick_name,
                    ru.avatar AS receiver_avatar
                  FROM user_direct_message m
                  LEFT JOIN user su ON su.id = m.sender_id
                  LEFT JOIN user ru ON ru.id = m.receiver_id
                  WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
                  ORDER BY m.create_time ASC, m.id ASC
                  LIMIT 200`,
            values: [currentUserId, targetUserId, targetUserId, currentUserId],
        });

        await dbUtils.query({
            sql: `UPDATE user_direct_message
                  SET read_time = ?
                  WHERE sender_id = ? AND receiver_id = ? AND read_time IS NULL`,
            values: [new Date(), targetUserId, currentUserId],
        });

        await emitUnreadSummaryToUser(currentUserId);

        res.send({
            code: "0",
            data: {
                target_user: targetUser,
                messages: results.map((item) => ({
                    id: item.id,
                    sender_id: item.sender_id,
                    receiver_id: item.receiver_id,
                    content: item.content,
                    create_time: item.create_time,
                    sender_name: item.sender_nick_name || item.sender_username || "",
                    sender_avatar: item.sender_avatar || "",
                    receiver_name: item.receiver_nick_name || item.receiver_username || "",
                    receiver_avatar: item.receiver_avatar || "",
                })),
            },
        });
    } catch (error) {
        handleServerError(res, error, "001019", "获取私聊历史失败");
    }
});

router.post("/dm/:targetUserId", async (req, res) => {
    const targetUserId = toNumber(req.params.targetUserId, 0);
    const currentUserId = getCurrentUserId(req);
    const content = normalizeString(req.body?.content);

    if (!targetUserId || targetUserId === currentUserId) {
        sendError(res, "001014", "私聊对象无效");
        return;
    }

    if (!content) {
        sendError(res, "001015", "消息内容不能为空");
        return;
    }

    try {
        if (!(await requireUserExists(targetUserId))) {
            sendError(res, "001011", "用户不存在");
            return;
        }

        await ensureSocialTables();
        const { results } = await dbUtils.query({
            sql: "INSERT INTO user_direct_message (sender_id, receiver_id, content, create_time) VALUES (?, ?, ?, ?)",
            values: [currentUserId, targetUserId, content.slice(0, 2000), new Date()],
        });

        const { results: messageRows } = await dbUtils.query({
            sql: `SELECT
                    m.id,
                    m.sender_id,
                    m.receiver_id,
                    m.content,
                    m.create_time,
                    su.username AS sender_username,
                    su.nick_name AS sender_nick_name,
                    su.avatar AS sender_avatar,
                    ru.username AS receiver_username,
                    ru.nick_name AS receiver_nick_name,
                    ru.avatar AS receiver_avatar
                  FROM user_direct_message m
                  LEFT JOIN user su ON su.id = m.sender_id
                  LEFT JOIN user ru ON ru.id = m.receiver_id
                  WHERE m.id = ?
                  LIMIT 1`,
            values: [results.insertId],
        });

        const latestMessage = messageRows[0];
        if (latestMessage) {
            emitDirectMessageToUsers([currentUserId, targetUserId], {
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

        await emitUnreadSummaryToUser(targetUserId);

        res.send({
            code: "0",
            data: { id: results.insertId },
            msg: "发送成功",
        });
    } catch (error) {
        handleServerError(res, error, "001020", "发送私聊失败");
    }
});

router.put("/profile", async (req, res) => {
    const nickName = normalizeString(req.body?.nickName);
    const email = normalizeString(req.body?.email);
    const intro = normalizeString(req.body?.intro);
    const avatar = normalizeString(req.body?.avatar);

    if (!nickName) {
        sendError(res, "001006", "昵称不能为空");
        return;
    }

    const connection = await dbUtils.getConnection(res);

    try {
        await dbUtils.query(
            {
                sql: "UPDATE user SET nick_name = ?, email = ?, intro = ?, avatar = ?, update_time = ? WHERE id = ?",
                values: [nickName, email || null, intro || null, avatar || null, new Date(), getCurrentUserId(req)],
            },
            connection,
            false
        );

        const user = await getUserById(connection, getCurrentUserId(req));
        res.send({
            code: "0",
            msg: "资料已更新",
            data: formatUserRecord(user),
        });
    } catch (error) {
        handleServerError(res, error, "001021", "更新资料失败");
    } finally {
        connection.release();
    }
});

router.put("/password", async (req, res) => {
    const currentPassword = normalizeString(req.body?.currentPassword);
    const newPassword = normalizeString(req.body?.newPassword);

    if (!currentPassword || !newPassword) {
        sendError(res, "001007", "请完整填写当前密码和新密码");
        return;
    }

    if (currentPassword === newPassword) {
        sendError(res, "001008", "新密码不能与当前密码相同");
        return;
    }

    const connection = await dbUtils.getConnection(res);

    try {
        const { results } = await dbUtils.query(
            {
                sql: "SELECT id, password FROM user WHERE id = ? LIMIT 1",
                values: [getCurrentUserId(req)],
            },
            connection,
            false
        );

        const user = results[0];
        if (!user || user.password !== currentPassword) {
            sendError(res, "001009", "当前密码不正确");
            return;
        }

        await dbUtils.query(
            {
                sql: "UPDATE user SET password = ?, update_time = ? WHERE id = ?",
                values: [newPassword, new Date(), getCurrentUserId(req)],
            },
            connection,
            false
        );

        res.send({
            code: "0",
            msg: "密码已更新",
        });
    } catch (error) {
        handleServerError(res, error, "001022", "更新密码失败");
    } finally {
        connection.release();
    }
});

router.get("/forgetpwd", async (_req, res) => {
    try {
        await emailHandler.sendEmail({
            from: `"来自${config.blogName}" <${config.email.auth.user}>`,
            to: config.authorEmail,
            subject: `${config.blogName} 通知邮件`,
            text: "找回密码",
        });

        res.send({
            code: "0",
            msg: "通知邮件已发送",
        });
    } catch (error) {
        handleServerError(res, error, "001010", "通知邮件发送失败");
    }
});

router.post("/register", async (req, res) => {
    const userName = normalizeString(req.body?.userName);
    const password = normalizeString(req.body?.password);
    const nickName = normalizeString(req.body?.nickName);

    if (!userName || !password || !nickName) {
        sendError(res, "001001", "用户名、密码和昵称不能为空");
        return;
    }

    const connection = await dbUtils.getConnection(res);

    try {
        const { results } = await dbUtils.query(
            {
                sql: "SELECT id FROM user WHERE username = ? LIMIT 1",
                values: [userName],
            },
            connection,
            false
        );

        if (results.length > 0) {
            sendError(res, "001002", "用户名已存在");
            return;
        }

        const userData = {
            username: userName,
            password,
            nick_name: nickName,
            role: "user",
            create_time: new Date(),
            update_time: new Date(),
        };

        await dbUtils.query({ sql: "INSERT INTO user SET ?", values: userData }, connection, false);

        res.send({
            code: "0",
            msg: "注册成功",
        });
    } catch (error) {
        handleServerError(res, error, "001004", "注册失败");
    } finally {
        connection.release();
    }
});

module.exports = router;

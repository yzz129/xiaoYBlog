const mysql = require("mysql2/promise");

const config = require("../config");

const DEMO_USERS = Array.from({ length: 10 }, (_, index) => {
    const id = String(index + 1).padStart(2, "0");
    const username = `test_user_${id}`;

    return {
        username,
        password: "123456",
        nick_name: username,
        email: `${username}@example.com`,
        intro: `${username} 的演示账号，用于搜索、关注、私聊和用户主页展示。`,
        avatar: "",
    };
});

async function ensureSocialTables(connection) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS user_follow (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            follower_id INT NOT NULL,
            following_id INT NOT NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_user_follow (follower_id, following_id),
            KEY idx_user_follow_following (following_id),
            KEY idx_user_follow_follower (follower_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.query(`
        CREATE TABLE IF NOT EXISTS user_direct_message (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            sender_id INT NOT NULL,
            receiver_id INT NOT NULL,
            content TEXT NOT NULL,
            read_time DATETIME NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_direct_message_sender (sender_id),
            KEY idx_direct_message_receiver (receiver_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

async function upsertDemoUsers(connection) {
    for (const user of DEMO_USERS) {
        await connection.query(
            `
                INSERT INTO user (username, password, nick_name, email, intro, avatar, role, create_time, update_time)
                VALUES (?, ?, ?, ?, ?, ?, 'user', NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    password = VALUES(password),
                    nick_name = VALUES(nick_name),
                    email = VALUES(email),
                    intro = VALUES(intro),
                    avatar = VALUES(avatar),
                    update_time = NOW()
            `,
            [user.username, user.password, user.nick_name, user.email, user.intro, user.avatar]
        );
    }
}

async function getUserIdMap(connection) {
    const [rows] = await connection.query(
        `SELECT id, username FROM user WHERE username IN (${DEMO_USERS.map(() => "?").join(",")})`,
        DEMO_USERS.map((item) => item.username)
    );

    return rows.reduce((map, row) => {
        map[row.username] = Number(row.id);
        return map;
    }, {});
}

async function seedFollowRelations(connection, userIdMap) {
    const relations = [
        ["test_user_01", "test_user_02"],
        ["test_user_01", "test_user_03"],
        ["test_user_02", "test_user_01"],
        ["test_user_02", "test_user_04"],
        ["test_user_03", "test_user_01"],
        ["test_user_03", "test_user_05"],
        ["test_user_04", "test_user_01"],
        ["test_user_05", "test_user_02"],
        ["test_user_06", "test_user_01"],
        ["test_user_07", "test_user_01"],
        ["test_user_08", "test_user_03"],
        ["test_user_09", "test_user_01"],
        ["test_user_10", "test_user_02"],
    ];

    for (const [follower, following] of relations) {
        const followerId = userIdMap[follower];
        const followingId = userIdMap[following];

        if (!followerId || !followingId || followerId === followingId) {
            continue;
        }

        await connection.query(
            `
                INSERT IGNORE INTO user_follow (follower_id, following_id, create_time)
                VALUES (?, ?, NOW())
            `,
            [followerId, followingId]
        );
    }
}

async function seedDirectMessages(connection, userIdMap) {
    const pairs = [
        ["test_user_01", "test_user_02", "你好，我是前端演示账号。"],
        ["test_user_02", "test_user_01", "收到，私聊实时通知正常。"],
        ["test_user_03", "test_user_01", "你的博客文章我看过，写得不错。"],
    ];

    for (const [sender, receiver, content] of pairs) {
        const senderId = userIdMap[sender];
        const receiverId = userIdMap[receiver];

        if (!senderId || !receiverId) {
            continue;
        }

        const [existsRows] = await connection.query(
            `
                SELECT id
                FROM user_direct_message
                WHERE sender_id = ? AND receiver_id = ? AND content = ?
                LIMIT 1
            `,
            [senderId, receiverId, content]
        );

        if (existsRows.length > 0) {
            continue;
        }

        await connection.query(
            `
                INSERT INTO user_direct_message (sender_id, receiver_id, content, create_time)
                VALUES (?, ?, ?, NOW())
            `,
            [senderId, receiverId, content]
        );
    }
}

async function main() {
    const connection = await mysql.createConnection({
        ...config.mysql,
        multipleStatements: true,
    });

    try {
        await ensureSocialTables(connection);
        await upsertDemoUsers(connection);
        const userIdMap = await getUserIdMap(connection);
        await seedFollowRelations(connection, userIdMap);
        await seedDirectMessages(connection, userIdMap);

        console.log("Interview demo data ready.");
        console.log("Accounts:");
        DEMO_USERS.forEach((user) => {
            console.log(`- ${user.username} / 123456`);
        });
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

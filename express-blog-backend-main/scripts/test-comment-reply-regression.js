const jwt = require("jsonwebtoken");

const config = require("../config");
const dbUtils = require("../utils/db");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:8002";

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const getTableColumns = async (tableName) => {
    const { results } = await dbUtils.query({
        sql: `SHOW COLUMNS FROM ${tableName}`,
    });
    return new Set((results || []).map((item) => item.Field));
};

const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json();
    return data;
};

const createToken = (user) =>
    jwt.sign(
        {
            id: user.id,
            userName: user.username,
            username: user.username,
            nick_name: user.nick_name || "",
            roleId: user.role === "admin" ? 1 : 2,
            role_id: user.role === "admin" ? 1 : 2,
            roleName: user.role || "user",
            role_name: user.role || "user",
        },
        config.jwt.secret,
        { expiresIn: "1h" }
    );

async function main() {
    let commentId = 0;
    let approvedReplyId = 0;
    let pendingReplyId = 0;

    try {
        const replyColumns = await getTableColumns("reply");
        const { results: users } = await dbUtils.query({
            sql: "SELECT id, username, nick_name, role FROM user ORDER BY id ASC LIMIT 1",
        });
        const user = users[0];
        assert(user, "no test user found");

        const { results: articles } = await dbUtils.query({
            sql: "SELECT id FROM article WHERE private = 0 AND deleted = 0 ORDER BY id ASC LIMIT 1",
        });
        const article = articles[0];
        assert(article, "no public article found");

        const uniqueKey = `regression-${Date.now()}`;
        const now = new Date();

        const commentInsert = await dbUtils.query({
            sql: "INSERT INTO comments SET ?",
            values: {
                article_id: article.id,
                content: `${uniqueKey}-comment`,
                create_time: now,
                nick_name: "RegressionUser",
                site_url: "",
                avatar: "",
                device: "script",
                approved: 1,
                deleted: 0,
                author_id: user.id,
            },
        });
        commentId = Number(commentInsert.results.insertId);

        const approvedReplyValues = {
            comment_id: commentId,
            article_id: article.id,
            content: `${uniqueKey}-approved-reply`,
            create_time: now,
            nick_name: "RegressionUser",
            site_url: "",
            avatar: "",
            device: "script",
            approved: 1,
        };

        if (replyColumns.has("author_id")) {
            approvedReplyValues.author_id = user.id;
        }

        const approvedReplyInsert = await dbUtils.query({
            sql: "INSERT INTO reply SET ?",
            values: approvedReplyValues,
        });
        approvedReplyId = Number(approvedReplyInsert.results.insertId);

        const pendingReplyValues = {
            comment_id: commentId,
            article_id: article.id,
            content: `${uniqueKey}-pending-reply`,
            create_time: now,
            nick_name: "RegressionUser",
            site_url: "",
            avatar: "",
            device: "script",
            approved: 0,
        };

        if (replyColumns.has("author_id")) {
            pendingReplyValues.author_id = user.id;
        }

        const pendingReplyInsert = await dbUtils.query({
            sql: "INSERT INTO reply SET ?",
            values: pendingReplyValues,
        });
        pendingReplyId = Number(pendingReplyInsert.results.insertId);

        const token = createToken(user);

        const commentPage = await request(`/comment/page?pageNo=1&pageSize=20&id=${article.id}`);
        assert(commentPage.code === "0", "comment page code is not 0");

        const insertedComment = (commentPage.data || []).find((item) => item.id === commentId);
        assert(insertedComment, "inserted comment not found in comment page");
        assert(Array.isArray(insertedComment.replies), "comment replies is not an array");
        assert(
            insertedComment.replies.some((item) => item.id === approvedReplyId),
            "approved reply not found in comment replies"
        );
        assert(
            !insertedComment.replies.some((item) => item.id === pendingReplyId),
            "pending reply should not appear in approved comment replies"
        );

        const pendingReplyPage = await request("/reply/unreviewd_reply_page?pageNo=1&pageSize=20&type=1", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        assert(pendingReplyPage.code === "0", "pending reply page code is not 0");
        assert(
            (pendingReplyPage.data || []).some((item) => item.id === pendingReplyId),
            "pending reply not found in unreviewed reply page"
        );

        console.log("comment/reply regression test passed");
    } finally {
        if (approvedReplyId) {
            await dbUtils.query({
                sql: "DELETE FROM reply WHERE id = ?",
                values: [approvedReplyId],
            });
        }

        if (pendingReplyId) {
            await dbUtils.query({
                sql: "DELETE FROM reply WHERE id = ?",
                values: [pendingReplyId],
            });
        }

        if (commentId) {
            await dbUtils.query({
                sql: "DELETE FROM comments WHERE id = ?",
                values: [commentId],
            });
        }
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

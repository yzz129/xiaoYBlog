const express = require("express");
const jwt = require("jsonwebtoken");
const xss = require("xss");

const router = express.Router();

const config = require("../config");
const indexSQL = require("../sql");
const dbUtils = require("../utils/db");
const emailHandler = require("../utils/email");

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 10;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getPageParams = (query) => ({
    pageNo: Math.max(toNumber(query.pageNo, DEFAULT_PAGE_NO), 1),
    pageSize: Math.max(toNumber(query.pageSize, DEFAULT_PAGE_SIZE), 1),
});

const sendServerError = (res, error, code, msg) => {
    console.error(error);
    res.send({
        code,
        msg,
        data: [],
        total: 0,
    });
};

const getTokenFromRequest = (req) => {
    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
        return authorization.replace("Bearer ", "");
    }

    return "";
};

const getCurrentUserFromRequest = (req) => {
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

const attachReplies = async (connection, comments) => {
    const list = Array.isArray(comments) ? comments : [];

    await Promise.all(
        list.map(async (comment) => {
            const { results } = await dbUtils.query(
                {
                    sql: indexSQL.QueryReplyByCommentID,
                    values: [comment.id],
                },
                connection,
                false
            );
            comment.replies = results || [];
        })
    );

    return list;
};

const notifyOwner = async (subject, html) => {
    try {
        await emailHandler.sendEmail({
            from: `"${config.blogName}" <${config.email.auth.user}>`,
            to: config.authorEmail,
            subject,
            html,
        });
    } catch (error) {
        console.error(error);
    }
};

router.get("/page", async (req, res) => {
    const connection = await dbUtils.getConnection(res);

    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const articleId = toNumber(req.query.id, 0);
        const queryOptions = articleId
            ? {
                  sql: indexSQL.GetCommentsByArticleID,
                  values: [articleId, (pageNo - 1) * pageSize, pageSize],
              }
            : {
                  sql: indexSQL.GetMessagesApproved,
                  values: [(pageNo - 1) * pageSize, pageSize],
              };

        const { results } = await dbUtils.query(queryOptions, connection, false);
        const rows = Array.isArray(results?.[0]) ? results[0] : [];
        await attachReplies(connection, rows);

        res.send({
            code: "0",
            data: rows,
            total: Number(results?.[1]?.[0]?.total || 0),
        });
    } catch (error) {
        sendServerError(res, error, "012001", "failed to load comments");
    } finally {
        connection.release();
    }
});

router.post("/add", async (req, res) => {
    try {
        const currentUser = getCurrentUserFromRequest(req);
        const params = {
            ...req.body,
            create_time: new Date(),
        };

        if (params.content) {
            params.content = xss(params.content);
        }

        if (currentUser?.id) {
            params.author_id = currentUser.id;
        }

        await dbUtils.query({
            sql: indexSQL.CreateComment,
            values: params,
        });

        const isComment = Boolean(params.article_id);
        const targetName = isComment ? "评论" : "留言";

        void notifyOwner(
            `${config.blogName} 收到新的${targetName}`,
            `收到一条新的${targetName}，请点击 <a href="${config.siteURL}" style="font-size:18px">${config.blogName}</a> 前往查看。`
        );

        res.send({
            code: "0",
            msg: `${targetName}成功，等待审核`,
        });
    } catch (error) {
        console.error(error);
        res.send({
            code: "013001",
            msg: "提交失败",
        });
    }
});

router.get("/total", async (_req, res) => {
    try {
        const { results } = await dbUtils.query(indexSQL.GetMsgsTotal);
        const total = Array.isArray(results)
            ? results.reduce((sum, item) => sum + Number(item?.[0]?.total || 0), 0)
            : 0;

        res.send({
            code: "0",
            data: total,
            msg: "查询成功",
        });
    } catch (error) {
        sendServerError(res, error, "019002", "failed to load message total");
    }
});

router.get("/get_not_approved", async (req, res) => {
    try {
        const sql = String(req.query.type) === "1" ? indexSQL.QueryCommentsNotApproved : indexSQL.QueryMessagesNotApproved;
        const { results } = await dbUtils.query(sql);

        res.send({
            code: "0",
            data: results || [],
            msg: "查询成功",
        });
    } catch (error) {
        sendServerError(res, error, "019001", "failed to load pending comments");
    }
});

router.get("/page_not_approved", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const sql =
            String(req.query.type) === "1" ? indexSQL.QueryNotApprovedPageComment : indexSQL.QueryNotApprovedPageMessage;

        const { results } = await dbUtils.query({
            sql,
            values: [(pageNo - 1) * pageSize, pageSize],
        });

        res.send({
            code: "0",
            data: results?.[0] || [],
            total: Number(results?.[1]?.[0]?.total || 0),
        });
    } catch (error) {
        sendServerError(res, error, "019002", "failed to load pending comment page");
    }
});

router.put("/review", async (req, res) => {
    try {
        const params = req.body || {};
        await dbUtils.query({
            sql: indexSQL.UpdateApprovedByCommentID,
            values: [params.approved, params.id],
        });

        if (Number(params.approved) === 1 && params.email) {
            const jumpUrl = params.jump_url || config.siteURL;
            void emailHandler.replyEmailForMessage(params.email, "留言/评论", params.content, jumpUrl);
        }

        res.send({
            code: "0",
            msg: "审核成功",
        });
    } catch (error) {
        console.error(error);
        res.send({
            code: "015001",
            msg: "审核失败",
        });
    }
});

router.get("/number_of_people", async (_req, res) => {
    try {
        const { results } = await dbUtils.query(indexSQL.QueryPeopleCountOfMessage);
        res.send({
            code: "0",
            data: Array.isArray(results) ? results.length : 0,
        });
    } catch (error) {
        sendServerError(res, error, "012001", "failed to load participant count");
    }
});

router.get("/page_admin", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const sql = String(req.query.type) === "1" ? indexSQL.GetPageCommentAdmin : indexSQL.GetPageMessageAdmin;

        const { results } = await dbUtils.query({
            sql,
            values: [(pageNo - 1) * pageSize, pageSize],
        });

        res.send({
            code: "0",
            data: results?.[0] || [],
            total: Number(results?.[1]?.[0]?.total || 0),
        });
    } catch (error) {
        sendServerError(res, error, "013001", "failed to load admin comment page");
    }
});

router.put("/update", async (req, res) => {
    try {
        const params = { ...req.body };
        if (params.content) {
            params.content = xss(params.content);
        }

        await dbUtils.query({
            sql: indexSQL.UpdateComment,
            values: [params, params.id],
        });

        res.send({
            code: "0",
            data: null,
        });
    } catch (error) {
        console.error(error);
        res.send({
            code: "014001",
            data: 0,
        });
    }
});

router.delete("/delete", async (req, res) => {
    try {
        await dbUtils.query({
            sql: indexSQL.DeleteComment,
            values: [req.query.id],
        });

        res.send({
            code: "0",
            data: null,
        });
    } catch (error) {
        console.error(error);
        res.send({
            code: "015001",
            data: 0,
        });
    }
});

module.exports = router;

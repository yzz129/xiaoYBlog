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

const sendServerError = (res, error, code, msg) => {
    console.error(error);
    res.send({
        code,
        msg,
        data: [],
        total: 0,
    });
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

        if (currentUser?.id && !params.author_id) {
            params.author_id = currentUser.id;
        }

        await dbUtils.query({
            sql: indexSQL.AddReply,
            values: params,
        });

        const targetName = params.article_id ? "评论" : "留言";
        void notifyOwner(
            `${config.blogName} 收到新的${targetName}回复`,
            `收到一条新的${targetName}回复，请点击 <a href="${config.siteURL}" style="font-size:18px">${config.blogName}</a> 前往查看。`
        );

        res.send({
            code: "0",
            msg: "回复成功，等待审核",
        });
    } catch (error) {
        console.error(error);
        res.send({
            code: "018001",
            msg: "回复失败",
        });
    }
});

router.get("/getReplyOfCommentWaitReview", async (_req, res) => {
    try {
        const { results } = await dbUtils.query(indexSQL.GetReplyOfCommentWaitReview);
        res.send({
            code: "0",
            data: results || [],
            msg: "查询成功",
        });
    } catch (error) {
        sendServerError(res, error, "020001", "failed to load pending comment replies");
    }
});

router.get("/getReplyOfMsgWaitReview", async (_req, res) => {
    try {
        const { results } = await dbUtils.query(indexSQL.GetReplyOfMsgWaitReview);
        res.send({
            code: "0",
            data: results || [],
            msg: "查询成功",
        });
    } catch (error) {
        sendServerError(res, error, "016001", "failed to load pending message replies");
    }
});

router.get("/unreviewd_reply_page", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const sql =
            String(req.query.type) === "1"
                ? indexSQL.QueryUnreviewedCommentReplyPage
                : indexSQL.QueryUnreviewedMessageReplyPage;

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
        sendServerError(res, error, "019002", "failed to load pending reply page");
    }
});

router.put("/review", async (req, res) => {
    try {
        const params = req.body || {};
        await dbUtils.query({
            sql: indexSQL.UpdateApprovedByReplyID,
            values: [params.approved, params.id],
        });

        if (Number(params.approved) === 1 && params.email) {
            const jumpUrl = params.jump_url || config.siteURL;
            void emailHandler.replyEmailForMessage(params.email, "回复", params.content, jumpUrl);
        }

        res.send({
            code: "0",
            msg: "审核成功",
        });
    } catch (error) {
        console.error(error);
        res.send({
            code: "017001",
            msg: "审核失败",
        });
    }
});

module.exports = router;

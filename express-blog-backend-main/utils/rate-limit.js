const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

function userOrIpKey(req) {
    return req.currentUser?.id ? `user:${req.currentUser.id}` : `ip:${ipKeyGenerator(req.ip)}`;
}

function createLimiter({ windowMs, limit, code, message, keyGenerator }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        skip: (req) => req.method === "OPTIONS",
        keyGenerator,
        handler(_req, res) {
            res.status(429).send({ code, msg: message });
        },
    });
}

const globalLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 1200,
    code: "429000",
    message: "请求过于频繁，请稍后再试",
});

const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    code: "429001",
    message: "登录或验证操作过于频繁，请稍后再试",
});

const uploadLimiter = createLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    code: "429002",
    message: "图片上传过于频繁，请稍后再试",
    keyGenerator: userOrIpKey,
});

const agentLimiter = createLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 120,
    code: "429003",
    message: "Agent 操作过于频繁，请稍后再试",
    keyGenerator: userOrIpKey,
});

const messageLimiter = createLimiter({
    windowMs: 10 * 1000,
    limit: 8,
    code: "429004",
    message: "消息发送过于频繁，请稍后再试",
    keyGenerator: userOrIpKey,
});

module.exports = { globalLimiter, authLimiter, uploadLimiter, agentLimiter, messageLimiter };
